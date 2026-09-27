import { Clock, Mail, MapPin, Percent, Phone } from 'lucide-react'
import { CoverHero } from '@/components/brand/CoverHero'
import { Logo } from '@/components/brand/Logo'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/Layout'
import { LoadingState } from '@/components/ui/States'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { RestaurantForm } from './RestaurantForm'

export function RestaurantPage() {
  const { restaurant } = useRestaurant()
  if (!restaurant) return <LoadingState />

  return (
    <>
      <PageHeader title="Restaurant" description="Your restaurant's public information, opening hours, currency and tax." />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="overflow-hidden">
          <CoverHero image={restaurant.coverImageUrl} width={800} className="flex flex-col items-center px-6 py-14">
            {restaurant.logoUrl ? (
              <img src={restaurant.logoUrl} alt={restaurant.name} className="max-h-24 object-contain" />
            ) : (
              <Logo tone="light" align="center" />
            )}
          </CoverHero>
          <ul className="space-y-4 p-6 text-sm">
            <Info icon={<Phone className="size-4" />} label="Phone" value={restaurant.phone} />
            <Info icon={<Mail className="size-4" />} label="Email" value={restaurant.email} />
            <Info icon={<MapPin className="size-4" />} label="Address" value={restaurant.address} />
            <Info icon={<Clock className="size-4" />} label="Opening hours" value={`${restaurant.openingTime} – ${restaurant.closingTime}`} />
            <Info icon={<Percent className="size-4" />} label="Tax · Currency" value={`${restaurant.taxRate}% · ${restaurant.currency}`} />
          </ul>
          {restaurant.description && <p className="border-t border-line px-6 py-5 text-sm text-muted">{restaurant.description}</p>}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Restaurant information" description="Changes apply immediately across the portal and QR menu." />
          <div className="p-6">
            <RestaurantForm key={restaurant.id} restaurant={restaurant} />
          </div>
        </Card>
      </div>
    </>
  )
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface text-ink">{icon}</span>
      <span>
        <span className="block text-xs text-muted">{label}</span>
        <span className="block text-ink">{value || '—'}</span>
      </span>
    </li>
  )
}
