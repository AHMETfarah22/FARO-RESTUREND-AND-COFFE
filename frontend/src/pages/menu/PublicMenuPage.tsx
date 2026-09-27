import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ChefHat, ChevronRight, Clock, Minus, Plus, Receipt, Search, ShoppingBag, Star, Trash2, UtensilsCrossed, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { CoverHero } from '@/components/brand/CoverHero'
import { Logo } from '@/components/brand/Logo'
import { ProductImage } from '@/components/ProductImage'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { addCustomerManifest, cacheCover, readCachedCover, subscribeOrderIfAllowed } from '@/features/menu/customerPush'
import { applyCustomerLang, useCustomerText } from '@/features/menu/customerText'
import { LangSwitch, ReadyOverlay } from '@/features/menu/CustomerOrderViews'
import { useCart, useTrackedOrders } from '@/features/menu/useCart'
import { useCustomerOrders } from '@/features/menu/useCustomerOrders'
import { useDevice, type Device } from '@/features/menu/useDevice'
import { useWorkspaceTheme } from '@/features/theme/useWorkspaceTheme'
import { useAsync } from '@/hooks/useAsync'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/cn'
import { publicMenuApi } from '@/lib/endpoints'
import { formatMoney } from '@/lib/format'
import type { PublicMenu, PublicMenuProduct, PublicOrderStatus } from '@/types/api'

type Cart = ReturnType<typeof useCart>
type Money = (value: number) => string
type Item = { product: PublicMenuProduct; icon: string | null }

/** Text inputs on customer pages use 16px text so phones don't zoom in when typing. */
const fieldClass =
  'w-full rounded-xl border border-line bg-paper px-4 text-base text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus-visible:outline-none'

/**
 * Customer QR menu (/menu/table/:tableId) — no login.
 * Three layouts: phone (thumb-friendly list, bottom cart bar), tablet (card grid) and
 * computer (categories | menu | order, with the order always visible).
 */
export function PublicMenuPage() {
  const { tableId = '' } = useParams()
  const { t } = useCustomerText()
  const { data: menu, error, loading, reload } = useAsync((signal) => publicMenuApi.get(tableId, signal), [tableId])
  useWorkspaceTheme('customer')

  useEffect(() => {
    addCustomerManifest()
    applyCustomerLang()
  }, [])

  if (error && !menu) {
    return (
      <StatusScreen>
        <p className="font-display text-3xl font-semibold text-ink">{t.menuUnavailable}</p>
        <p className="mt-2 text-base text-muted">{error.includes('not found') ? t.invalidQr : error}</p>
        <Button variant="secondary" size="lg" className="mt-6" onClick={reload}>{t.tryAgain}</Button>
      </StatusScreen>
    )
  }
  if (loading || !menu) {
    return (
      <StatusScreen>
        <Spinner className="size-8 text-brand" />
      </StatusScreen>
    )
  }
  return <MenuExperience key={tableId} menu={menu} tableId={tableId} />
}

function StatusScreen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface">
      <CoverHero image={readCachedCover()} tone="sky" className="rounded-b-[2rem] px-5 pt-14 pb-12 text-center">
        <Logo size="md" tone="light" align="center" />
      </CoverHero>
      <div className="flex flex-col items-center px-6 py-16 text-center">{children}</div>
    </div>
  )
}

