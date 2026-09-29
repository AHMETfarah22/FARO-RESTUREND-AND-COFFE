import type { CategorySales, Dashboard, InventoryReportRow, OrderStatus, PaymentMethod, ProductSales, Report, ReportGrouping, ReportSection, ReservationStatus, SalesPoint } from '@/types/api'
import { addDays, toIsoDate } from '@/lib/format'
import { db, type OrderRow } from '../db'
import { toCsv, toPdf, toXlsx, type TabularReport } from '../export'
import { DemoFile, HttpError, RoleGroups, conflict, one, requireRoles, route, type Query } from '../http'
import { byNewest, orderDto } from '../model'
import { localDate, round2, shortMonth, sum } from '../util'

/** ReportsController / DashboardController — ReportService. Revenue = total of paid, non-cancelled orders. */

const ORDER_STATUSES: OrderStatus[] = ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Served', 'Completed', 'Cancelled']
const RESERVATION_STATUSES: ReservationStatus[] = ['Pending', 'Confirmed', 'Arrived', 'Completed', 'Cancelled']
const METHODS: PaymentMethod[] = ['Cash', 'Card', 'Online', 'Test']
const GROUPINGS: ReportGrouping[] = ['Day', 'Week', 'Month', 'Year']

const isSale = (o: OrderRow) => o.status !== 'Cancelled' && o.paymentStatus === 'Paid'
const change = (current: number, previous: number) => (previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10)

/** yyyy-MM-dd → local Date (midnight). */
const day = (value: string) => {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const dd = (date: Date) => String(date.getDate()).padStart(2, '0')

const ordersBetween = (start: string, end: string) =>
  db().orders.filter((o) => {
    const d = localDate(o.createdAt)
    return d >= start && d <= end
  })

interface ItemRow {
  productName: string
  categoryName: string | null
  quantity: number
  lineTotal: number
}

function itemsOf(orders: OrderRow[]): ItemRow[] {
  const d = db()
  const category = new Map(d.products.map((p) => [p.id, d.categories.find((c) => c.id === p.categoryId)?.name ?? null]))
  return orders.flatMap((o) =>
    o.items.map((i) => ({
      productName: i.productName,
      categoryName: i.productId ? (category.get(i.productId) ?? null) : null,
      quantity: i.quantity,
      lineTotal: i.unitPrice * i.quantity,
    })),
  )
}

function productSales(items: ItemRow[], take: number): ProductSales[] {
  const groups = new Map<string, ItemRow[]>()
  for (const i of items) groups.set(i.productName, [...(groups.get(i.productName) ?? []), i])
  return [...groups]
    .map(([productName, rows]) => ({
      productName,
      categoryName: rows[0].categoryName ?? '—',
      quantity: sum(rows.map((r) => r.quantity)),
      revenue: round2(sum(rows.map((r) => r.lineTotal))),
    }))
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, take)
}

function categorySales(items: ItemRow[]): CategorySales[] {
  const groups = new Map<string, ItemRow[]>()
  for (const i of items) groups.set(i.categoryName ?? 'Other', [...(groups.get(i.categoryName ?? 'Other') ?? []), i])
  return [...groups]
    .map(([categoryName, rows]) => ({ categoryName, quantity: sum(rows.map((r) => r.quantity)), revenue: round2(sum(rows.map((r) => r.lineTotal))) }))
    .sort((a, b) => b.revenue - a.revenue)
}

function inventoryRows(lowOnly: boolean): InventoryReportRow[] {
  const ratio = (q: number, min: number) => (min === 0 ? 1 : q / min)
  return db()
    .inventory.filter((i) => !lowOnly || i.quantity <= i.minimumQuantity)
    .sort((a, b) => ratio(a.quantity, a.minimumQuantity) - ratio(b.quantity, b.minimumQuantity) || a.name.localeCompare(b.name))
    .map((i) => ({
      name: i.name,
      unit: i.unit,
      quantity: i.quantity,
      minimumQuantity: i.minimumQuantity,
      stockValue: round2(i.quantity * i.purchasePrice),
      isLowStock: i.quantity <= i.minimumQuantity,
    }))
}

function periodStart(date: Date, groupBy: ReportGrouping) {
  if (groupBy === 'Week') return addDays(date, -((date.getDay() + 6) % 7)) // Monday
  if (groupBy === 'Month') return new Date(date.getFullYear(), date.getMonth(), 1)
  if (groupBy === 'Year') return new Date(date.getFullYear(), 0, 1)
  return date
}

