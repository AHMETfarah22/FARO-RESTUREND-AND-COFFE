import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { imageSrcSet, sizedImage } from '@/lib/images'

interface CoverHeroProps {
  image: string | null | undefined
  children?: ReactNode
  className?: string
  /** Width to request from the image CDN. */
  width?: number
  /** Overlay strength: `strong` keeps white text readable on busy photos. */
  overlay?: 'soft' | 'strong'
  /** Fill the nearest positioned parent as a background layer instead of being a block of its own. */
  backdrop?: boolean
  /** `sky` is the light-blue customer look; `ink` the black & white staff look. */
  tone?: 'ink' | 'sky'
}

/**
 * Brand panel with the restaurant's cover photo behind it. The photo is covered with a gradient so text is
 * always readable: black for staff pages (black & white house style), light blue for customer pages.
 * Without a photo it is simply the solid panel.
 */
export function CoverHero({ image, children, className, width = 1600, overlay = 'strong', backdrop, tone = 'ink' }: CoverHeroProps) {
  const sky = tone === 'sky'
  const [loaded, setLoaded] = useState(false)
  const src = sizedImage(image, width)

  return (
    <div className={cn(backdrop ? 'absolute inset-0 -z-10' : 'relative', 'isolate overflow-hidden text-paper', sky ? 'bg-brand' : 'bg-ink-900', className)}>
      {src && (
        <img
          src={src}
          srcSet={imageSrcSet(image, width)}
          alt=""
          aria-hidden="true"
          onLoad={() => setLoaded(true)}
          className={cn(
            'absolute inset-0 -z-10 size-full object-cover transition-opacity duration-700',
            sky ? 'saturate-[.8]' : 'saturate-[.35]',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
      <div
        className={cn(
          'absolute inset-0 -z-10 bg-gradient-to-b',
          sky
            ? 'from-brand-ink/70 via-brand/60 to-brand/85'
            : overlay === 'strong'
              ? 'from-ink/70 via-ink/75 to-ink-900/95'
              : 'from-ink/40 via-ink/55 to-ink-900/85',
        )}
        aria-hidden="true"
      />
      {children}
    </div>
  )
}
