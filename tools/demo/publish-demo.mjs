#!/usr/bin/env node
/*
 * FARO RESTURENT AND COFFE — publishes the live demo.
 *
 * The portal's source stays in its private repository; only the built demo (static files, API running in the
 * browser) goes to a separate public repository that GitHub Pages serves for free:
 *   https://<owner>.github.io/<repo>/
 * Each run builds the demo and force-pushes it to that repository's main branch (only the latest build is kept).
 *
 *   node tools/demo/publish-demo.mjs [--repo faro-demo] [--owner <github user>] [--contact https://wa.me/90…] [--message "…"] [--dry-run]
 *
 * --dry-run builds and prepares the files but does not push; the folder is kept and printed.
 *
 * One-time setup on GitHub: create the empty public repository, and after the first run
 * Settings → Pages → Build and deployment → "Deploy from a branch" → main / (root) → Save.
 */
import { execFileSync, execSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const frontend = join(root, 'frontend')

const option = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback
}

const origin = execFileSync('git', ['-C', root, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()
const owner = option('owner', /github\.com[/:]([^/]+)\//.exec(origin)?.[1])
const repo = option('repo', 'faro-demo')
const contact = option('contact', process.env.DEMO_CONTACT_URL ?? '')
const message = option('message', `Demo güncellemesi ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`)
const dryRun = process.argv.includes('--dry-run')
if (!owner) throw new Error(`GitHub kullanıcı adı bulunamadı (origin: ${origin}). --owner ile verin.`)

const site = `https://${owner.toLowerCase()}.github.io/${repo}/`
console.log(`\nDemo derleniyor → ${site}\n`)

if (!existsSync(join(frontend, 'node_modules'))) execSync('npm ci', { cwd: frontend, stdio: 'inherit' })
execSync('npm run build:demo', {
  cwd: frontend,
  stdio: 'inherit',
  env: { ...process.env, VITE_BASE_PATH: `/${repo}/`, VITE_DEMO_CONTACT_URL: contact },
})

const work = mkdtempSync(join(tmpdir(), 'faro-demo-'))
try {
  cpSync(join(frontend, 'dist'), work, { recursive: true })
  // Deep links (a table's QR menu, /dashboard …) are answered by the single-page app via the 404 page.
  cpSync(join(work, 'index.html'), join(work, '404.html'))
  writeFileSync(join(work, '.nojekyll'), '')
  writeFileSync(
    join(work, 'README.md'),
    [
      '# FARO RESTURENT AND COFFE — Canlı Demo',
      '',
      'Restoran ve kafe yönetim sistemi FARO\'nun tarayıcıda çalışan canlı demosu:',
      '',
      `**${site}**`,
      '',
      'Demo tamamen tarayıcınızda çalışır: verileriniz kimseyle paylaşılmaz ve örnek veriler her gün yenilenir.',
      'Bu depo yalnızca demonun derlenmiş dosyalarını içerir.',
      '',
    ].join('\n'),
  )

  if (dryRun) {
    console.log(`\nDeneme: gönderilmedi. Dosyalar: ${work}\n`)
    process.exit(0)
  }

  const git = (...args) => execFileSync('git', args, { cwd: work, stdio: 'inherit' })
  git('init', '--quiet', '--initial-branch=main')
  git('add', '--all')
  git('commit', '--quiet', '-m', message)
  console.log(`\nGitHub'a gönderiliyor: ${owner}/${repo}`)
  git('push', '--force', `https://github.com/${owner}/${repo}.git`, 'HEAD:main')
} finally {
  if (!dryRun) rmSync(work, { recursive: true, force: true })
}

console.log(`\nYayınlandı. Birkaç dakika içinde açılır: ${site}`)
console.log(`İlk yayınsa: github.com/${owner}/${repo} → Settings → Pages → "Deploy from a branch" → main / (root) → Save.\n`)
