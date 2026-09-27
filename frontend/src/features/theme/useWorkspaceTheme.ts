import { useLayoutEffect } from 'react'
import { workspaces, type Workspace } from '@/lib/permissions'

/**
 * Applies a workspace colour theme to the whole document (<html data-theme>), so dialogs and toasts
 * rendered outside the page tree are tinted too. Also colours the phone's browser bar.
 */
export function useWorkspaceTheme(theme: Workspace | null) {
  useLayoutEffect(() => {
    const root = document.documentElement
    if (theme) root.dataset.theme = theme
    else delete root.dataset.theme

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    meta.content = theme ? workspaces[theme].themeColor : '#000000'

    return () => {
      delete root.dataset.theme
    }
  }, [theme])
}
