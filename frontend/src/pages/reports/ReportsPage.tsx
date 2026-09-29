import { useState } from 'react'
import { FileSpreadsheet, FileText, FileType } from 'lucide-react'
import { ColumnChart, RankedBars, TrendChart } from '@/components/charts/Charts'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Field, Input, Select } from '@/components/ui/Form'
import { DataTable, PageHeader, StatCard, Tabs, td, th } from '@/components/ui/Layout'
import { AsyncBlock, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import { downloadFile, getErrorMessage } from '@/lib/api'
import { reportsApi } from '@/lib/endpoints'
import { addDays, formatDateOnly, formatMoney, formatNumber, periodLabel, toIsoDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { groupingLabel, orderStatusLabel, paymentMethodLabel, reservationStatusLabel } from '@/lib/labels'
import type { ExportFormat, OrderStatus, ReportGrouping, ReportSection, ReservationStatus } from '@/types/api'

/** Labels are English source texts, shown through t(). */
const presets = [
  { key: 'today', label: 'Today', range: () => [new Date(), new Date()] },
  { key: '7d', label: '7 days', range: () => [addDays(new Date(), -6), new Date()] },
  { key: '30d', label: '30 days', range: () => [addDays(new Date(), -29), new Date()] },
  { key: 'month', label: 'This month', range: () => [new Date(new Date().getFullYear(), new Date().getMonth(), 1), new Date()] },
  { key: 'year', label: 'This year', range: () => [new Date(new Date().getFullYear(), 0, 1), new Date()] },
] as const

const groupings: ReportGrouping[] = ['Day', 'Week', 'Month', 'Year']

const sections: { value: ReportSection; label: string }[] = [
  { value: 'Sales', label: 'Sales' },
  { value: 'Products', label: 'Product sales' },
  { value: 'Categories', label: 'Category sales' },
  { value: 'Payments', label: 'Payments' },
  { value: 'Orders', label: 'Orders' },
  { value: 'Reservations', label: 'Reservations' },
  { value: 'Inventory', label: 'Inventory' },
]

export function ReportsPage() {
  const toast = useToast()
  const { t } = useI18n()
  const [from, setFrom] = useState(() => toIsoDate(addDays(new Date(), -29)))
  const [to, setTo] = useState(() => toIsoDate(new Date()))
  const [groupBy, setGroupBy] = useState<ReportGrouping>('Day')
  const [preset, setPreset] = useState<string>('30d')
  const [section, setSection] = useState<ReportSection>('Sales')
  const [exporting, setExporting] = useState<ExportFormat | null>(null)

  const { data, error, loading, reload } = useAsync((signal) => reportsApi.get({ from, to, groupBy }, signal), [from, to, groupBy])
  const money = (v: number, compact = false) => formatMoney(v, data?.currency ?? 'TRY', { compact })

  const applyPreset = (key: string) => {
    const p = presets.find((x) => x.key === key)!
    const [start, end] = p.range()
    setPreset(key)
    setFrom(toIsoDate(start))
    setTo(toIsoDate(end))
    if (key === 'year') setGroupBy('Month')
    else if (groupBy === 'Year' || groupBy === 'Month') setGroupBy('Day')
  }

  const exportAs = async (format: ExportFormat) => {
    setExporting(format)
    try {
      await downloadFile('/reports/export', { section, format, from, to, groupBy })
      toast.success(t('Report exported'))
    } catch (err) {
      toast.error(t('Export failed'), getErrorMessage(err))
    } finally {
      setExporting(null)
    }
  }

  return (
    <>
      <PageHeader title={t('Reports')} description={t('Sales, products, payments, orders, reservations and inventory for any period.')} />

      {/* Filters: one row above the charts */}
      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <Tabs value={preset} onChange={applyPreset} options={presets.map((p) => ({ value: p.key, label: t(p.label) }))} className="xl:mr-auto" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label={t('Start date')}>
              {(id) => <Input id={id} type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPreset('') }} />}
            </Field>
            <Field label={t('End date')}>
              {(id) => <Input id={id} type="date" value={to} min={from} onChange={(e) => { setTo(e.target.value); setPreset('') }} />}
            </Field>
            <Field label={t('Group by')} className="col-span-2 sm:col-span-1">
              {(id) => (
                <Select id={id} value={groupBy} onChange={(e) => setGroupBy(e.target.value as ReportGrouping)}>
                  {groupings.map((g) => <option key={g} value={g}>{groupingLabel(g)}</option>)}
                </Select>
              )}
            </Field>
          </div>
        </div>
      </Card>

      <AsyncBlock
        data={data}
        loading={loading}
        error={error}
        onRetry={reload}
        skeleton={<div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>}
      >
        {(report) => {
          const sales = report.sales.map((p) => ({ ...p, label: periodLabel(p.periodStart, report.groupBy) }))
          return (
            <div className={loading ? 'opacity-60 transition-opacity' : undefined}>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard label={t('Revenue')} value={money(report.totals.revenue, true)} hint={`${formatDateOnly(report.from)} – ${formatDateOnly(report.to)}`} />
                <StatCard label={t('Orders')} value={formatNumber(report.totals.orders)} hint={t('{n} cancelled', { n: report.totals.cancelledOrders })} />
                <StatCard label={t('Average order')} value={money(report.totals.averageOrderValue)} />
                <StatCard label={t('Items sold')} value={formatNumber(report.totals.itemsSold)} />
                <StatCard label={t('Tax collected')} value={money(report.totals.tax, true)} />
                <StatCard label={t('Discounts')} value={money(report.totals.discounts, true)} />
                <StatCard label={t('Reservations')} value={report.totals.reservations} />
                <StatCard label={t('Guests booked')} value={report.totals.guests} />
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                <Card className="xl:col-span-2">
                  <CardHeader title={t('{grouping} revenue', { grouping: groupingLabel(report.groupBy) })} description={t('Paid orders')} />
                  <div className="p-4 sm:p-6">
                    <TrendChart data={sales} xKey="label" yKey="revenue" label={t('Revenue')} format={(v) => money(v)} tickFormat={(v) => money(v, true)} height={300} />
                  </div>
                </Card>
                <Card>
                  <CardHeader title={t('Orders per period')} />
                  <div className="p-4 sm:p-6">
                    <ColumnChart data={sales} xKey="label" yKey="orders" label={t('Orders')} format={(v) => formatNumber(v)} height={300} />
                  </div>
                </Card>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader title={t('Product sales')} description={t('Top products by units sold')} />
                  <div className="p-6">
                    <RankedBars rows={report.products.slice(0, 10).map((p) => ({ label: p.productName, sublabel: p.categoryName, value: p.quantity, display: `${p.quantity} · ${money(p.revenue, true)}` }))} />
                  </div>
                </Card>
                <Card>
                  <CardHeader title={t('Category sales')} description={t('Revenue by category')} />
                  <div className="p-6">
                    <RankedBars rows={report.categories.map((c) => ({ label: c.categoryName, sublabel: t('{n} items', { n: c.quantity }), value: c.revenue, display: money(c.revenue, true) }))} />
                  </div>
                </Card>
                <Card>
                  <CardHeader title={t('Payment report')} description={t('Collected by method')} />
                  <div className="p-6">
                    <RankedBars rows={report.payments.map((p) => ({ label: paymentMethodLabel(p.method), sublabel: t('{n} payments', { n: p.count }), value: p.amount, display: money(p.amount, true) }))} />
                  </div>
                </Card>
                <Card>
                  <CardHeader title={t('Order report')} description={t('Orders by status')} />
                  <div className="p-6">
                    <RankedBars
                      rows={report.orderStatuses.filter((s) => s.count > 0).map((s) => ({ label: orderStatusLabel(s.status as OrderStatus), value: s.count, display: String(s.count) }))}
                      emptyText={t('No orders in this period.')}
                    />
                  </div>
                </Card>
                <Card>
                  <CardHeader title={t('Reservation report')} description={t('Reservations by status')} />
                  <div className="p-6">
                    <RankedBars
                      rows={report.reservationStatuses.filter((s) => s.count > 0).map((s) => ({ label: reservationStatusLabel(s.status as ReservationStatus), value: s.count, display: String(s.count) }))}
                      emptyText={t('No reservations in this period.')}
                    />
                  </div>
                </Card>
                <Card>
                  <CardHeader title={t('Inventory report')} description={t('Current stock (not date-filtered)')} />
                  <DataTable
                    className="max-h-80 overflow-y-auto"
                    head={<tr><th className={th}>{t('Item')}</th><th className={`${th} text-right`}>{t('Stock')}</th><th className={`${th} text-right`}>{t('Value')}</th></tr>}
                  >
                    {report.inventory.map((i) => (
                      <tr key={i.name}>
                        <td className={td}>{i.name}{i.isLowStock && <span className="ml-2 text-xs font-semibold text-warning">{t('LOW')}</span>}</td>
                        <td className={`${td} text-right tabular-nums`}>{formatNumber(i.quantity, 2)} {i.unit}</td>
                        <td className={`${td} text-right tabular-nums`}>{money(i.stockValue)}</td>
                      </tr>
                    ))}
                  </DataTable>
                </Card>
              </div>

              <Card className="mt-4">
                <CardHeader title={t('Export')} description={t('Download any section for the selected period.')} />
                <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-end">
                  <Field label={t('Report')} className="sm:w-64">
                    {(id) => (
                      <Select id={id} value={section} onChange={(e) => setSection(e.target.value as ReportSection)}>
                        {sections.map((s) => <option key={s.value} value={s.value}>{t(s.label)}</option>)}
                      </Select>
                    )}
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" icon={<FileText className="size-4" />} loading={exporting === 'Pdf'} onClick={() => exportAs('Pdf')}>PDF</Button>
                    <Button variant="secondary" icon={<FileSpreadsheet className="size-4" />} loading={exporting === 'Xlsx'} onClick={() => exportAs('Xlsx')}>Excel</Button>
                    <Button variant="secondary" icon={<FileType className="size-4" />} loading={exporting === 'Csv'} onClick={() => exportAs('Csv')}>CSV</Button>
                  </div>
                </div>
              </Card>
            </div>
          )
        }}
      </AsyncBlock>
    </>
  )
}