function MenuExperience({ menu, tableId }: { menu: PublicMenu; tableId: string }) {
  const device = useDevice()
  const { t } = useCustomerText()
  const navigate = useNavigate()
  const cart = useCart(tableId)
  const tracked = useTrackedOrders()
  // Keeps following this phone's orders while the guest browses, so the "ready" alert also appears here.
  const { activeCount, readyAlert, dismissReady } = useCustomerOrders(tracked.ids, tracked.forget)
  const [cartOpen, setCartOpen] = useState(false)
  const [selected, setSelected] = useState<Item | null>(null)

  const money: Money = (v) => formatMoney(v, menu.currency)
  const myOrdersHref = `/menu/orders?table=${tableId}`
  const desktop = device === 'desktop'

  const checkout = useCheckout(menu, cart, (order) => {
    tracked.track(order.id, tableId)
    cart.clear()
    setCartOpen(false)
    void subscribeOrderIfAllowed(order.id)
    navigate(myOrdersHref)
  })

  useEffect(() => {
    document.title = `${t.menu} · ${menu.tableName} · ${menu.restaurantName}`
    cacheCover(menu.coverImageUrl)
  }, [menu, t])

  const quantityOf = (id: string) => cart.lines.find((l) => l.product.id === id)?.quantity ?? 0

  return (
    <div className={cn('min-h-dvh bg-surface', desktop ? 'pb-16' : 'pb-32')}>
      <MenuHero menu={menu} device={device} myOrdersHref={tracked.ids.length ? myOrdersHref : null} activeOrders={activeCount} />

      <MenuBrowser
        menu={menu}
        device={device}
        money={money}
        quantityOf={quantityOf}
        onOpen={setSelected}
        onAdd={(p) => cart.add(p)}
        onQuantity={(id, q) => cart.setQuantity(id, q)}
        aside={
          desktop ? (
            <>
              {activeCount > 0 && <ActiveOrdersLink href={myOrdersHref} count={activeCount} className="mb-4" />}
              <CartPanel menu={menu} cart={cart} checkout={checkout} money={money} />
            </>
          ) : null
        }
      />

      {/* Phone & tablet: the order lives in a bottom bar + sheet */}
      {!desktop && menu.orderingEnabled && cart.count > 0 && (
        <BottomBar>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="mx-auto flex h-16 w-full max-w-xl items-center gap-3 rounded-2xl bg-brand px-4 text-brand-fg shadow-2xl shadow-brand/40 transition-transform active:scale-[0.99]"
          >
            <span className="relative flex size-10 items-center justify-center rounded-xl bg-paper/20">
              <ShoppingBag className="size-5" />
              <span className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-paper text-xs font-bold text-brand-ink">{cart.count}</span>
            </span>
            <span className="flex-1 text-left text-base font-semibold">{t.viewOrder}</span>
            <span className="text-base font-bold tabular-nums">{money(cart.subtotal)}</span>
          </button>
        </BottomBar>
      )}
      {!desktop && cart.count === 0 && activeCount > 0 && (
        <BottomBar>
          <ActiveOrdersLink href={myOrdersHref} count={activeCount} className="mx-auto max-w-xl shadow-2xl" />
        </BottomBar>
      )}

      {!desktop && (
        <Modal
          initialFocus="panel"
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          title={t.yourOrder}
          description={menu.tableName}
          footer={cart.count > 0 ? <PlaceOrderButton form="cart-sheet-form" cart={cart} checkout={checkout} money={money} /> : undefined}
        >
          {cart.count === 0 ? <EmptyCart /> : <CartForm id="cart-sheet-form" menu={menu} cart={cart} checkout={checkout} money={money} />}
        </Modal>
      )}

      <ProductSheet
        selection={selected}
        money={money}
        ordering={menu.orderingEnabled}
        size={desktop ? 'lg' : 'md'}
        onClose={() => setSelected(null)}
        onAdd={(product, quantity, notes) => {
          cart.addMany(product, quantity, notes)
          setSelected(null)
        }}
      />

      <ReadyOverlay order={readyAlert} onClose={dismissReady} />
    </div>
  )
}

// ---------------------------------------------------------------- header

