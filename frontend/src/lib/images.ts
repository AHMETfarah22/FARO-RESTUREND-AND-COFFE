/**
 * Returns an image URL sized for how it is displayed. Unsplash (and other imgix-style CDNs) resize on the
 * fly via the `w` parameter, so thumbnails don't download full-size photos. Other URLs are returned unchanged.
 */
export function sizedImage(url: string | null | undefined, width: number): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'images.unsplash.com') {
      parsed.searchParams.set('w', String(Math.round(width)))
      parsed.searchParams.set('auto', 'format')
      if (!parsed.searchParams.has('fit')) parsed.searchParams.set('fit', 'crop')
      if (!parsed.searchParams.has('q')) parsed.searchParams.set('q', '75')
      return parsed.toString()
    }
  } catch {
    /* not an absolute URL — use as is */
  }
  return url
}

/** 1x/2x srcset for sharp images on retina phones. */
export function imageSrcSet(url: string | null | undefined, width: number): string | undefined {
  const one = sizedImage(url, width)
  const two = sizedImage(url, width * 2)
  return one && two && one !== two ? `${one} 1x, ${two} 2x` : undefined
}
