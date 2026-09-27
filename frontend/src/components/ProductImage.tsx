import { useState } from 'react'
import { cn } from '@/lib/cn'
import { imageSrcSet, sizedImage } from '@/lib/images'

interface ProductImageProps {
  src: string | null
  name: string
  className?: string
  icon?: string | null
  /** Rendered width in CSS pixels — used to request a right-sized photo. */
  width?: number
  /** Gentle zoom when a parent `.group` is hovered. */
  zoom?: boolean
}

/** Product photo that fades in once loaded, with an elegant monochrome placeholder when missing or broken. */
export function ProductImage({ src, name, className, icon, width = 400, zoom }: ProductImageProps) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  if (src && !failed) {
    return (
      <div className={cn('relative overflow-hidden bg-surface', className)}>
        <img
          src={sizedImage(src, width) ?? src}
          srcSet={imageSrcSet(src, width)}
          alt={name}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            'absolute inset-0 size-full object-cover transition-[opacity,transform] duration-500',
            loaded ? 'opacity-100' : 'opacity-0',
            zoom && 'group-hover:scale-105',
          )}
        />
        {!loaded && <div className="absolute inset-0 animate-pulse bg-line/60" aria-hidden="true" />}
      </div>
    )
  }

  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className={cn('flex items-center justify-center bg-gradient-to-br from-surface to-line/80 text-ink/70', className)} aria-label={name} role="img">
      {icon ? <span className="text-[2.2em] leading-none">{icon}</span> : <span className="font-display text-[1.6em] font-semibold">{initials}</span>}
    </div>
  )
}