function MenuHero({ menu, device, myOrdersHref, activeOrders }: { menu: PublicMenu; device: Device; myOrdersHref: string | null; activeOrders: number }) {
  const { t } = useCustomerText()
  const phone = device === 'phone'

  return (
    <header>
      <CoverHero
        image={menu.coverImageUrl}
        width={device === 'desktop' ? 1800 : 1000}
        tone="sky"
        className={cn('rounded-b-[2rem] text-center', phone ? 'px-4 pt-3 pb-14' : 'px-6 pt-5 pb-16', device === 'desktop' && 'rounded-b-[2.5rem] pb-20')}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <LangSwitch />
          {myOrdersHref ? (
            <Link to={myOrdersHref} className="inline-flex h-10 items-center gap-2 rounded-full bg-paper pr-2 pl-4 text-sm font-semibold text-brand-ink shadow-md">
              <Receipt className="size-4" /> {t.myOrders}
              <span className={cn('flex size-6 items-center justify-center rounded-full text-xs font-bold', activeOrders ? 'bg-brand text-brand-fg' : 'bg-brand-soft')}>
                {activeOrders || <ChevronRight className="size-3.5" />}
              </span>
            </Link>
          ) : (
            <span />
          )}
        </div>

        <div className={phone ? 'mt-6' : 'mt-8'}>
          {menu.logoUrl ? (
            <img src={menu.logoUrl} alt={menu.restaurantName} className="mx-auto max-h-20" />
          ) : (
            <Logo size={phone ? 'md' : 'lg'} tone="light" align="center" />
          )}
        </div>
        {menu.description && <p className={cn('mx-auto mt-4 max-w-md text-paper/90', phone ? 'text-[15px]' : 'text-base')}>{menu.description}</p>}

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex h-10 items-center gap-2 rounded-full bg-paper px-4 text-[15px] font-bold text-brand-ink shadow-md">
            <UtensilsCrossed className="size-4" /> {menu.tableName}
          </span>
          <span className="inline-flex h-10 items-center gap-1.5 rounded-full border border-paper/45 bg-paper/15 px-4 text-sm font-medium text-paper backdrop-blur">
            <Clock className="size-4" /> {menu.openingTime} – {menu.closingTime}
          </span>
        </div>
      </CoverHero>
    </header>
  )
}

// ---------------------------------------------------------------- menu