/** Buckets paid orders per day / week / month / year, labelled like the API ("26 Sep", "Week of 21 Sep", "Sep 2026", "2026"). */
function buildSeries(sold: OrderRow[], start: string, end: string, groupBy: ReportGrouping): SalesPoint[] {
  const byDay = new Map<string, { revenue: number; count: number }>()
  for (const o of sold) {
    const key = localDate(o.createdAt)
    const entry = byDay.get(key) ?? { revenue: 0, count: 0 }
    entry.revenue += o.total
    entry.count++
    byDay.set(key, entry)
  }

  const points: SalesPoint[] = []
  const last = day(end)
  for (let cursor = periodStart(day(start), groupBy); cursor <= last; ) {
    const next =
      groupBy === 'Day'
        ? addDays(cursor, 1)
        : groupBy === 'Week'
          ? addDays(cursor, 7)
          : groupBy === 'Month'
            ? new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
            : new Date(cursor.getFullYear() + 1, 0, 1)
    const label =
      groupBy === 'Day'
        ? `${dd(cursor)} ${shortMonth(cursor)}`
        : groupBy === 'Week'
          ? `Week of ${dd(cursor)} ${shortMonth(cursor)}`
          : groupBy === 'Month'
            ? `${shortMonth(cursor)} ${cursor.getFullYear()}`
            : String(cursor.getFullYear())
    const from = toIsoDate(cursor)
    const until = toIsoDate(next)
    const days = [...byDay].filter(([key]) => key >= from && key < until).map(([, v]) => v)
    points.push({ label, periodStart: from, revenue: round2(sum(days.map((d) => d.revenue))), orders: sum(days.map((d) => d.count)) })
    cursor = next
  }
  return points
}

function buildReport(q: Query): Report {
  const d = db()
  const end = one(q, 'to') ?? toIsoDate(new Date())
  const start = one(q, 'from') ?? toIsoDate(addDays(day(end), -29))
  const groupBy = (one(q, 'groupBy') as ReportGrouping | undefined) ?? 'Day'
  if (!GROUPINGS.includes(groupBy)) throw new HttpError(400, 'One or more validation errors occurred.', { groupBy: [`The value '${groupBy}' is not valid.`] })
  if (start > end) throw new HttpError(400, 'One or more validation errors occurred.', { from: ['Start date must be before end date.'] })
  if ((day(end).getTime() - day(start).getTime()) / 86_400_000 > 366 * 3) throw conflict('Please choose a date range of at most 3 years.')

  const orders = ordersBetween(start, end)
  const sold = orders.filter(isSale)
  const items = itemsOf(sold)
  const reservations = d.reservations.filter((r) => r.date >= start && r.date <= end)
  const kept = reservations.filter((r) => r.status !== 'Cancelled')
  const payments = d.orders.flatMap((o) => o.payments).filter((p) => p.status === 'Paid' && localDate(p.createdAt) >= start && localDate(p.createdAt) <= end)
  const revenue = round2(sum(sold.map((o) => o.total)))

  return {
    from: start,
    to: end,
    groupBy,
    currency: d.restaurant.currency,
    totals: {
      revenue,
      orders: sold.length,
      cancelledOrders: orders.filter((o) => o.status === 'Cancelled').length,
      averageOrderValue: sold.length === 0 ? 0 : round2(revenue / sold.length),
      tax: round2(sum(sold.map((o) => o.taxAmount))),
      discounts: round2(sum(sold.map((o) => o.discount))),
      itemsSold: sum(items.map((i) => i.quantity)),
      reservations: kept.length,
      guests: sum(kept.map((r) => r.partySize)),
    },
    sales: buildSeries(sold, start, end, groupBy),
    products: productSales(items, 20),
    categories: categorySales(items),
    payments: METHODS.map((method) => {
      const rows = payments.filter((p) => p.method === method)
      return { method, count: rows.length, amount: round2(sum(rows.map((p) => p.amount))) }
    }),
    orderStatuses: ORDER_STATUSES.map((status) => ({ status, count: orders.filter((o) => o.status === status).length })),
    reservationStatuses: RESERVATION_STATUSES.map((status) => ({ status, count: reservations.filter((r) => r.status === status).length })),
    inventory: inventoryRows(false),
  }
}

route('GET', '/reports', (req) => {
  requireRoles(req, RoleGroups.management)
  return buildReport(req.query)
})

