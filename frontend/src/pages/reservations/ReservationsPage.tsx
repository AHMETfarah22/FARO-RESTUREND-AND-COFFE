import { useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, List, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { ReservationStatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { PageHeader, SearchInput, Tabs } from '@/components/ui/Layout'
import { Modal } from '@/components/ui/Modal'
import { AsyncBlock, EmptyState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { cn } from '@/lib/cn'
import { localeFor, useI18n } from '@/lib/i18n'
import { reservationStatusLabel } from '@/lib/labels'
import { reservationsApi, tablesApi, type ReservationInput } from '@/lib/endpoints'
import { addDays, formatDateOnly, formatTimeOnly, toIsoDate } from '@/lib/format'
import type { DiningTable, Reservation, ReservationStatus } from '@/types/api'

const statuses: ReservationStatus[] = ['Pending', 'Confirmed', 'Arrived', 'Completed', 'Cancelled']

/** Quick actions offered per status. */
const quickActions: Partial<Record<ReservationStatus, { to: ReservationStatus; label: string }[]>> = {
  Pending: [{ to: 'Confirmed', label: 'res|Confirm' }, { to: 'Cancelled', label: 'res|Cancel' }],
  Confirmed: [{ to: 'Arrived', label: 'res|Arrived' }, { to: 'Cancelled', label: 'res|Cancel' }],
  Arrived: [{ to: 'Completed', label: 'res|Complete' }],
}

export function ReservationsPage() {
  const toast = useToast()
  const { t } = useI18n()
  const confirm = useConfirm()
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [status, setStatus] = useState<'All' | ReservationStatus>('All')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Reservation | 'new' | null>(null)

  // List view: from today onward (or the selected day). Calendar: the whole visible month.
  const range = useMemo(() => {
    if (view === 'calendar') {
      const first = new Date(month.getFullYear(), month.getMonth(), 1)
      const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
      return { from: toIsoDate(first), to: toIsoDate(last) }
    }
    return selectedDay ? { from: selectedDay, to: selectedDay } : { from: toIsoDate(addDays(new Date(), -7)), to: undefined }
  }, [view, month, selectedDay])

  const { data, error, loading, reload, setData } = useAsync(
    (signal) => reservationsApi.list({ ...range, status: status === 'All' ? undefined : status, search: search.trim() || undefined }, signal),
    [range.from, range.to, status, search],
  )
  const tables = useAsync((signal) => tablesApi.list(signal))

  const setResStatus = async (r: Reservation, to: ReservationStatus) => {
    if (to === 'Cancelled' && !(await confirm({ title: t("Cancel {name}'s reservation?", { name: r.customerName }), confirmLabel: t('Cancel reservation'), danger: true }))) return
    try {
      const updated = await reservationsApi.setStatus(r.id, to)
      setData((list) => list!.map((x) => (x.id === updated.id ? updated : x)))
      toast.success(t('Reservation: {status}', { status: reservationStatusLabel(to) }))
    } catch (err) {
      toast.error(t('Could not update the reservation'), getErrorMessage(err))
    }
  }

  const remove = async (r: Reservation) => {
    if (!(await confirm({ title: t('Delete reservation?'), message: `${r.customerName} · ${formatDateOnly(r.date)} ${formatTimeOnly(r.time)}`, confirmLabel: t('Delete'), danger: true }))) return
    try {
      await reservationsApi.remove(r.id)
      setData((list) => list!.filter((x) => x.id !== r.id))
      toast.success(t('Reservation deleted'))
    } catch (err) {
      toast.error(t('Could not delete the reservation'), getErrorMessage(err))
    }
  }

  const today = toIsoDate(new Date())

  return (
    <>
      <PageHeader
        title={t('Reservations')}
        description={t('Bookings, arrivals and table assignments.')}
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>{t('New reservation')}</Button>}
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={view}
          onChange={(v) => { setView(v); setSelectedDay(null) }}
          options={[
            { value: 'list' as const, label: <span className="inline-flex items-center gap-1.5"><List className="size-4" /> {t('List')}</span> },
            { value: 'calendar' as const, label: <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" /> {t('Calendar')}</span> },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput value={search} onChange={setSearch} placeholder={t('Name or phone…')} className="sm:w-60" />
          <Select value={status} onChange={(e) => setStatus(e.target.value as 'All' | ReservationStatus)} className="sm:w-44" aria-label={t('Status filter')}>
            <option value="All">{t('All statuses')}</option>
            {statuses.map((s) => <option key={s} value={s}>{reservationStatusLabel(s)}</option>)}
          </Select>
        </div>
      </div>

      {view === 'calendar' && (
        <MonthCalendar
          month={month}
          onMonth={setMonth}
          reservations={data ?? []}
          selected={selectedDay}
          today={today}
          onSelect={(day) => { setSelectedDay(day); setView('list') }}
        />
      )}

      {view === 'list' && (
        <Card>
          <CardHeader
            title={selectedDay ? formatDateOnly(selectedDay) : t('Upcoming & recent')}
            description={selectedDay ? undefined : t('From last week onward')}
            action={selectedDay && <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>{t('Show all')}</Button>}
          />
          <AsyncBlock
            data={data}
            loading={loading}
            error={error}
            onRetry={reload}
            isEmpty={(d) => d.length === 0}
            empty={<EmptyState icon={<CalendarDays className="size-6" />} title={t('No reservations')} description={t('New bookings will appear here.')} />}
          >
            {(list) => (
              <ul className="divide-y divide-line">
                {list.map((r) => (
                  <li key={r.id} className={cn('flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center', r.date === today && 'bg-surface/50')}>
                    <div className="flex w-full items-center gap-4 sm:w-auto sm:flex-1">
                      <div className="w-16 shrink-0 text-center">
                        <p className="text-xl font-semibold text-ink tabular-nums">{formatTimeOnly(r.time)}</p>
                        <p className="text-xs text-muted">{r.date === today ? t('Today') : formatDateOnly(r.date).replace(/ \d{4}$/, '')}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink">{r.customerName}</p>
                        <p className="truncate text-sm text-muted">
                          <Users className="mr-1 inline size-3.5" />{t('{n} people', { n: r.partySize })} · {r.tableName ?? t('No table')} · {r.phone}
                        </p>
                        {r.notes && <p className="truncate text-xs text-muted italic">“{r.notes}”</p>}
                      </div>
                      <ReservationStatusBadge status={r.status} />
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      {quickActions[r.status]?.map((a) => (
                        <Button key={a.to} size="sm" variant={a.to === 'Cancelled' ? 'ghost' : 'secondary'} onClick={() => setResStatus(r, a.to)} className={cn(a.to === 'Cancelled' && 'text-danger')}>
                          {t(a.label)}
                        </Button>
                      ))}
                      <Button variant="ghost" size="sm" onClick={() => setEditing(r)} aria-label={t('Edit')}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(r)} aria-label={t('Delete')} className="text-danger"><Trash2 className="size-4" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AsyncBlock>
        </Card>
      )}

      <ReservationModal
        reservation={editing}
        tables={tables.data ?? []}
        defaultDate={selectedDay ?? today}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); reload() }}
      />
    </>
  )
}

function MonthCalendar({
  month,
  onMonth,
  reservations,
  selected,
  today,
  onSelect,
}: {
  month: Date
  onMonth: (d: Date) => void
  reservations: Reservation[]
  selected: string | null
  today: string
  onSelect: (day: string) => void
}) {
  const { t } = useI18n()
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const offset = (first.getDay() + 6) % 7 // Monday first
    return Array.from({ length: 42 }, (_, i) => addDays(first, i - offset))
  }, [month])

  const byDay = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    for (const r of reservations) map.set(r.date, [...(map.get(r.date) ?? []), r])
    return map
  }, [reservations])

  const title = month.toLocaleDateString(localeFor(), { month: 'long', year: 'numeric' })

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        <div className="flex gap-1">
          <Button variant="secondary" size="sm" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label={t('Previous month')}><ChevronLeft className="size-4" /></Button>
          <Button variant="secondary" size="sm" onClick={() => onMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>{t('Today')}</Button>
          <Button variant="secondary" size="sm" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label={t('Next month')}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-line text-center text-xs font-semibold tracking-wide text-muted uppercase">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-2.5">{t(`day|${d}`)}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const iso = toIsoDate(day)
          const inMonth = day.getMonth() === month.getMonth()
          const items = (byDay.get(iso) ?? []).filter((r) => r.status !== 'Cancelled')
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              className={cn(
                'flex min-h-20 flex-col items-start gap-1 border-r border-b border-line p-1.5 text-left transition-colors hover:bg-surface sm:min-h-28 sm:p-2 [&:nth-child(7n)]:border-r-0',
                !inMonth && 'bg-surface/50 text-muted/60',
                selected === iso && 'bg-surface',
              )}
            >
              <span className={cn('flex size-7 items-center justify-center rounded-full text-sm font-medium', iso === today && 'bg-brand text-brand-fg')}>{day.getDate()}</span>
              {items.slice(0, 2).map((r) => (
                <span key={r.id} className="hidden w-full truncate rounded-md bg-brand px-1.5 py-0.5 text-[11px] text-brand-fg sm:block">
                  {formatTimeOnly(r.time)} {r.customerName.split(' ')[0]}
                </span>
              ))}
              {items.length > 0 && (
                <span className={cn('text-[11px] font-semibold text-ink', items.length > 2 ? 'sm:block' : 'sm:hidden')}>
                  {items.length > 2 ? t('+{n} more', { n: items.length - 2 }) : t('{n} booking(s)', { n: items.length })}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function ReservationModal({
  reservation,
  tables,
  defaultDate,
  onClose,
  onSaved,
}: {
  reservation: Reservation | 'new' | null
  tables: DiningTable[]
  defaultDate: string
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const { t } = useI18n()
  const isNew = reservation === 'new'
  const initial: ReservationInput =
    reservation && reservation !== 'new'
      ? {
          customerName: reservation.customerName,
          phone: reservation.phone,
          email: reservation.email,
          date: reservation.date,
          time: formatTimeOnly(reservation.time),
          partySize: reservation.partySize,
          tableId: reservation.tableId,
          status: reservation.status,
          notes: reservation.notes,
        }
      : { customerName: '', phone: '', email: null, date: defaultDate, time: '19:00', partySize: 2, tableId: null, status: 'Pending', notes: null }
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [lastKey, setLastKey] = useState<string | null>(null)
  const key = reservation === null ? null : isNew ? 'new' : reservation.id
  if (key !== lastKey) {
    setLastKey(key)
    setForm(initial)
    setErrors({})
  }

  const set = <K extends keyof ReservationInput>(k: K, v: ReservationInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const fitting = tables.filter((tb) => tb.capacity >= form.partySize && tb.status !== 'Disabled')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const input = { ...form, customerName: form.customerName.trim(), phone: form.phone.trim(), email: form.email?.trim() || null, notes: form.notes?.trim() || null }
      if (isNew) await reservationsApi.create(input)
      else await reservationsApi.update((reservation as Reservation).id, input)
      toast.success(isNew ? t('Reservation created') : t('Reservation updated'))
      onSaved()
    } catch (err) {
      setErrors(getFieldErrors(err))
      toast.error(t('Could not save the reservation'), getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={reservation !== null}
      onClose={onClose}
      title={isNew ? t('New reservation') : t('Edit reservation')}
      size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button><Button type="submit" form="reservation-form" loading={saving}>{t('Save')}</Button></>}
    >
      <form id="reservation-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label={t('Customer name')} error={errors.customerName} required>
          {(id) => <Input id={id} value={form.customerName} onChange={(e) => set('customerName', e.target.value)} invalid={!!errors.customerName} />}
        </Field>
        <Field label={t('Phone')} error={errors.phone} required>
          {(id) => <Input id={id} type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} invalid={!!errors.phone} placeholder="+90 5xx xxx xx xx" />}
        </Field>
        <Field label={t('Email')} error={errors.email} className="sm:col-span-2">
          {(id) => <Input id={id} type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} invalid={!!errors.email} />}
        </Field>
        <Field label={t('Date')} error={errors.date} required>
          {(id) => <Input id={id} type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />}
        </Field>
        <Field label={t('Time')} error={errors.time} required>
          {(id) => <Input id={id} type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />}
        </Field>
        <Field label={t('Number of people')} error={errors.partySize} required>
          {(id) => <Input id={id} type="number" min={1} max={50} value={form.partySize} onChange={(e) => set('partySize', Number(e.target.value))} />}
        </Field>
        <Field label={t('Table')} hint={t('{n} table(s) fit this party', { n: fitting.length })} error={errors.tableId}>
          {(id) => (
            <Select id={id} value={form.tableId ?? ''} onChange={(e) => set('tableId', e.target.value || null)}>
              <option value="">{t('Assign later')}</option>
              {fitting.map((tb) => <option key={tb.id} value={tb.id}>{tb.name} · {t('{n} seats', { n: tb.capacity })}{tb.location ? ` · ${tb.location}` : ''}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t('Status')}>
          {(id) => (
            <Select id={id} value={form.status} onChange={(e) => set('status', e.target.value as ReservationStatus)}>
              {statuses.map((s) => <option key={s} value={s}>{reservationStatusLabel(s)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t('Notes')} error={errors.notes} className="sm:col-span-2">
          {(id) => <Textarea id={id} rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder={t('Allergies, occasion, seating wishes…')} />}
        </Field>
      </form>
    </Modal>
  )
}