function MenuBrowser({
  menu,
  device,
  money,
  quantityOf,
  onOpen,
  onAdd,
  onQuantity,
  aside,
}: {
  menu: PublicMenu
  device: Device
  money: Money
  quantityOf: (id: string) => number
  onOpen: (item: Item) => void
  onAdd: (product: PublicMenuProduct) => void
  onQuantity: (id: string, quantity: number) => void
  aside: ReactNode
}) {
  const { t } = useCustomerText()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(menu.categories[0]?.id ?? '')
  const sections = useRef(new Map<string, HTMLElement>())
  const chips = useRef<HTMLDivElement>(null)
  const desktop = device === 'desktop'
  const stickyOffset = desktop ? 24 : 76

  const featured = useMemo(
    () => menu.categories.flatMap((c) => c.products.filter((p) => p.isFeatured).map((p) => ({ product: p, icon: c.icon }))).slice(0, 8),
    [menu],
  )
  const search = query.trim().toLocaleLowerCase('tr')
  const results = useMemo(
    () =>
      search
        ? menu.categories.flatMap((c) =>
            c.products
              .filter((p) => `${p.name} ${p.description ?? ''} ${c.name}`.toLocaleLowerCase('tr').includes(search))
              .map((p) => ({ product: p, icon: c.icon })),
          )
        : [],
    [menu, search],
  )

  // Highlight the category of the section in view.
  useEffect(() => {
    if (search) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActive(visible.target.id.replace('cat-', ''))
      },
      { rootMargin: `-${stickyOffset + 40}px 0px -55% 0px` },
    )
    sections.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [menu, search, stickyOffset])

  // Keep the active chip visible in the horizontal chip row.
  useEffect(() => {
    const row = chips.current
    const chip = row?.querySelector<HTMLElement>(`[data-cat="${active}"]`)
    if (row && chip) row.scrollTo({ left: chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' })
  }, [active])

  const jump = (id: string) => {
    setActive(id)
    const el = sections.current.get(id)
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - stickyOffset + 2, behavior: 'smooth' })
  }

  /** Computer sidebar: picking a category also leaves the search results. */
  const selectCategory = (id: string) => {
    if (!search) return jump(id)
    setQuery('')
    setTimeout(() => jump(id), 50) // wait for the sections to render again
  }

  const tile = (item: Item, variant: 'row' | 'card' | 'featured') => (
    <ProductTile
      key={item.product.id}
      item={item}
      variant={variant}
      quantity={quantityOf(item.product.id)}
      money={money}
      ordering={menu.orderingEnabled}
      onOpen={() => onOpen(item)}
      onAdd={() => onAdd(item.product)}
      onQuantity={(q) => onQuantity(item.product.id, q)}
    />
  )
  const list = (items: Item[]) =>
    device === 'phone' ? (
      <div className="space-y-3">{items.map((i) => tile(i, 'row'))}</div>
    ) : (
      <div className={cn('grid gap-4', desktop ? 'grid-cols-2 xl:grid-cols-3' : 'grid-cols-2 md:grid-cols-3')}>{items.map((i) => tile(i, 'card'))}</div>
    )

  const searchBox = <SearchBox value={query} onChange={setQuery} />

  const content = (
    <>
      {!menu.orderingEnabled && (
        <p className="mt-6 rounded-2xl bg-brand-soft px-4 py-3.5 text-center text-base font-medium text-brand-ink">{t.orderingOff}</p>
      )}

      {search ? (
        <section className="mt-7" aria-live="polite">
          {results.length === 0 ? (
            <div className="rounded-3xl bg-paper px-6 py-14 text-center ring-1 ring-line">
              <Search className="mx-auto size-9 text-brand/60" />
              <p className="mt-3 text-lg font-medium text-ink">{t.noResults(query.trim())}</p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-base font-medium text-muted">{t.resultsFor(results.length, query.trim())}</p>
              {list(results)}
            </>
          )}
        </section>
      ) : (
        <>
          {featured.length > 0 && (
            <section className="mt-7">
              <h2 className="flex items-center gap-2 text-sm font-bold tracking-[0.2em] text-brand-ink uppercase">
                <Star className="size-4 fill-current" /> {t.favourites}
              </h2>
              <div className="no-scrollbar -mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 sm:gap-4">
                {featured.map((item) => (
                  <div key={item.product.id} className={cn('shrink-0 snap-start', device === 'phone' ? 'w-[74%] max-w-72' : 'w-72')}>
                    {tile(item, 'featured')}
                  </div>
                ))}
              </div>
            </section>
          )}

          {menu.categories.map((c) => (
            <section
              key={c.id}
              id={`cat-${c.id}`}
              ref={(el) => {
                if (el) sections.current.set(c.id, el)
                else sections.current.delete(c.id)
              }}
              className="mt-10"
            >
              <div className="mb-4 flex items-end justify-between gap-3">
                <h2 className="font-display text-[28px] leading-none font-semibold text-ink sm:text-3xl">
                  <span className="mr-2">{c.icon}</span>
                  {c.name}
                </h2>
                <span className="shrink-0 text-sm text-muted">{t.items(c.products.length)}</span>
              </div>
              {list(c.products.map((p) => ({ product: p, icon: c.icon })))}
            </section>
          ))}
        </>
      )}

      <footer className="mt-14 border-t border-line pt-6 text-center text-sm text-muted">{t.pricesNote(menu.taxRate, menu.restaurantName)}</footer>
    </>
  )

  if (desktop) {
    return (
      <div className="mx-auto grid max-w-7xl grid-cols-[220px_minmax(0,1fr)_370px] items-start gap-8 px-8">
        <aside className="sticky top-6 pt-10">
          <CategoryList menu={menu} active={search ? '' : active} onSelect={selectCategory} />
        </aside>
        <main className="min-w-0">
          <div className="relative z-10 -mt-7">{searchBox}</div>
          {content}
        </main>
        <aside className="sticky top-6 pt-10">{aside}</aside>
      </div>
    )
  }

  return (
    <>
      <div className="relative z-10 mx-auto -mt-7 max-w-5xl px-4">{searchBox}</div>
      {!search && (
        <nav className="sticky top-0 z-20 mt-4 border-b border-line bg-surface/95 backdrop-blur-md" aria-label={t.categories}>
          <div ref={chips} className="no-scrollbar mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-2.5">
            {menu.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                data-cat={c.id}
                onClick={() => jump(c.id)}
                aria-current={active === c.id ? 'true' : undefined}
                className={cn(
                  'h-11 shrink-0 rounded-full px-4 text-[15px] font-semibold whitespace-nowrap transition-colors',
                  active === c.id ? 'bg-brand text-brand-fg shadow-md shadow-brand/25' : 'bg-paper text-ink-800 ring-1 ring-line hover:ring-brand/40',
                )}
              >
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </nav>
      )}
      <main className="mx-auto max-w-5xl px-4">{content}</main>
    </>
  )
}

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useCustomerText()
  return (
    <label className="flex h-14 items-center gap-3 rounded-2xl bg-paper px-4 shadow-lg shadow-brand/10 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand">
      <Search className="size-5 shrink-0 text-brand" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.search}
        aria-label={t.search}
        enterKeyHint="search"
        className="h-full min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted/80 focus:outline-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="-mr-1 rounded-full p-2 text-muted hover:bg-surface hover:text-ink" aria-label={t.clearSearch}>
          <X className="size-5" />
        </button>
      )}
    </label>
  )
}

