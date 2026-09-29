#!/usr/bin/env node
/*
 * FARO RESTURENT AND COFFE — license tool for the seller.
 *
 * Every installation shows a machine code on its activation screen. A license key is that code (plus the
 * customer's name and an optional expiry date) signed with the seller's private key. The API only knows the
 * public key (backend/src/FaroRestaurant.Infrastructure/Licensing/LicenseKey.cs), so nobody else can make keys.
 *
 *   node faro-license.mjs                 interactive wizard (Turkish) — what lisans-olustur.cmd runs
 *   node faro-license.mjs init            create the signing key pair (once)
 *   node faro-license.mjs create --customer "Lezzet Cafe" --machine ABCD-EFGH-JKMN-PQRS [--days 365 | --expires 2027-09-30]
 *   node faro-license.mjs verify <key>    show what a key contains and whether its signature is valid
 *   node faro-license.mjs machine         machine code of this computer
 *   node faro-license.mjs public-key      print the public key
 *
 * The private key lives outside the repository: %USERPROFILE%\.faro-license\faro-license-private.pem
 * (override with FARO_LICENSE_HOME). Back it up — without it no new keys can be made for installed copies.
 */
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign, verify } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, hostname, platform } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'

const HOME = process.env.FARO_LICENSE_HOME || join(homedir(), '.faro-license')
const PRIVATE_KEY = join(HOME, 'faro-license-private.pem')
const PUBLIC_KEY = join(HOME, 'faro-license-public.pem')
const LEDGER = join(HOME, 'issued-licenses.csv')
const PREFIX = 'FARO1'

// ---- encoding (identical to LicenseKey.cs) ---------------------------------------------------------

const b64url = (buffer) => Buffer.from(buffer).toString('base64url')
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** 16 Crockford base-32 characters from the first 10 bytes of SHA-256("FARO|" + machine id), as XXXX-XXXX-XXXX-XXXX. */
export function machineCodeFor(machineId) {
  const hash = createHash('sha256').update(`FARO|${machineId.trim().toLowerCase()}`).digest().subarray(0, 10)
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of hash) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  return out.match(/.{4}/g).join('-')
}

/** Accepts codes typed by hand: any case, spaces, missing dashes, O→0 and I/L→1. */
export function normalizeMachineCode(code) {
  if (code.trim() === '*') return '*'
  const clean = code.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
  if (clean.length !== 16 || [...clean].some((c) => !CROCKFORD.includes(c))) return null
  return clean.match(/.{4}/g).join('-')
}

function thisMachineId() {
  if (platform() === 'win32') {
    const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'], { encoding: 'utf8' })
    const match = /MachineGuid\s+REG_SZ\s+(\S+)/.exec(out)
    if (match) return match[1]
  }
  for (const file of ['/etc/machine-id', '/var/lib/dbus/machine-id']) if (existsSync(file)) return readFileSync(file, 'utf8')
  return hostname()
}

// ---- keys --------------------------------------------------------------------------------------------

function loadPrivateKey() {
  if (!existsSync(PRIVATE_KEY)) throw new Error(`Signing key not found: ${PRIVATE_KEY}\nRun "node faro-license.mjs init" once (or restore your backup).`)
  return createPrivateKey(readFileSync(PRIVATE_KEY, 'utf8'))
}