route('GET', '/dashboard', (req): Dashboard => {
  requireRoles(req, RoleGroups.management)
  const d = db()
  const today = toIsoDate(new Date())
  const yesterday = toIsoDate(addDays(new Date(), -1))
  const orders = ordersBetween(toIsoDate(addDays(new Date(), -29)), today)

  const todayOrders = orders.filter((o) => localDate(o.createdAt) === today)
  const yesterdayOrders = orders.filter((o) => localDate(o.createdAt) === yesterday)
  const todaySales = round2(sum(todayOrders.filter(isSale).map((o) => o.total)))
  const yesterdaySales = round2(sum(yesterdayOrders.filter(isSale).map((o) => o.total)))
  const todayCount = todayOrders.filter((o) => o.status !== 'Cancelled').length
  const yesterdayCount = yesterdayOrders.filter((o) => o.status !== 'Cancelled').length

  const sold30 = orders.filter(isSale)
  const items30 = itemsOf(sold30)
  const pendingStatuses: OrderStatus[] = ['Pending', 'Confirmed', 'Preparing', 'Ready']
  const lowStock = inventoryRows(true)

  return {
    currency: d.restaurant.currency,
    todaySales: { value: todaySales, changePercent: change(todaySales, yesterdaySales) },
    todayOrders: { value: todayCount, changePercent: change(todayCount, yesterdayCount) },
    pendingOrders: d.orders.filter((o) => pendingStatuses.includes(o.status)).length,
    completedOrders: todayOrders.filter((o) => o.status === 'Completed').length,
    todayReservations: d.reservations.filter((r) => r.date === today && r.status !== 'Cancelled').length,
    availableTables: d.tables.filter((t) => t.status === 'Available').length,
    occupiedTables: d.tables.filter((t) => t.status === 'Occupied').length,
    totalTables: d.tables.length,
    lowStockCount: lowStock.length,
    last7Days: buildSeries(sold30, toIsoDate(addDays(new Date(), -6)), today, 'Day'),
    popularProducts: productSales(items30, 5),
    categorySales: categorySales(items30),
    lowStockItems: lowStock.slice(0, 5),
    recentOrders: [...d.orders].sort(byNewest).slice(0, 6).map(orderDto),
  }
})

const SECTIONS: ReportSection[] = ['Sales', 'Products', 'Categories', 'Payments', 'Orders', 'Reservations', 'Inventory']

/** Same tables as ReportService.ExportAsync. */
route('GET', '/reports/export', (req) => {
  requireRoles(req, RoleGroups.management)
  const report = buildReport(req.query)
  const section = (one(req.query, 'section') as ReportSection | undefined) ?? 'Sales'
  const format = one(req.query, 'format') ?? 'Csv'
  if (!SECTIONS.includes(section)) throw new HttpError(400, 'One or more validation errors occurred.', { section: [`The value '${section}' is not valid.`] })

  const m = (v: number) => v.toFixed(2)
  const n = (v: number) => String(Math.round(v * 100) / 100)
  const c = report.currency
  const tables: Record<ReportSection, [string, string[], string[][]]> = {
    Sales: [`${report.groupBy} Sales`, ['Period', 'Orders', `Revenue (${c})`], report.sales.map((s) => [s.label, String(s.orders), m(s.revenue)])],
    Products: ['Product Sales', ['Product', 'Category', 'Quantity', `Revenue (${c})`], report.products.map((p) => [p.productName, p.categoryName, String(p.quantity), m(p.revenue)])],
    Categories: ['Category Sales', ['Category', 'Quantity', `Revenue (${c})`], report.categories.map((p) => [p.categoryName, String(p.quantity), m(p.revenue)])],
    Payments: ['Payments', ['Method', 'Count', `Amount (${c})`], report.payments.map((p) => [p.method, String(p.count), m(p.amount)])],
    Orders: ['Orders by Status', ['Status', 'Orders'], report.orderStatuses.map((s) => [s.status, String(s.count)])],
    Reservations: ['Reservations by Status', ['Status', 'Reservations'], report.reservationStatuses.map((s) => [s.status, String(s.count)])],
    Inventory: [
      'Inventory',
      ['Item', 'Unit', 'Quantity', 'Minimum', `Stock value (${c})`, 'Low stock'],
      report.inventory.map((i) => [i.name, i.unit, n(i.quantity), n(i.minimumQuantity), m(i.stockValue), i.isLowStock ? 'Yes' : 'No']),
    ],
  }
  const [title, headers, rows] = tables[section]
  const date = (v: string) => v.split('-').reverse().join('.')
  const table: TabularReport = {
    title,
    subtitle: `${date(report.from)} – ${date(report.to)} · Revenue ${m(report.totals.revenue)} ${c} · ${report.totals.orders} orders`,
    headers,
    rows,
  }

  const nowDate = new Date()
  const pad = (v: number) => String(v).padStart(2, '0')
  const stamp = `${nowDate.getUTCFullYear()}${pad(nowDate.getUTCMonth() + 1)}${pad(nowDate.getUTCDate())}-${pad(nowDate.getUTCHours())}${pad(nowDate.getUTCMinutes())}`
  const baseName = `${title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/^-+|-+$/g, '')}-${stamp}`
  if (format === 'Xlsx') return new DemoFile(toXlsx(table), `${baseName}.xlsx`)
  if (format === 'Pdf') {
    const generated = `${pad(nowDate.getDate())}.${pad(nowDate.getMonth() + 1)}.${nowDate.getFullYear()} ${pad(nowDate.getHours())}:${pad(nowDate.getMinutes())}`
    return new DemoFile(toPdf(table, generated), `${baseName}.pdf`)
  }
  return new DemoFile(toCsv(table), `${baseName}.csv`)
})