/** Computer layout: categories down the left side. */
function CategoryList({ menu, active, onSelect }: { menu: PublicMenu; active: string; onSelect: (id: string) => void }) {
  const { t } = useCustomerText()
  return (
    <nav aria-label={t.categories}>
      <p className="px-3 text-xs font-bold tracking-[0.2em] text-muted uppercase">{t.categories}</p>
      <ul className="mt-3 space-y-1">
        {menu.categories.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={active === c.id ? 'true' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium transition-colors',
                active === c.id ? 'bg-brand text-brand-fg shadow-md shadow-brand/20' : 'text-ink-800 hover:bg-paper',
              )}
            >
              <span className="text-lg leading-none">{c.icon}</span>
              <span className="flex-1 truncate">{c.name}</span>
              <span className={cn('text-xs tabular-nums', active === c.id ? 'text-brand-fg/80' : 'text-muted')}>{c.products.length}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-6 rounded-2xl bg-paper p-4 ring-1 ring-line">
        <p className="flex items-center gap-2 text-lg font-bold text-brand-ink">
          <UtensilsCrossed className="size-4" /> {menu.tableName}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
          <Clock className="size-3.5" /> {menu.openingTime} – {menu.closingTime}
        </p>
      </div>
    </nav>
  )
}

// ---------------------------------------------------------------- products

function ProductTile({
  item,
  variant,
  quantity,
  money,
  ordering,
  onOpen,
  onAdd,
  onQuantity,
}: {
  item: Item
  variant: 'row' | 'card' | 'featured'
  quantity: number
  money: Money
  ordering: boolean
  onOpen: () => void
  onAdd: () => void
  onQuantity: (q: number) => void
}) {
  const { t } = useCustomerText()
  const { product, icon } = item
  const controls =
    ordering && product.inStock ? <QuantityControl name={product.name} quantity={quantity} onAdd={onAdd} onChange={onQuantity} /> : null
  const soldOut = !product.inStock && (
    <span className="absolute inset-0 flex items-center justify-center bg-paper/65 text-xs font-bold tracking-[0.15em] text-ink uppercase">{t.soldOut}</span>
  )

  // Phone: a wide row — photo on the left, big text, the + button under the thumb.
  if (variant === 'row') {
    return (
      <article className={cn('flex gap-3.5 rounded-2xl bg-paper p-3 shadow-[var(--shadow-soft)] ring-1 transition-shadow', quantity ? 'ring-2 ring-brand' : 'ring-line', !product.inStock && 'opacity-70')}>
        <button type="button" onClick={onOpen} className="relative shrink-0 overflow-hidden rounded-xl" aria-label={t.details(product.name)}>
          <ProductImage src={product.imageUrl} name={product.name} icon={icon} width={112} className="size-28 text-2xl" />
          {product.isFeatured && (
            <span className="absolute top-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-brand text-brand-fg shadow" title={t.top}>
              <Star className="size-3 fill-current" />
            </span>
          )}
          {soldOut}
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <button type="button" onClick={onOpen} className="text-left">
            <h3 className="text-[17px] leading-snug font-semibold text-ink">{product.name}</h3>
            {product.description && <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted">{product.description}</p>}
          </button>
          <div className="mt-auto flex items-center justify-between gap-2 pt-2">
            <span className="text-[17px] font-bold text-brand-ink tabular-nums">{money(product.price)}</span>
            {controls}
          </div>
        </div>
      </article>
    )
  }

  // Tablet & computer: photo card.
  const featured = variant === 'featured'
  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-2xl bg-paper shadow-[var(--shadow-soft)] ring-1 transition-shadow hover:shadow-lg',
        quantity ? 'ring-2 ring-brand' : 'ring-line',
        !product.inStock && 'opacity-70',
      )}
    >
      <button type="button" onClick={onOpen} className="relative block text-left" aria-label={t.details(product.name)}>
        <ProductImage src={product.imageUrl} name={product.name} icon={icon} width={featured ? 440 : 380} zoom className="aspect-[4/3] w-full text-3xl" />
        {product.isFeatured && !featured && (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold tracking-wide text-brand-fg uppercase shadow">
            <Star className="size-3 fill-current" /> {t.top}
          </span>
        )}
        {soldOut}
      </button>
      <div className="flex flex-1 flex-col p-4">
        <button type="button" onClick={onOpen} className="text-left">
          <h3 className="text-lg leading-snug font-semibold text-ink">{product.name}</h3>
          {product.description && <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted">{product.description}</p>}
        </button>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <span className="text-lg font-bold text-brand-ink tabular-nums">{money(product.price)}</span>
          {controls}
        </div>
      </div>
    </article>
  )
}

