import { Logo } from '@/components/brand/Logo'
import { formatDateTime } from '@/lib/format'
import { translate as t } from '@/lib/i18n'
import { paymentMethodLabel } from '@/lib/labels'
import type { Order, Restaurant } from '@/types/api'

/**
 * 80mm-style receipt. Rendered hidden and shown only when printing (window.print()).
 */
export function Receipt({ order, restaurant, money }: { order: Order; restaurant: Restaurant | null; money: (v: number) => string }) {
  return (
    <div className="receipt mx-auto hidden w-[300px] font-mono text-[12px] leading-relaxed text-black print:block">
      <div className="flex flex-col items-center border-b border-dashed border-black pb-3 text-center">
        <Logo size="sm" align="center" />
        {restaurant?.address && <p className="mt-2">{restaurant.address}</p>}
        {restaurant?.phone && <p>{restaurant.phone}</p>}
      </div>
      <div className="border-b border-dashed border-black py-2">
        <p className="flex justify-between"><span>{t('Order')}</span><span>#{order.number}</span></p>
        <p className="flex justify-between"><span>{t('Date')}</span><span>{formatDateTime(order.createdAt)}</span></p>
        <p className="flex justify-between"><span>{t('Table')}</span><span>{order.tableName ?? t('Takeaway')}</span></p>
        {order.customerName && <p className="flex justify-between"><span>{t('Customer')}</span><span>{order.customerName}</span></p>}
      </div>
      <div className="border-b border-dashed border-black py-2">
        {order.items.map((i) => (
          <div key={i.id}>
            <p className="flex justify-between gap-2">
              <span>{i.quantity} x {i.productName}</span>
              <span className="shrink-0">{money(i.lineTotal)}</span>
            </p>
            {i.notes && <p className="pl-4 text-[11px]">— {i.notes}</p>}
          </div>
        ))}
      </div>
      <div className="border-b border-dashed border-black py-2">
        <p className="flex justify-between"><span>{t('Subtotal')}</span><span>{money(order.subtotal)}</span></p>
        {order.discount > 0 && <p className="flex justify-between"><span>{t('Discount')}</span><span>-{money(order.discount)}</span></p>}
        <p className="flex justify-between"><span>{t('Tax ({rate}%)', { rate: order.taxRate })}</span><span>{money(order.taxAmount)}</span></p>
        <p className="mt-1 flex justify-between text-[14px] font-bold"><span>{t('TOTAL')}</span><span>{money(order.total)}</span></p>
      </div>
      {order.payments.filter((p) => p.status === 'Paid').map((p) => (
        <p key={p.id} className="flex justify-between py-0.5"><span>{t('Paid · {method}', { method: paymentMethodLabel(p.method) })}</span><span>{money(p.amount)}</span></p>
      ))}
      <p className="mt-4 text-center">{t('Thank you for your visit!')}</p>
      <p className="text-center text-[10px]">{t('Test receipt · not a fiscal document')}</p>
    </div>
  )
}
