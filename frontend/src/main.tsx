import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from '@/app/router'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { ToastProvider } from '@/components/ui/Toast'
import { AuthProvider } from '@/features/auth/AuthContext'
import { LicenseGate } from '@/features/license/LicenseGate'
import './index.css'

async function start() {
  // Demo build (GitHub Pages): the API runs in the browser. `MODE` is fixed at build time, so the normal
  // build drops this branch and the demo code with it.
  const demo = import.meta.env.MODE === 'demo'
  let DemoPanel: ComponentType | null = null
  if (demo) {
    const module = await import('@/demo')
    module.installDemo()
    DemoPanel = module.DemoPanel
  }

  const portal = (
    <AuthProvider>
      <RouterProvider router={router} />
      {DemoPanel && <DemoPanel />}
    </AuthProvider>
  )

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ToastProvider>
        {/* A real installation must be activated (license key) and set up before the portal opens. */}
        <ConfirmProvider>{demo ? portal : <LicenseGate>{portal}</LicenseGate>}</ConfirmProvider>
      </ToastProvider>
    </StrictMode>,
  )
}

void start()