function QuantityControl({ name, quantity, onAdd, onChange }: { name: string; quantity: number; onAdd: () => void; onChange: (q: number) => void }) {
  const { t } = useCustomerText()
  if (quantity === 0) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-fg shadow-md shadow-brand/30 transition-transform active:scale-90"
        aria-label={t.add(name)}
      >
        <Plus className="size-5" strokeWidth={2.5} />
      </button>
    )
  }
  return (
    <div className="flex h-11 shrink-0 items-center rounded-full bg-brand p-0.5 text-brand-fg shadow-md shadow-brand/30">
      <button type="button" onClick={() => onChange(quantity - 1)} className="flex size-10 items-center justify-center rounded-full hover:bg-paper/15" aria-label={t.decrease}>
        <Minus className="size-4" strokeWidth={2.5} />
      </button>
      <span className="w-6 text-center text-base font-bold tabular-nums" aria-live="polite">{quantity}</span>
      <button type="button" onClick={() => onChange(quantity + 1)} className="flex size-10 items-center justify-center rounded-full hover:bg-paper/15" aria-label={t.increase}>
        <Plus className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  )
}

/** Bottom sheet (phone) / dialog (tablet, computer) with the big photo, description, quantity and a kitchen note. */
function ProductSheet({
  selection,
  money,
  ordering,
  size,
  onClose,
  onAdd,
}: {
  selection: Item | null
  money: Money
  ordering: boolean
  size: 'md' | 'lg'
  onClose: () => void
  onAdd: (product: PublicMenuProduct, quantity: number, notes: string) => void
}) {
  const { t } = useCustomerText()
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [lastId, setLastId] = useState<string | null>(null)
  const product = selection?.product ?? null
  if ((product?.id ?? null) !== lastId) {
    setLastId(product?.id ?? null)
    setQuantity(1)
    setNotes('')
  }
  if (!selection || !product) return null
  const canOrder = ordering && product.inStock

  return (
    <Modal
      initialFocus="panel"
      open
      size={size}
      onClose={onClose}
      title={<span className="text-xl">{product.name}</span>}
      description={
        <span className="inline-flex items-center gap-1.5 text-sm">
          <Clock className="size-3.5" /> {t.prepTime(Math.max(product.preparationMinutes, 1))}
        </span>
      }
      footer={
        canOrder ? (
          <div className="flex w-full items-center gap-3">
            <div className="flex h-14 items-center rounded-full p-1 ring-1 ring-line">
              <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="flex size-12 items-center justify-center rounded-full hover:bg-surface" aria-label={t.decrease}>
                <Minus className="size-5" />
              </button>
              <span className="w-7 text-center text-lg font-bold tabular-nums">{quantity}</span>
              <button type="button" onClick={() => setQuantity((q) => Math.min(20, q + 1))} className="flex size-12 items-center justify-center rounded-full hover:bg-surface" aria-label={t.increase}>
                <Plus className="size-5" />
              </button>
            </div>
            <Button size="lg" className="flex-1 text-base" onClick={() => onAdd(product, quantity, notes)}>
              {t.addToCart(money(product.price * quantity))}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" size="lg" onClick={onClose}>{t.close}</Button>
        )
      }
    >
      <ProductImage
        src={product.imageUrl}
        name={product.name}
        icon={selection.icon}
        width={size === 'lg' ? 720 : 640}
        className="-mx-5 -mt-5 aspect-[16/10] text-5xl sm:-mx-6"
      />
      <div className="mt-5 flex items-start justify-between gap-4">
        <p className="text-base leading-relaxed text-ink-800">{product.description ?? t.freshlyPrepared}</p>
        <p className="shrink-0 text-2xl font-bold text-brand-ink tabular-nums">{money(product.price)}</p>
      </div>
      {canOrder && (
        <label className="mt-5 block">
          <span className="text-base font-semibold text-ink">{t.noteForKitchen}</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} placeholder={t.notePlaceholder} className={cn(fieldClass, 'mt-2 h-12')} />
        </label>
      )}
      {!product.inStock && <p className="mt-5 rounded-2xl bg-surface px-4 py-3 text-base text-muted">{t.soldOutToday}</p>}
    </Modal>
  )
}

