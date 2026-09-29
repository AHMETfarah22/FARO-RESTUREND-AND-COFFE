import { addDays, toIsoDate } from '@/lib/format'
import type { OrderStatus, PaymentMethod, ReservationStatus, Role } from '@/types/api'
import type { CategoryRow, CustomerRow, Db, NotificationRow, OrderRow, ProductRow, ReservationRow, TableRow, UserRow } from './db'
import { recalculate, tableName } from './util'

/*
 * Sample data for the demo — the same restaurant, menu, tables and accounts as the development seeder
 * (backend DbSeeder), plus a month of sales history so the dashboard and reports have something to show.
 */

/** Small deterministic random generator (mulberry32). */
function random(seed: number) {
  let s = seed
  const next = () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    /** Inclusive range. */
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    chance: (probability: number) => next() < probability,
    hex: (length: number) => Array.from({ length }, () => Math.floor(next() * 16).toString(16)).join('').toUpperCase(),
    uuid: () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const v = Math.floor(next() * 16)
        return (c === 'x' ? v : (v & 0x3) | 0x8).toString(16)
      }),
  }
}

/** (email, username, name, phone, role, password) — the development test accounts, plus a customer account for the demo. */
const accounts: [string, string, string, string, Role, string][] = [
  ['admin@example.com', 'admin', 'Faro Admin', '+90 532 000 00 01', 'SuperAdmin', 'Admin@12345'],
  ['manager@example.com', 'manager', 'Elif Yılmaz', '+90 532 000 00 02', 'Manager', 'Manager@12345'],
  ['waiter@example.com', 'waiter', 'Mehmet Kaya', '+90 532 000 00 03', 'Waiter', 'Waiter@12345'],
  ['waiter2@example.com', 'waiter2', 'Zeynep Arslan', '+90 532 000 00 06', 'Waiter', 'Waiter@12345'],
  ['kitchen@example.com', 'kitchen', 'Ahmet Demir', '+90 532 000 00 04', 'Kitchen', 'Kitchen@12345'],
  ['cashier@example.com', 'cashier', 'Ayşe Çelik', '+90 532 000 00 05', 'Cashier', 'Cashier@12345'],
  ['customer@example.com', 'customer', 'Can Öztürk', '+90 533 111 11 11', 'Customer', 'Customer@12345'],
]

const staffRoles: Role[] = ['Manager', 'Waiter', 'Kitchen', 'Cashier']

