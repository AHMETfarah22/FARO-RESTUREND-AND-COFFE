/** Helpers shared by the role home pages (WorkspaceHero). */
import { formatLongDate } from '@/lib/format'
import { translate } from '@/lib/i18n'

/** Buttons for use inside the hero. */
export const heroPrimary = 'inline-flex h-10 items-center gap-2 rounded-xl bg-paper px-4 text-sm font-semibold text-sidebar hover:bg-paper/90'
export const heroSecondary = 'inline-flex h-10 items-center gap-2 rounded-xl border border-paper/30 bg-sidebar/40 px-4 text-sm font-medium text-paper backdrop-blur hover:bg-paper/15'

export function greeting(date = new Date()) {
  const h = date.getHours()
  return translate(h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening')
}

export function todayLabel(date = new Date()) {
  return formatLongDate(date)
}