// ---------------------------------------------------------------- order (cart)

function useCheckout(menu: PublicMenu, cart: Cart, onPlaced: (order: PublicOrderStatus) => void) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tax = Math.round(cart.subtotal * menu.taxRate) / 100
  const total = cart.subtotal + tax

  const place = async (e: FormEvent) => {
    e.preventDefault()
    if (cart.count === 0 || placing) return
    setPlacing(true)
    setError(null)
    try {
      const order = await publicMenuApi.placeOrder(menu.tableId, {
        customerName: name.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        items: cart.lines.map((l) => ({ productId: l.product.id, quantity: l.quantity, notes: l.notes.trim() || null })),
      })
      setNotes('')
      onPlaced(order)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setPlacing(false)
    }
  }

  return { name, setName, phone, setPhone, notes, setNotes, placing, error, tax, total, place }
}

type Checkout = ReturnType<typeof useCheckout>

function CartForm({ id, menu, cart, checkout, money }: { id: string; menu: PublicMenu; cart: Cart; checkout: Checkout; money: Money }) {
  const { t } = useCustomerText()
  return (
    <form id={id} onSubmit={checkout.place}>
      <ul className="-mt-2 divide-y divide-line">
        {cart.lines.map((l) => (
          <li key={l.product.id} className="py-3.5">
            <div className="flex items-center gap-3">
              <ProductImage src={l.product.imageUrl} name={l.product.name} width={112} className="size-14 shrink-0 rounded-xl text-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-ink">{l.product.name}</p>
                <p className="text-sm font-medium text-brand-ink tabular-nums">{money(l.product.price * l.quantity)}</p>
              </div>
              <div className="flex shrink-0 items-center rounded-full ring-1 ring-line">
                <button
                  type="button"
                  onClick={() => cart.setQuantity(l.product.id, l.quantity - 1)}
                  className="flex size-10 items-center justify-center rounded-full text-ink hover:bg-surface"
                  aria-label={l.quantity === 1 ? t.remove : t.decrease}
                >
                  {l.quantity === 1 ? <Trash2 className="size-4 text-danger" /> : <Minus className="size-4" />}
                </button>
                <span className="w-7 text-center text-base font-bold tabular-nums">{l.quantity}</span>
                <button type="button" onClick={() => cart.setQuantity(l.product.id, l.quantity + 1)} className="flex size-10 items-center justify-center rounded-full text-ink hover:bg-surface" aria-label={t.increase}>
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
            <input
              value={l.notes}
              onChange={(e) => cart.setNotes(l.product.id, e.target.value)}
              placeholder={t.lineNote}
              maxLength={200}
              aria-label={`${t.noteForKitchen} · ${l.product.name}`}
              className="mt-2.5 h-11 w-full rounded-xl bg-surface px-3.5 text-base text-ink placeholder:text-muted/70 focus:outline-2 focus:outline-brand"
            />
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-2.5">
        <input value={checkout.name} onChange={(e) => checkout.setName(e.target.value)} placeholder={t.yourName} maxLength={100} aria-label={t.yourName} autoComplete="name" className={cn(fieldClass, 'h-12')} />
        <input value={checkout.phone} onChange={(e) => checkout.setPhone(e.target.value)} type="tel" placeholder={t.phone} maxLength={30} aria-label={t.phone} autoComplete="tel" className={cn(fieldClass, 'h-12')} />
        <textarea value={checkout.notes} onChange={(e) => checkout.setNotes(e.target.value)} placeholder={t.orderNote} rows={2} maxLength={300} aria-label={t.orderNote} className={cn(fieldClass, 'resize-none py-3')} />
      </div>

      <dl className="mt-5 space-y-2 border-t border-line pt-4 text-base">
        <div className="flex justify-between"><dt className="text-muted">{t.subtotal}</dt><dd className="tabular-nums">{money(cart.subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">{t.tax(menu.taxRate)}</dt><dd className="tabular-nums">{money(checkout.tax)}</dd></div>
        <div className="flex justify-between border-t border-line pt-2.5 text-lg font-bold text-ink"><dt>{t.total}</dt><dd className="tabular-nums">{money(checkout.total)}</dd></div>
      </dl>
      <p className="mt-2 text-sm text-muted">{t.payAtTable}</p>

      {checkout.error && <p className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-base text-danger" role="alert">{checkout.error}</p>}
    </form>
  )
}

function PlaceOrderButton({ form, cart, checkout, money }: { form: string; cart: Cart; checkout: Checkout; money: Money }) {
  const { t } = useCustomerText()
  return (
    <Button type="submit" form={form} size="lg" className="w-full text-base font-semibold" loading={checkout.placing} disabled={cart.count === 0}>
      {t.placeOrder} · {money(checkout.total)}
    </Button>
  )
}

function EmptyCart() {
  const { t } = useCustomerText()
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
        <ShoppingBag className="size-7" />
      </span>
      <p className="mt-4 text-lg font-semibold text-ink">{t.emptyCart}</p>
      <p className="mt-1 text-base text-muted">{t.emptyCartHint}</p>
    </div>
  )
}

/** Computer layout: the order is always visible on the right. */
function CartPanel({ menu, cart, checkout, money }: { menu: PublicMenu; cart: Cart; checkout: Checkout; money: Money }) {
  const { t } = useCustomerText()
  return (
    <section className="flex max-h-[calc(100dvh-3rem)] flex-col overflow-hidden rounded-3xl bg-paper shadow-xl shadow-brand/10 ring-1 ring-line" aria-label={t.yourOrder}>
      <header className="flex items-center gap-3 border-b border-line px-5 py-4">
        <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          <ShoppingBag className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-ink">{t.yourOrder}</h2>
          <p className="text-sm text-muted">{menu.tableName}</p>
        </div>
        {cart.count > 0 && <span className="rounded-full bg-brand px-3 py-1 text-sm font-bold text-brand-fg tabular-nums">{cart.count}</span>}
      </header>

      {!menu.orderingEnabled ? (
        <p className="px-5 py-10 text-center text-base text-muted">{t.orderingOff}</p>
      ) : cart.count === 0 ? (
        <EmptyCart />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <CartForm id="cart-panel-form" menu={menu} cart={cart} checkout={checkout} money={money} />
          </div>
          <div className="border-t border-line px-5 py-4">
            <PlaceOrderButton form="cart-panel-form" cart={cart} checkout={checkout} money={money} />
          </div>
        </>
      )}
    </section>
  )
}

function ActiveOrdersLink({ href, count, className }: { href: string; count: number; className?: string }) {
  const { t } = useCustomerText()
  return (
    <Link to={href} className={cn('flex h-16 w-full items-center gap-3 rounded-2xl bg-paper px-4 text-ink ring-1 ring-brand/25', className)}>
      <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
        <ChefHat className="size-5" />
      </span>
      <span className="flex-1 text-base font-semibold">{t.inProgress(count)}</span>
      <span className="inline-flex items-center gap-0.5 text-base font-semibold text-brand-ink">
        {t.track} <ChevronRight className="size-4" />
      </span>
    </Link>
  )
}

function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-surface via-surface/85 to-transparent px-3 pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  )
}