const cover = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=75'
const photo = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=75`

/** Category → [name, description, price, preparation minutes, featured, Unsplash photo id] */
const menu: [string, string, [string, string, number, number, boolean, string][]][] = [
  ['Coffee', '☕', [
    ['Espresso', 'Double shot of our house blend', 80, 3, false, '1510707577719-ae7c14805e3a'],
    ['Americano', 'Espresso with hot water', 95, 3, false, '1551030173-122aabc4489c'],
    ['Cappuccino', 'Espresso, steamed milk and milk foam', 120, 4, true, '1572442388796-11668a67e53d'],
    ['Caffè Latte', 'Espresso with silky steamed milk', 125, 4, false, '1561882468-9110e03e0f78'],
    ['Flat White', 'Ristretto with velvety micro-foam', 130, 4, false, '1577968897966-3d4325b36b61'],
    ['Turkish Coffee', 'Traditional, served with lokum', 90, 6, true, '1506778020041-0ea35027d019'],
  ]],
  ['Breakfast', '🍳', [
    ['Turkish Breakfast Plate', 'Cheeses, olives, eggs, honey and simit', 420, 12, true, '1533089860892-a7c6f0a88666'],
    ['Menemen', 'Eggs with tomatoes, peppers and spices', 210, 10, false, '1525351484163-7529414344d8'],
    ['Avocado Toast', 'Sourdough, avocado, poached egg', 240, 8, false, '1588137378633-dea1336ce1e2'],
  ]],
  ['Burger', '🍔', [
    ['Classic Burger', 'Beef patty, cheddar, pickles, house sauce', 290, 15, false, '1568901346375-23c9450c58cd'],
    ['Chicken Burger', 'Crispy chicken, coleslaw, spicy mayo', 250, 14, true, '1606755962773-d324e0a13086'],
    ['Truffle Burger', 'Beef, truffle mayo, caramelised onion', 360, 16, false, '1553979459-d2229ba7433b'],
  ]],
  ['Pizza', '🍕', [
    ['Margherita', 'Tomato, mozzarella, fresh basil', 280, 14, false, '1574071318508-1cdbab80d002'],
    ['Pepperoni', 'Tomato, mozzarella, spicy pepperoni', 320, 14, true, '1628840042765-356cda07504e'],
    ['Four Cheese', 'Mozzarella, gorgonzola, parmesan, cheddar', 340, 14, false, '1513104890138-7c749659a591'],
  ]],
  ['Food', '🍽️', [
    ['Caesar Salad', 'Romaine, parmesan, croutons, chicken', 230, 8, false, '1550304943-4f24f54ddde9'],
    ['Penne Arrabbiata', 'Spicy tomato sauce, parsley', 240, 12, false, '1621996346565-e3dbc646d9a9'],
    ['Grilled Salmon', 'With seasonal vegetables', 480, 18, true, '1467003909585-2f8a72700288'],
    ['Chicken Wrap', 'Grilled chicken, vegetables, yoghurt sauce', 220, 9, false, '1626700051175-6818013e1d4f'],
  ]],
  ['Dessert', '🍰', [
    ['San Sebastian Cheesecake', 'Burnt Basque cheesecake', 190, 3, true, '1635327173758-85badf17f995'],
    ['Chocolate Brownie', 'Warm, with vanilla ice cream', 170, 5, false, '1606313564200-e75d5e30476c'],
    ['Tiramisu', 'Mascarpone, espresso, cocoa', 180, 3, false, '1571877227200-a0d98ea607e9'],
    ['Baklava', 'Pistachio baklava, 4 pieces', 200, 3, false, '1761828122856-8703baac8e86'],
  ]],
  ['Cold Drinks', '🥤', [
    ['Cola', '330 ml', 60, 1, false, '1629654613528-5d0a2e4166de'],
    ['Fresh Lemonade', 'House-made with mint', 90, 3, true, '1621263764928-df1444c5e859'],
    ['Iced Latte', 'Espresso, cold milk, ice', 130, 3, false, '1517701604599-bb29b565090c'],
    ['Mineral Water', 'Sparkling, 200 ml', 40, 1, false, '1523362628745-0c100150b504'],
  ]],
  ['Hot Drinks', '🍵', [
    ['Turkish Tea', 'Freshly brewed black tea', 35, 2, false, '1576092768241-dec231879fc3'],
    ['Hot Chocolate', 'Belgian chocolate, whipped cream', 120, 4, false, '1542990253-0d0f5be5f0ed'],
    ['Herbal Tea', 'Chamomile, mint or linden', 70, 3, false, '1627435601361-ec25f5b1d0e5'],
  ]],
]

const people: [string, string, string][] = [
  ['Can Öztürk', '+90 533 111 11 11', 'can.ozturk@example.com'],
  ['Deniz Aydın', '+90 533 222 22 22', 'deniz.aydin@example.com'],
  ['Selin Koç', '+90 533 333 33 33', 'selin.koc@example.com'],
  ['Emre Şahin', '+90 533 444 44 44', 'emre.sahin@example.com'],
  ['Merve Doğan', '+90 533 555 55 55', 'merve.dogan@example.com'],
  ['Burak Yıldız', '+90 533 666 66 66', 'burak.yildiz@example.com'],
  ['Ceren Aksoy', '+90 533 777 77 77', 'ceren.aksoy@example.com'],
  ['Oğuz Kılıç', '+90 533 888 88 88', 'oguz.kilic@example.com'],
  ['Pınar Erdem', '+90 533 999 99 99', 'pinar.erdem@example.com'],
  ['Kerem Özdemir', '+90 534 121 21 21', 'kerem.ozdemir@example.com'],
]

/** (day offset, hour, party size, status, note) */
const bookings: [number, number, number, ReservationStatus, string | null][] = [
  [-6, 13, 2, 'Completed', null],
  [-5, 20, 4, 'Completed', null],
  [-3, 19, 4, 'Completed', null],
  [-2, 20, 2, 'Completed', 'Anniversary dinner'],
  [-1, 13, 6, 'Cancelled', null],
  [0, 19, 2, 'Confirmed', 'Window seat please'],
  [0, 20, 8, 'Confirmed', 'Birthday — bring a candle'],
  [1, 12, 4, 'Pending', null],
  [2, 19, 2, 'Confirmed', null],
  [3, 20, 4, 'Pending', 'Vegetarian guests'],
  [4, 19, 3, 'Confirmed', null],
  [5, 13, 6, 'Pending', null],
  [6, 20, 5, 'Pending', 'Business dinner'],
  [7, 21, 2, 'Pending', null],
  [10, 19, 2, 'Pending', null],
]

/** (name, unit, quantity, minimum, supplier, purchase price) — three items start below their minimum. */
const stock: [string, string, number, number, string, number][] = [
  ['Coffee Beans', 'kg', 2, 5, 'Kuru Kahveci Roasters', 850],
  ['Whole Milk', 'L', 18, 10, 'Sütaş', 32],
  ['Oat Milk', 'L', 4, 6, 'Oatly Distributor', 95],
  ['Burger Buns', 'pcs', 60, 30, 'Uno Bakery', 6],
  ['Beef Patties', 'pcs', 45, 20, 'Metro Gross', 48],
  ['Chicken Breast', 'kg', 9, 5, 'Banvit', 210],
  ['Mozzarella', 'kg', 6, 4, 'Pınar', 320],
  ['Pizza Dough', 'pcs', 25, 15, 'In-house', 12],
  ['Tomatoes', 'kg', 14, 8, 'Local Market', 35],
  ['Chocolate', 'kg', 1.5, 2, 'Callebaut', 690],
  ['Sugar', 'kg', 20, 5, 'Metro Gross', 38],
  ['Paper Cups', 'pcs', 400, 200, 'Packaging Co.', 2.5],
]

/** Busier at lunch and dinner. */
const busyHours = [8, 9, 10, 11, 12, 12, 13, 13, 13, 14, 15, 16, 17, 18, 19, 19, 20, 20, 20, 21, 22]

export function createSeed(now: Date, version: number): Db {
  // Separate streams: ids stay identical for every visitor and every day (a phone scanning a demo QR code
  // finds the same table), while the order history follows the current date.
  const ids = random(42)
  const rnd = random(7)

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const iso = (d: Date) => d.toISOString()
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000)
  const at = (daysAgo: number, hour: number, minute: number) => {
    const d = addDays(today, -daysAgo)
    d.setHours(hour, minute, 0, 0)
    return d
  }

  const restaurantId = ids.uuid()

  const users: UserRow[] = accounts.map(([email, userName, fullName, phone, role, password]) => ({
    id: ids.uuid(),
    fullName,
    email,
    userName,
    phone,
    roles: [role],
    restaurantId: role === 'Customer' ? null : restaurantId,
    password,
    isActive: true,
  }))

  const staff = users
    .filter((u) => staffRoles.includes(u.roles[0]))
    .map((u, i) => {
      const hired = new Date(today)
      hired.setMonth(hired.getMonth() - [16, 5, 4, 11, 5][i])
      return {
        id: ids.uuid(),
        userId: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        role: u.roles[0],
        isActive: true,
        hiredOn: toIsoDate(hired),
        createdAt: iso(addDays(now, -120)),
      }
    })

  const layout: [number, string][] = [
    [2, 'Window'], [2, 'Window'], [4, 'Main Hall'], [4, 'Main Hall'], [4, 'Main Hall'],
    [6, 'Main Hall'], [4, 'Terrace'], [4, 'Terrace'], [2, 'Garden'], [8, 'VIP Room'],
  ]
  const tables: TableRow[] = layout.map(([capacity, location], i) => ({ id: ids.uuid(), number: i + 1, capacity, location, status: 'Available' }))

  const categories: CategoryRow[] = []
  const products: ProductRow[] = []
  let sku = 100
  menu.forEach(([name, icon, items], sortOrder) => {
    const category: CategoryRow = { id: ids.uuid(), name, description: null, icon, sortOrder, isActive: true }
    categories.push(category)
    for (const [productName, description, price, preparationMinutes, isFeatured, photoId] of items) {
      products.push({
        id: ids.uuid(),
        categoryId: category.id,
        name: productName,
        description,
        imageUrl: photo(photoId),
        price,
        sku: `${name.slice(0, 3).toUpperCase()}-${sku++}`,
        // Desserts are made in limited batches — shows stock tracking.
        stock: name === 'Dessert' ? 25 : null,
        isAvailable: true,
        isFeatured,
        preparationMinutes,
        images: [],
      })
    }
  })

  const customers: CustomerRow[] = people.map(([name, phone, email], i) => ({
    id: ids.uuid(),
    name,
    phone,
    email,
    notes: null,
    userId: null,
    createdAt: iso(addDays(now, -(75 - i * 6))),
  }))
  // The demo customer account is Can Öztürk, so "My orders" has a history.
  customers[0].userId = users.find((u) => u.roles[0] === 'Customer')!.id

  // ---- orders: a month of history, today so far, and six live tickets for the kitchen and floor staff
  const categoryOf = new Map(categories.map((c) => [c.id, c.name]))
  const weighted = products.flatMap((p) => Array<ProductRow>((p.isFeatured ? 3 : 1) * (categoryOf.get(p.categoryId) === 'Coffee' ? 2 : 1)).fill(p))
  const orders: OrderRow[] = []

  const addOrder = (createdAt: Date, status: OrderStatus, table: TableRow, source = rnd.chance(0.45) ? ('QrMenu' as const) : ('Staff' as const)) => {
    const customer = rnd.chance(0.4) ? rnd.pick(customers) : null
    const order: OrderRow = {
      id: rnd.uuid(),
      number: 0,
      tableId: table.id,
      customerId: customer?.id ?? null,
      customerName: customer?.name ?? null,
      source,
      status,
      paymentStatus: 'Pending',
      subtotal: 0,
      discount: rnd.chance(1 / 8) ? 50 : 0,
      taxRate: 10,
      taxAmount: 0,
      total: 0,
      notes: null,
      createdAt: iso(createdAt),
      updatedAt: null,
      completedAt: null,
      items: [],
      payments: [],
    }
    const chosen = new Set<ProductRow>()
    const lines = rnd.int(1, 4)
    while (chosen.size < lines) chosen.add(rnd.pick(weighted))
    for (const p of chosen) order.items.push({ id: rnd.uuid(), productId: p.id, productName: p.name, unitPrice: p.price, quantity: rnd.int(1, 2), notes: null })
    recalculate(order)

    if (status === 'Completed') {
      const done = new Date(createdAt.getTime() + rnd.int(35, 55) * 60_000)
      const method: PaymentMethod = rnd.chance(0.45) ? 'Cash' : rnd.chance(0.7) ? 'Card' : 'Online'
      order.paymentStatus = 'Paid'
      order.completedAt = order.updatedAt = iso(done)
      const paidAt = iso(new Date(done.getTime() - 3 * 60_000))
      order.payments.push({ id: rnd.uuid(), amount: order.total, method, status: 'Paid', provider: 'Simulated', transactionReference: null, failureReason: null, createdAt: paidAt, paidAt, refundedAt: null })
    } else if (status === 'Cancelled') {
      order.updatedAt = iso(new Date(createdAt.getTime() + 8 * 60_000))
    }
    orders.push(order)
    return order
  }

  const finished = () => (rnd.chance(0.04) ? 'Cancelled' : 'Completed') satisfies OrderStatus

  for (let day = 30; day >= 1; day--) {
    const weekday = addDays(today, -day).getDay()
    const count = rnd.int(6, 11) + (weekday === 0 || weekday === 6 ? rnd.int(3, 6) : 0)
    for (let i = 0; i < count; i++) addOrder(at(day, rnd.pick(busyHours), rnd.int(0, 59)), finished(), rnd.pick(tables))
  }

  // Today until shortly before the live tickets.
  const liveFrom = minutesAgo(80)
  for (let hour = 8; hour <= 22; hour++) {
    const times = [at(0, hour, rnd.int(0, 29)), at(0, hour, rnd.int(30, 59))]
    for (const time of times) if (time < liveFrom && rnd.chance(0.75)) addOrder(time, finished(), rnd.pick(tables))
  }

  // Live tickets on Masa 03–08, so the floor plan shows them.
  const live: [number, OrderStatus][] = [[75, 'Completed'], [58, 'Served'], [40, 'Ready'], [26, 'Preparing'], [14, 'Confirmed'], [5, 'Pending']]
  const liveOrders = live.map(([ago, status], i) => {
    const table = tables[i + 2]
    const order = addOrder(minutesAgo(ago), status, table, status === 'Pending' ? 'QrMenu' : undefined)
    const touched = { Served: 32, Ready: 18, Preparing: 4, Confirmed: 1 }[status as string]
    if (touched) order.updatedAt = iso(minutesAgo(ago - touched))
    if (status !== 'Completed') table.status = 'Occupied'
    return order
  })
  tables[8].status = 'Cleaning'
  tables[9].status = 'Reserved' // VIP room, booked for tonight

  // Order numbers follow time, starting at #1001 like the database sequence.
  orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  orders.forEach((o, i) => {
    o.number = 1001 + i
    for (const p of o.payments) p.transactionReference = `SIM-${p.method.slice(0, 3).toUpperCase()}-${o.number}-${rnd.hex(8)}`
  })

  // ---- reservations
  const reservations: ReservationRow[] = bookings.map(([day, hour, partySize, status, notes], i) => {
    const customer = customers[i % customers.length]
    const fits = tables.filter((t) => t.capacity >= partySize).sort((a, b) => a.capacity - b.capacity || a.number - b.number)
    const table = fits[i % 2] ?? fits[0] ?? tables[tables.length - 1]
    return {
      id: rnd.uuid(),
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.phone!,
      email: customer.email,
      date: toIsoDate(addDays(today, day)),
      time: `${String(hour).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}:00`,
      partySize,
      tableId: table.id,
      status,
      notes,
      createdAt: iso(addDays(now, Math.min(day, 0) - 2)),
    }
  })

  // ---- inventory
  const openedAt = iso(addDays(now, -30))
  const inventory = stock.map(([name, unit, quantity, minimumQuantity, supplier, purchasePrice]) => ({
    id: rnd.uuid(),
    name,
    unit,
    quantity,
    minimumQuantity,
    supplier,
    purchasePrice,
    sellingPrice: null,
    createdAt: openedAt,
    updatedAt: null,
  }))
  const inventoryTransactions = inventory.map((item) => ({
    id: rnd.uuid(),
    itemId: item.id,
    type: 'StockIn' as const,
    quantityChange: item.quantity,
    quantityAfter: item.quantity,
    note: 'Opening stock',
    createdAt: openedAt,
  }))

  // ---- notifications
  const notifications: NotificationRow[] = inventory
    .filter((i) => i.quantity <= i.minimumQuantity)
    .map((item, i) => ({
      id: rnd.uuid(),
      type: 'LowStock' as const,
      title: `Low stock · ${item.name}`,
      message: `Remaining: ${item.quantity} ${item.unit} · Minimum: ${item.minimumQuantity} ${item.unit}`,
      link: '/inventory',
      isRead: false,
      createdAt: iso(minutesAgo(25 + i * 20)),
    }))
  const [paidLive, , , , , qrLive] = liveOrders
  const tableOf = (o: OrderRow) => tableName(tables.find((t) => t.id === o.tableId)!.number)
  notifications.push(
    {
      id: rnd.uuid(),
      type: 'NewOrder',
      title: `New order #${qrLive.number} · ${tableOf(qrLive)}`,
      message: qrLive.items.map((i) => `${i.quantity}x ${i.productName}`).join(', '),
      link: `/orders/${qrLive.id}`,
      isRead: false,
      createdAt: qrLive.createdAt,
    },
    {
      id: rnd.uuid(),
      type: 'Payment',
      title: `Payment received · #${paidLive.number}`,
      message: `${paidLive.total.toFixed(2)} TRY by ${paidLive.payments[0].method}`,
      link: `/orders/${paidLive.id}`,
      isRead: true,
      createdAt: paidLive.payments[0].createdAt,
    },
    {
      id: rnd.uuid(),
      type: 'System',
      title: 'Welcome to FARO RESTURENT AND COFFE',
      message: 'Your portal is ready. This is a demo: the sample data is kept only in your browser.',
      link: '/dashboard',
      isRead: true,
      createdAt: iso(addDays(now, -1)),
    },
  )

  return {
    version,
    seededOn: toIsoDate(now),
    nextOrderNumber: 1001 + orders.length,
    restaurant: {
      id: restaurantId,
      name: 'FARO RESTURENT AND COFFE',
      slug: 'faro-resturent-and-coffe',
      logoUrl: null,
      coverImageUrl: cover,
      phone: '+90 212 000 00 00',
      email: 'info@example.com',
      address: 'Istiklal Caddesi No: 1, Beyoğlu, Istanbul',
      description: 'Premium restaurant & specialty coffee.',
      openingTime: '08:00',
      closingTime: '23:00',
      currency: 'TRY',
      taxRate: 10,
      isActive: true,
      settings: {
        qrOrderingEnabled: true,
        autoConfirmQrOrders: false,
        qrMenuBaseUrl: null,
        defaultPreparationMinutes: 15,
        newOrderSound: true,
        lowStockAlerts: true,
        reservationAlerts: true,
        enabledPaymentMethods: ['Cash', 'Card', 'Online', 'Test'],
      },
    },
    users,
    staff,
    tables,
    categories,
    products,
    customers,
    orders,
    reservations,
    inventory,
    inventoryTransactions,
    notifications,
  }
}