function init() {
  if (existsSync(PRIVATE_KEY)) throw new Error(`A signing key already exists: ${PRIVATE_KEY}\nIt was not replaced — keys made with it would stop working.`)
  mkdirSync(HOME, { recursive: true })
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  writeFileSync(PRIVATE_KEY, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
  writeFileSync(PUBLIC_KEY, publicKey.export({ type: 'spki', format: 'pem' }))
  console.log(`Created ${PRIVATE_KEY}\nKeep it secret and back it up. Public key (goes into LicenseKey.cs):\n`)
  console.log(publicKey.export({ type: 'spki', format: 'pem' }))
}

// ---- licenses -----------------------------------------------------------------------------------------

const today = () => new Date().toISOString().slice(0, 10)

function addDays(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function createLicense({ customer, machine, expires }) {
  const code = normalizeMachineCode(machine)
  if (!code) throw new Error(`Invalid machine code: "${machine}" (expected XXXX-XXXX-XXXX-XXXX)`)
  if (!customer?.trim()) throw new Error('Customer name is required.')
  if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) throw new Error(`Invalid expiry date: "${expires}" (expected YYYY-MM-DD)`)

  const payload = { v: 1, id: `L-${randomBytes(4).toString('hex').toUpperCase()}`, customer: customer.trim(), machine: code, issued: today(), expires: expires || null }
  const body = b64url(JSON.stringify(payload))
  const signature = sign('sha256', Buffer.from(body, 'ascii'), { key: loadPrivateKey(), dsaEncoding: 'ieee-p1363' })
  const key = `${PREFIX}.${body}.${b64url(signature)}`

  mkdirSync(HOME, { recursive: true })
  if (!existsSync(LEDGER)) appendFileSync(LEDGER, 'issued;license id;customer;machine code;expires;key\n')
  appendFileSync(LEDGER, `${payload.issued};${payload.id};${payload.customer.replace(/;/g, ',')};${code};${payload.expires ?? 'never'};${key}\n`)
  return { key, payload }
}

export function inspectLicense(key) {
  const [prefix, body, signature] = key.replace(/\s+/g, '').split('.')
  if (prefix !== PREFIX || !body || !signature) return { valid: false, reason: 'Not a FARO license key.' }
  const publicKey = existsSync(PUBLIC_KEY) ? createPublicKey(readFileSync(PUBLIC_KEY, 'utf8')) : createPublicKey(loadPrivateKey())
  const valid = verify('sha256', Buffer.from(body, 'ascii'), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url'))
  let payload = null
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return { valid: false, reason: 'The key is damaged (incomplete copy?).' }
  }
  return { valid, payload }
}

// ---- command line ---------------------------------------------------------------------------------------

function option(args, name) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

function printLicense({ key, payload }) {
  console.log(`\nMüşteri / Customer : ${payload.customer}`)
  console.log(`Makine kodu        : ${payload.machine}`)
  console.log(`Lisans no          : ${payload.id}`)
  console.log(`Bitiş / Expires    : ${payload.expires ?? 'süresiz / never'}`)
  console.log(`\n${key}\n`)
}

async function wizard() {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    console.log('\nFARO — lisans oluştur\n')
    if (!existsSync(PRIVATE_KEY)) {
      console.log(`İmza anahtarı bulunamadı: ${PRIVATE_KEY}\nYedeğinizi bu konuma geri koyun ya da ilk kurulumsa "node faro-license.mjs init" çalıştırın.`)
      return
    }
    const customer = (await rl.question('Müşteri / restoran adı: ')).trim()
    let machine = null
    while (!machine) {
      machine = normalizeMachineCode(await rl.question('Makine kodu (müşterinin ekranındaki XXXX-XXXX-XXXX-XXXX): '))
      if (!machine) console.log('  Geçersiz kod, tekrar deneyin.')
    }
    const answer = (await rl.question('Kaç gün geçerli olsun? (boş bırakın = süresiz): ')).trim()
    const days = answer === '' ? null : Number(answer)
    if (days !== null && !(Number.isInteger(days) && days > 0)) throw new Error('Gün sayısı pozitif bir tam sayı olmalı.')

    const license = createLicense({ customer, machine, expires: days ? addDays(days) : null })
    printLicense(license)
    if (platform() === 'win32') {
      execFileSync('clip', { input: license.key })
      console.log('Anahtar panoya kopyalandı — müşteriye gönderin (WhatsApp, e-posta...).')
    }
    console.log(`Kayıt: ${LEDGER}`)
  } finally {
    rl.close()
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  switch (command) {
    case undefined:
    case 'wizard':
      return wizard()
    case 'init':
      return init()
    case 'create':
      return printLicense(
        createLicense({
          customer: option(args, 'customer'),
          machine: option(args, 'machine') ?? '',
          expires: option(args, 'expires') ?? (option(args, 'days') ? addDays(Number(option(args, 'days'))) : null),
        }),
      )
    case 'verify': {
      const result = inspectLicense(args.join(''))
      console.log(result.valid ? 'Signature: VALID' : `Signature: INVALID${result.reason ? ` (${result.reason})` : ''}`)
      if (result.payload) console.log(result.payload)
      return
    }
    case 'machine':
      return console.log(machineCodeFor(thisMachineId()))
    case 'public-key':
      return console.log(readFileSync(PUBLIC_KEY, 'utf8'))
    default:
      throw new Error(`Unknown command "${command}". See the header of this file.`)
  }
}

main().catch((error) => {
  console.error(`\n${error.message}\n`)
  process.exitCode = 1
})
