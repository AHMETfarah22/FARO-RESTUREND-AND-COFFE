import { useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChefHat,
  ExternalLink,
  Globe,
  Laptop,
  LayoutGrid,
  MessageCircle,
  Package,
  QrCode,
  ShieldCheck,
  Users,
  Wallet,
  Wifi,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { CoverHero } from '@/components/brand/CoverHero'
import { Logo } from '@/components/brand/Logo'
import { LangToggle } from '@/components/LangToggle'
import { env } from '@/config/env'
import { useAuth } from '@/features/auth/AuthContext'
import { demoCustomerAccount, testAccounts, type TestAccount } from '@/features/auth/testAccounts'
import { useAsync } from '@/hooks/useAsync'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/cn'
import { restaurantApi } from '@/lib/endpoints'
import { useI18n } from '@/lib/i18n'
import { roleLabel } from '@/lib/labels'
import { homePathFor, workspaceFor, workspaces } from '@/lib/permissions'
import { db } from '@/demo/db'

const features = [
  { icon: QrCode, title: 'QR menu ordering', text: 'Guests scan the QR code on the table, order from their own phone and are notified when the food is ready.' },
  { icon: ChefHat, title: 'Kitchen display', text: 'New orders reach the kitchen screen instantly, with waiting times and one-tap status updates.' },
  { icon: LayoutGrid, title: 'Tables and service', text: 'A live floor plan shows every table: available, occupied, reserved or being cleaned.' },
  { icon: Wallet, title: 'Cash desk and payments', text: 'Cash, card or online payments with receipts. A table becomes available as soon as its bill is paid.' },
  { icon: CalendarDays, title: 'Reservations', text: 'Calendar of bookings with guest details, party size and table assignment.' },
  { icon: Package, title: 'Stock tracking', text: 'Ingredients and supplies with minimum levels; low stock is flagged on the dashboard.' },
  { icon: BarChart3, title: 'Reports', text: 'Daily revenue, popular products and category sales, exported as PDF, Excel or CSV.' },
  { icon: Users, title: 'Staff and roles', text: 'Every role has its own screen and permissions, so everyone sees only their own work.' },
] as const

const roleIntros: Record<string, string> = {
  SuperAdmin: 'Everything: restaurant settings, staff, menu, reports.',
  Manager: 'Dashboard, orders, menu, stock and reports.',
  Waiter: 'Floor plan, taking orders, serving tables.',
  Kitchen: 'Full-screen kitchen display of incoming orders.',
  Cashier: 'Open bills, taking payments, receipts.',
  Customer: 'Own order history and reorders.',
}

const accounts: TestAccount[] = [...testAccounts, demoCustomerAccount]

/**
 * Product page of the public demo (GitHub Pages): what FARO does, one-click sign-in for every role,
 * the guest QR menu and the seller's contact button. The installed portal opens on the login page instead.
 */
export function LandingPage() {
  const { t } = useI18n()
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const { data: brand } = useAsync((signal) => restaurantApi.publicInfo(signal))
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const signInAs = async (account: TestAccount) => {
    setBusy(account.email)
    setError(null)
    try {
      const signedIn = await login(account.email, account.password)
      navigate(homePathFor(signedIn.roles))
    } catch (err) {
      setError(getErrorMessage(err))
      setBusy(null)
    }
  }

  const openMenu = () => {
    const table = [...db().tables].sort((a, b) => a.number - b.number)[0]
    if (table) window.open(`${import.meta.env.BASE_URL}menu/table/${table.id}`, '_blank', 'noopener')
  }

  const contact = env.demoContactUrl
  const primaryCta = 'inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold transition-colors'

  return (
    <div className="min-h-dvh bg-paper text-ink">
      {/* ---- hero ---- */}
      <CoverHero image={brand?.coverImageUrl} className="px-4 pt-5 pb-16 sm:px-8 sm:pb-24">
        <header className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Logo tone="light" />
          <div className="flex items-center gap-2">
            <LangToggle tone="light" />
            {user ? (
              <Link to={homePathFor(user.roles)} className="hidden rounded-full bg-paper px-4 py-2 text-xs font-semibold text-ink sm:inline-flex">
                {t('Go to my panel')}
              </Link>
            ) : (
              <Link to="/login" className="hidden rounded-full bg-paper px-4 py-2 text-xs font-semibold text-ink sm:inline-flex">
                {t('Sign in')}
              </Link>
            )}
          </div>
        </header>

        <div className="mx-auto mt-16 max-w-6xl sm:mt-24">
          <p className="text-xs font-semibold tracking-[0.3em] text-paper/70 uppercase">{t('Restaurant & café management system')}</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.05] font-semibold sm:text-6xl">{t('Run your whole restaurant from one screen.')}</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-paper/80 sm:text-lg">
            {t('Orders, kitchen display, QR menu, cash desk, tables, stock and reports — in Turkish and English, on phone, tablet and computer.')}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#demo" className={cn(primaryCta, 'bg-paper text-ink hover:bg-surface')}>
              {t('Try the live demo')} <ArrowRight className="size-4" />
            </a>
            <button type="button" onClick={openMenu} className={cn(primaryCta, 'bg-paper/10 text-paper ring-1 ring-paper/40 backdrop-blur hover:bg-paper/20')}>
              <QrCode className="size-4" /> {t('Open the guest QR menu')}
            </button>
          </div>
          <p className="mt-4 text-xs text-paper/60">{t('Free to try · no sign-up · nothing to install')}</p>
        </div>
      </CoverHero>

      {/* ---- highlights ---- */}
      <section className="border-b border-line bg-surface px-4 sm:px-8">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px py-6 text-sm sm:grid-cols-4">
          {[
            { icon: Laptop, text: 'Phone, tablet and computer' },
            { icon: Globe, text: 'Turkish and English' },
            { icon: Wifi, text: 'Runs on your own network' },
            { icon: ShieldCheck, text: 'Your data stays with you' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2.5 px-2 py-2">
              <Icon className="size-5 shrink-0" />
              <span className="font-medium">{t(text)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---- features ---- */}
      <section className="px-4 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-2xl font-display text-3xl font-semibold sm:text-4xl">{t('Everything your team needs, in one place')}</h2>
          <p className="mt-3 max-w-2xl text-muted">{t('From the first order at the table to the end-of-day report, every step is connected and updates live.')}</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-line p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-ink-900 text-paper">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">{t(title)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(text)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- live demo: one click per role ---- */}
      <section id="demo" className="scroll-mt-4 bg-ink-900 px-4 py-16 text-paper sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">{t('Try every role')}</h2>
          <p className="mt-3 max-w-2xl text-paper/70">
            {t('Pick a role to sign in with one click. Each role opens its own screen. Your changes stay in this browser only.')}
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => {
              const workspace = workspaces[workspaceFor([a.role])]
              return (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => void signInAs(a)}
                  disabled={!!busy}
                  className={cn(
                    'group flex items-center gap-4 rounded-2xl bg-paper/5 p-4 text-left ring-1 ring-paper/15 transition-colors hover:bg-paper/10 disabled:cursor-wait',
                    busy === a.email && 'animate-pulse',
                  )}
                >
                  <span className="h-12 w-1.5 shrink-0 rounded-full" style={{ background: workspace.accent }} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{roleLabel(a.role)}</span>
                    <span className="mt-0.5 block text-sm text-paper/60">{t(roleIntros[a.role])}</span>
                  </span>
                  <ArrowRight className="size-5 shrink-0 text-paper/40 transition-transform group-hover:translate-x-1 group-hover:text-paper" />
                </button>
              )
            })}
          </div>
          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
          <button type="button" onClick={openMenu} className="mt-6 flex items-start gap-2 text-left text-sm font-medium text-paper/80 underline-offset-4 hover:text-paper hover:underline">
            <QrCode className="mt-0.5 size-4 shrink-0" /> {t('Or open the guest QR menu in a new tab — orders placed there reach the kitchen live.')}
            <ExternalLink className="mt-0.5 size-3.5 shrink-0" />
          </button>
        </div>
      </section>

      {/* ---- for restaurant owners ---- */}
      <section className="px-4 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">{t('How it works in your restaurant')}</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              ['Installation', 'FARO is installed on a computer in your restaurant and set up with your menu, tables and staff.'],
              ['Every device', 'Waiters, the kitchen and the cash desk connect over the restaurant Wi-Fi; guests order through the QR codes.'],
              ['Licence', 'Activated with a licence key for your restaurant — lifetime or as a subscription. Updates are included.'],
            ].map(([title, text], i) => (
              <li key={title} className="rounded-2xl bg-surface p-6">
                <span className="font-display text-4xl font-semibold text-ink/25">0{i + 1}</span>
                <h3 className="mt-3 font-semibold">{t(title)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(text)}</p>
              </li>
            ))}
          </ol>

          <div className="mt-12 flex flex-col items-start justify-between gap-6 rounded-3xl bg-ink-900 p-8 text-paper sm:flex-row sm:items-center sm:p-10">
            <div>
              <h3 className="font-display text-2xl font-semibold sm:text-3xl">{t('Want FARO in your restaurant?')}</h3>
              <p className="mt-2 text-paper/70">{t('Get in touch for a price offer and installation.')}</p>
            </div>
            {contact ? (
              <a href={contact} target="_blank" rel="noreferrer" className={cn(primaryCta, 'shrink-0 bg-paper text-ink hover:bg-surface')}>
                <MessageCircle className="size-4" /> {t('Contact us')}
              </a>
            ) : (
              <a href="#demo" className={cn(primaryCta, 'shrink-0 bg-paper text-ink hover:bg-surface')}>
                {t('Try the live demo')} <ArrowRight className="size-4" />
              </a>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-line px-4 py-8 text-center text-xs text-muted sm:px-8">
        © {new Date().getFullYear()} FARO RESTURENT AND COFFE · {t('Live demo — sample data, renewed every day.')}
      </footer>
    </div>
  )
}
