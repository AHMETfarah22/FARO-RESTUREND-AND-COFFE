import type { ReactNode } from 'react'
import { translate } from '@/lib/i18n'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'

/*
 * Chart conventions (single-series magnitude charts in brand ink):
 * 2px line, 4px rounded bar ends, recessive horizontal grid, muted axis text, hover tooltip on every chart.
 */
const INK = '#111111'
const GRID = '#E5E5E5'
const AXIS = '#666666'

interface SeriesChartProps<T> {
  data: T[]
  xKey: keyof T & string
  yKey: keyof T & string
  /** Name of the measure, shown in the tooltip. */
  label: string
  format: (value: number) => string
  /** Compact tick format for the y axis. */
  tickFormat?: (value: number) => string
  height?: number
}

function ChartTooltip({ active, payload, label, name, format }: TooltipContentProps<number, string> & { name: string; format: (v: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-paper px-3 py-2 shadow-lg">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink tabular-nums">
        {name}: {format(Number(payload[0].value))}
      </p>
    </div>
  )
}

const axisProps = {
  tick: { fill: AXIS, fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const

/** Area/line chart for values over time (revenue per day, etc.). */
export function TrendChart<T>({ data, xKey, yKey, label, format, tickFormat, height = 260 }: SeriesChartProps<T>) {
  return (
    <div style={{ height }} role="img" aria-label={translate('{label} chart', { label })}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="inkFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={INK} stopOpacity={0.14} />
              <stop offset="100%" stopColor={INK} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey as never} {...axisProps} minTickGap={16} dy={6} />
          <YAxis {...axisProps} width={56} tickFormatter={tickFormat ?? ((v: number) => String(v))} />
          <Tooltip
            cursor={{ stroke: INK, strokeWidth: 1, strokeDasharray: '3 3' }}
            content={(props) => <ChartTooltip {...(props as TooltipContentProps<number, string>)} name={label} format={format} />}
          />
          <Area
            type="monotone"
            dataKey={yKey as never}
            stroke={INK}
            strokeWidth={2}
            fill="url(#inkFade)"
            dot={false}
            activeDot={{ r: 5, fill: INK, stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Vertical bars for counts per period/category. */
export function ColumnChart<T>({ data, xKey, yKey, label, format, tickFormat, height = 260 }: SeriesChartProps<T>) {
  return (
    <div style={{ height }} role="img" aria-label={translate('{label} chart', { label })}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey as never} {...axisProps} minTickGap={8} dy={6} />
          <YAxis {...axisProps} width={44} allowDecimals={false} tickFormatter={tickFormat ?? ((v: number) => String(v))} />
          <Tooltip
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            content={(props) => <ChartTooltip {...(props as TooltipContentProps<number, string>)} name={label} format={format} />}
          />
          <Bar dataKey={yKey as never} fill={INK} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Ranked horizontal bars in plain HTML — every bar is directly labeled with its value,
 * so it reads without hover and works on phones.
 */
export function RankedBars({
  rows,
  emptyText = translate('No data for this period.'),
}: {
  rows: { label: ReactNode; sublabel?: ReactNode; value: number; display: string }[]
  emptyText?: string
}) {
  const max = Math.max(...rows.map((r) => r.value), 0)
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-muted">{emptyText}</p>
  return (
    <ul className="space-y-3.5">
      {rows.map((row, i) => (
        <li key={i}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink">
              {row.label}
              {row.sublabel && <span className="ml-2 text-xs text-muted">{row.sublabel}</span>}
            </span>
            <span className="shrink-0 font-medium text-ink tabular-nums">{row.display}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${max ? Math.max(2, (row.value / max) * 100) : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
