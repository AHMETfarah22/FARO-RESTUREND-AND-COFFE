import { useRef } from 'react'
import { AlertTriangle, Copy, Download, ExternalLink, Printer } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { Link, useParams } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/Layout'
import { AsyncBlock } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { downloadCanvas, isLocalOnly, menuUrl } from '@/features/tables/qr'
import { useAsync } from '@/hooks/useAsync'
import { tablesApi } from '@/lib/endpoints'
import { useI18n } from '@/lib/i18n'

/** Printable QR card for one table (/tables/:id/qr). */
export function TableQrPage() {
  const { id = '' } = useParams()
  const { restaurant } = useRestaurant()
  const toast = useToast()
  const { t } = useI18n()
  const canvasWrap = useRef<HTMLDivElement>(null)
  const { data, error, loading, reload } = useAsync((signal) => tablesApi.get(id, signal), [id])

  return (
    <>
      <div className="print:hidden">
        <PageHeader title={t('Table QR code')} description={t('Print this card and place it on the table. Guests scan it to open the menu.')} back={{ to: '/tables', label: t('Tables') }} />
      </div>
      <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
        {(table) => {
          const url = menuUrl(table.id, restaurant)
          return (
            <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
              <Card className="mx-auto w-full max-w-sm overflow-hidden print:max-w-none print:border-0 print:shadow-none">
                <div className="flex flex-col items-center bg-ink-900 px-6 pt-8 pb-7">
                  <Logo tone="light" align="center" />
                </div>
                <div className="flex flex-col items-center px-8 py-8">
                  <p className="text-xs font-semibold tracking-[0.3em] text-muted uppercase">Sipariş için okutun · Scan to order</p>
                  <div ref={canvasWrap} className="mt-5 rounded-2xl border border-line p-4">
                    <QRCodeCanvas value={url} size={220} level="M" marginSize={0} fgColor="#000000" bgColor="#FFFFFF" />
                  </div>
                  <p className="mt-6 font-display text-4xl font-semibold text-ink">{table.name}</p>
                  <p className="mt-1 text-sm text-muted">{t('{n} persons', { n: table.capacity })}{table.location ? ` · ${table.location}` : ''}</p>
                </div>
              </Card>

              <Card className="h-fit p-6 print:hidden">
                <h2 className="font-semibold text-ink">{t('Menu link')}</h2>
                <p className="mt-1 text-sm text-muted">{t('This address is encoded in the QR code. Customers do not need to log in.')}</p>
                <code className="mt-4 block rounded-xl bg-surface px-4 py-3 text-sm break-all text-ink">{url}</code>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>{t('Print')}</Button>
                  <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => downloadCanvas(canvasWrap.current?.querySelector('canvas') ?? null, `qr-masa-${String(table.number).padStart(2, '0')}.png`)}>
                    {t('Download PNG')}
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<Copy className="size-4" />}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(url)
                        toast.success(t('Link copied'))
                      } catch {
                        toast.error(t('Could not copy the link'))
                      }
                    }}
                  >
                    {t('Copy link')}
                  </Button>
                  <a href={url} target="_blank" rel="noreferrer">
                    <Button variant="ghost" icon={<ExternalLink className="size-4" />}>{t('Open menu')}</Button>
                  </a>
                </div>
                {isLocalOnly(url) ? (
                  <p className="mt-6 flex gap-2 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-ink" role="alert">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                    <span>
                      {t('This link only works on this computer — phones cannot open it. Set your public or network address in')}{' '}
                      <Link to="/settings?tab=qr" className="font-semibold underline underline-offset-4">{t('Settings → QR')}</Link>.
                    </span>
                  </p>
                ) : (
                  <p className="mt-6 rounded-xl border border-line px-4 py-3 text-xs text-muted">
                    {t('Phones must be on the same Wi-Fi network as this computer while testing. For a live restaurant, set the public menu address in')}{' '}
                    <Link to="/settings?tab=qr" className="font-semibold underline underline-offset-4">{t('Settings → QR')}</Link>.
                  </p>
                )}
              </Card>
            </div>
          )
        }}
      </AsyncBlock>
    </>
  )
}
