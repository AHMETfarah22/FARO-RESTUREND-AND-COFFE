import { Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Link } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/Layout'
import { AsyncBlock, EmptyState } from '@/components/ui/States'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { menuUrl } from '@/features/tables/qr'
import { useAsync } from '@/hooks/useAsync'
import { tablesApi } from '@/lib/endpoints'
import { useI18n } from '@/lib/i18n'

/** Print-ready sheet with every table's QR code. */
export function QrCodesPage() {
  const { restaurant } = useRestaurant()
  const { t } = useI18n()
  const { data, error, loading, reload } = useAsync((signal) => tablesApi.list(signal))

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={t('QR Codes')}
          description={t('One QR code per table. Print the sheet and cut out the cards.')}
          actions={<Button icon={<Printer className="size-4" />} onClick={() => window.print()}>{t('Print all')}</Button>}
        />
      </div>
      <AsyncBlock data={data} loading={loading} error={error} onRetry={reload} isEmpty={(d) => d.length === 0} empty={<Card><EmptyState title={t('No tables yet')} description={t('Add tables first to generate their QR codes.')} /></Card>}>
        {(tables) => (
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print:grid-cols-3 print:gap-3">
            {tables.map((table) => (
              <Card key={table.id} className="flex flex-col items-center p-6 text-center break-inside-avoid print:shadow-none">
                <Logo size="sm" align="center" />
                <div className="mt-5 rounded-xl border border-line p-3">
                  <QRCodeSVG value={menuUrl(table.id, restaurant)} size={150} level="M" marginSize={0} />
                </div>
                <p className="mt-4 font-display text-2xl font-semibold text-ink">{table.name}</p>
                <p className="text-xs tracking-[0.2em] text-muted uppercase">Sipariş için okutun · Scan to order</p>
                <Link to={`/tables/${table.id}/qr`} className="mt-3 text-xs text-muted underline-offset-4 hover:text-ink hover:underline print:hidden">
                  {t('Open card')}
                </Link>
              </Card>
            ))}
          </div>
        )}
      </AsyncBlock>
    </>
  )
}
