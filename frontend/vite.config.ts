import { networkInterfaces } from 'node:os'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const DEV_PORT = 5173

/** This computer's Wi-Fi/Ethernet IPv4 address, so phones on the same network can open QR menu links. */
function lanAddress(): string | null {
  const candidates: { name: string; address: string }[] = []
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) candidates.push({ name, address: net.address })
    }
  }
  // Prefer real adapters over virtual ones (Hyper-V, WSL, VirtualBox, VMware, Docker).
  const virtual = /vEthernet|WSL|VirtualBox|VMware|Docker|Loopback|Bluetooth/i
  return (candidates.find((c) => !virtual.test(c.name)) ?? candidates[0])?.address ?? null
}

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_DEV_API_PROXY ?? 'http://localhost:5080'
  const lan = command === 'serve' ? lanAddress() : null

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    define: {
      // Development only: base URL encoded in table QR codes when the portal is opened via localhost.
      'import.meta.env.VITE_LAN_ORIGIN': JSON.stringify(lan ? `http://${lan}:${DEV_PORT}` : ''),
    },
    server: {
      port: DEV_PORT,
      strictPort: true,
      // Listen on the local network too, so phones can open the QR menu.
      host: true,
      // In development the frontend calls /api/* on its own origin and Vite forwards it
      // to the ASP.NET Core API, so phones only need to reach this dev server.
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/hubs': { target: apiTarget, changeOrigin: true, ws: true },
      },
    },
  }
})
