# FARO RESTURENT AND COFFE

Restaurant & coffee shop management portal: admin dashboard, QR table menus, real-time kitchen display,
reservations, customers, staff, inventory, simulated payments and reports.

> **Status:** complete build with a [live browser demo](#live-demo-github-pages), [license activation](#licensing) and a
> [one-folder installation package](#customer-installation-package) for customers' computers.

## Quick start (Windows)

1. PostgreSQL running on `localhost:5432`, with the password set in `backend/.env`.
2. Double-click **`start.cmd`**. It starts the API and the web app, then opens <http://localhost:5173>.
3. First time on a computer: the portal shows **Activate FARO** with this computer's machine code. Double-click
   **`lisans-olustur.cmd`**, enter a name and that code, and paste the key it prints (see [Licensing](#licensing)).

On first start the API creates the `faro_restaurant` database, applies migrations and loads the test data.

## Test accounts (development only)

| Role          | Email                 | Password        | Lands on (workspace · colour)          |
| ------------- | --------------------- | --------------- | -------------------------------------- |
| Super Admin   | `admin@example.com`   | `Admin@12345`   | Dashboard (Yönetim · black & gold)     |
| Manager       | `manager@example.com` | `Manager@12345` | Dashboard (Müdür Paneli · indigo)      |
| Waiter        | `waiter@example.com`  | `Waiter@12345`  | `/service` (Servis · emerald)          |
| Kitchen Staff | `kitchen@example.com` | `Kitchen@12345` | `/kitchen` (Mutfak · ember orange)     |
| Cashier       | `cashier@example.com` | `Cashier@12345` | `/cash-desk` (Kasa · plum)             |
| Customer      | self-registered       |                 | `/my-orders` (light blue & white)      |

A second waiter (`waiter2@example.com`, same password) is also seeded. Customers can self-register at `/register`.
In development the login page has one-click buttons for these accounts. They are **seeded only in development**
(`Database:SeedOnStartup`) and must never exist in production. The live demo has the same accounts plus a customer
(`customer@example.com` / `Customer@12345`) and signs in with one click.

**Seed data:** 1 restaurant, 10 tables, 8 categories, 30 products, 5 customers, 5 staff, 20 orders (14 past + 6 live
today for the kitchen), 10 reservations, 12 inventory items (3 low stock) and notifications.

## Features

| Area | Page(s) | Highlights |
| --- | --- | --- |
| Authentication | `/login`, `/register` | JWT, hashed passwords, lockout after 5 failures, role-based home page |
| Dashboard | `/dashboard` | Today's sales/orders (vs yesterday), pending/completed, reservations, tables, low stock, 7-day charts, popular products, category sales — live |
| Restaurant | `/restaurant` | Name, logo, contact, hours, currency, tax |
| Tables & QR | `/tables`, `/tables/:id/qr`, `/qr-codes` | Live status (Available/Occupied/Reserved/Cleaning/Disabled), printable/downloadable QR per table |
| Waiter workspace | `/service` | Plates ready to serve (with chime), QR orders to accept, live floor plan, today's reservations |
| Cashier workspace | `/cash-desk` | Open bills (served first), one-tap payment, paid orders to close, today's takings by method |
| QR menu | `/menu/table/:tableId` | Public, light blue & white, **Türkçe / English** switch. Separate layouts: phone (large list rows, sticky categories, bottom cart bar), tablet (card grid) and computer (categories | menu | always-visible order panel). Search, featured items, notes per dish |
| Customer "My orders" | `/menu/orders` | Every order placed from this phone with live progress; "your order is ready" alert and phone notification |
| Menu | `/categories`, `/products` | Icons, sort order, visibility; products with SKU, stock tracking, availability, featured, prep time, images |
| Orders | `/orders`, `/orders/pending`, `/orders/preparing`, `/orders/completed`, `/orders/new`, `/orders/:id` | POS-style order entry, status workflow, edit before preparation, printable receipt |
| Kitchen | `/kitchen` | Separate full-screen display: NEW → PREPARING → READY → COMPLETED, big buttons, timers, sound |
| Reservations | `/reservations` | List + month calendar, table capacity & double-booking checks, arrival seats the table |
| Customers | `/customers`, `/customers/:id` | Orders, spending, last order, order history, reservations |
| Staff | `/staff` | Create accounts, change role, deactivate, reset password |
| Inventory | `/inventory` | Stock in/out/count with history, minimum levels, LOW STOCK alerts |
| Payments | `/payments` + order page | Simulated Cash/Card/Online/Test, declined-payment simulation, refunds, unpaid queue. **The masa becomes Available the moment its bill is fully paid** |
| Reports | `/reports` | Date range + daily/weekly/monthly/yearly, 8 KPIs, charts, export **PDF / Excel / CSV** |
| Notifications | `/notifications` + top-bar bell | New order, reservation, low stock, payment, system — real time via SignalR |
| Settings | `/settings` | Restaurant, profile & password, users, roles matrix, tax & currency, orders, notifications, QR, payments, system |

### Real-time flow

```text
Customer (QR menu) → POST /api/menu/tables/{id}/orders → PostgreSQL
   → SignalR hub (/hubs/restaurant) → Kitchen Display + staff dashboards + notification bell
   → kitchen status changes → SignalR → customer's order-status screen
```

### Roles, duties and workspaces

Every role has its own home page, its own menu (only the tools for its job) and its own colour, so each person
immediately sees which workspace they are in. The order workflow is split by duty and **enforced by the API**:

| Step | Who may do it |
| --- | --- |
| Accept an order (Pending → Confirmed) | Waiter, Kitchen |
| Start cooking / mark ready | Kitchen |
| Mark served | Waiter |
| Take payment / close the order | Cashier |
| Cancel an order | Waiter |
| Dashboard, reports, staff, stock, menu, settings | Manager, Admin (who may also do every step above) |

Rules live in `RoleGroups` and `OrderDuties` (`backend/src/FaroRestaurant.Domain/Constants/Roles.cs`) and are mirrored in
the UI (`frontend/src/lib/permissions.ts`). The full matrix is shown in **Settings → Roles**. Colours are CSS tokens
(`--color-brand`, `--color-sidebar`, …) re-tinted per workspace in `frontend/src/index.css`.

### Customer "order ready" notifications

After ordering from the QR menu the guest lands on **My orders** (`/menu/orders`), which lists every order placed from
that phone with live progress. When the kitchen marks an order ready:

- **With the page open** (any phone): a full-screen "Your order is ready!" alert, sound and vibration.
- **With the page closed / screen locked**: a Web Push notification, if the guest tapped *Turn on notifications*.
  Browsers only allow this on **HTTPS** (or `localhost`), so over the plain-http Wi-Fi address used in development only
  the in-page alert works. In production serve the menu over HTTPS. iPhone needs iOS 16.4+ and *Add to Home Screen*.
  To try real push on Android during development, enable `chrome://flags/#unsafely-treat-insecure-origin-as-secure` for
  the Wi-Fi address shown on the QR page.

Push keys (VAPID) are configured in `backend/.env` (`WebPush__Subject`, `WebPush__PublicKey`, `WebPush__PrivateKey`);
generate your own pair for production. Failed pushes never block staff actions — they are only logged.

## Live demo (GitHub Pages)

The demo build runs the **whole portal without a server**: `frontend/src/demo` answers every `/api` call inside the
browser (a TypeScript port of the Application services — same rules, same messages) and replaces SignalR with an
in-browser hub. Each visitor gets private sample data (a month of sales, live kitchen tickets, reservations, low stock)
in `localStorage`, regenerated daily; tabs of the same browser share it live (QR menu in one tab, kitchen in another).

- Floating **DEMO** button: switch roles with one click, open the guest QR menu, reset the data, contact link.
- Reports export real CSV, Excel and PDF files. Web Push is the only feature that needs the real server.
- `npm run dev:demo` (local) / `npm run build:demo` (static files). The normal build contains none of the demo code.
- Published by `.github/workflows/deploy-pages.yml` on every push to `main`. One-time setup: **Settings → Pages →
  Source: GitHub Actions**. Optional repository variable `DEMO_CONTACT_URL` (e.g. `https://wa.me/90…`) shows a
  "Buy / contact" button.

## Licensing

A real installation only works on a computer the seller approved. The activation screen shows the computer's
**machine code** (`XXXX-XXXX-XXXX-XXXX`, derived from the Windows MachineGuid / Linux machine-id). The seller turns it
into a **license key** — customer name, machine code and optional expiry, signed with ECDSA P-256 — and the customer
pastes it. Until then the API answers `402 license_required` to everything except `/api/license` and `/api/health`.

| Piece | Where |
| --- | --- |
| Key tool (seller) | `lisans-olustur.cmd` (wizard) or `node tools/license/faro-license.mjs create --customer … --machine … [--days N]` |
| Signing key (secret) | `%USERPROFILE%\.faro-license\faro-license-private.pem` — outside the repository; **back it up** |
| Issued keys (ledger) | `%USERPROFILE%\.faro-license\issued-licenses.csv` |
| Public key / verification | `backend/src/FaroRestaurant.Infrastructure/Licensing/LicenseKey.cs` |
| Installed key | `license.key` next to the API (`License__FilePath`), git-ignored |

A key with machine `*` works on any computer (e.g. a hosted server). Replacing the key of an active installation needs
an administrator. On a new, empty database the portal then asks for the restaurant name and creates the first
administrator (`/api/setup`), so no test accounts ever reach a customer.

## Customer installation package

Double-click **`paket-olustur.cmd`** (`tools/release/build-release.ps1`). It builds the portal, publishes the API
self-contained for `win-x64` (no .NET needed on the customer's computer) with the portal in `wwwroot`, and writes
`release/FARO-Restaurant` plus a zip:

```text
FARO-Restaurant/
├── FARO-Baslat.cmd    # start: asks the PostgreSQL password once, opens the portal when the API is up
├── OKUBENI.txt        # installation & daily-use guide (Turkish)
├── .env               # this installation's settings (production, port 5080, migrations on, no seeding)
└── app/               # the program — replace this folder to update; .env and lisans.key stay
```

The customer's computer needs PostgreSQL. The API serves the portal and the API on one address
(`http://<computer>:5080`), so phones on the same Wi-Fi can open the QR menu.

## Stack

| Layer    | Technology |
| -------- | ---------- |
| Backend  | ASP.NET Core 10 Web API · EF Core 10 · ASP.NET Core Identity · JWT · SignalR · FluentValidation · QuestPDF · ClosedXML |
| Database | PostgreSQL (snake_case schema, foreign keys and indexes on every relation) |
| Frontend | React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · React Router 8 · Axios · Recharts · Lucide · @microsoft/signalr |

## Project structure

```text
resturportal/
├── start.cmd                           # one-click local start (Windows)
├── lisans-olustur.cmd                  # seller: create a license key for a machine code
├── paket-olustur.cmd                   # seller: build the customer installation package
├── tools/license, tools/release        # the scripts behind the two files above
├── backend/
│   ├── .env.example                    # copy to .env (git-ignored)
│   └── src/
│       ├── FaroRestaurant.Domain/          # entities, enums, role constants — no dependencies
│       ├── FaroRestaurant.Application/     # business services, DTOs, validators, interfaces
│       ├── FaroRestaurant.Infrastructure/  # EF Core, Identity/JWT, migrations, seeding, payment gateway, exporters
│       └── FaroRestaurant.Api/             # thin controllers, SignalR hub, middleware, filters
└── frontend/src/
    ├── app/            # router (lazy-loaded pages)
    ├── components/     # brand logo, UI kit (Button, Card, Modal, Toast, ConfirmDialog, Form…), charts, receipt
    ├── demo/           # demo build only: in-browser API, sample data, report files, DEMO panel
    ├── features/       # auth, license gate, realtime (SignalR), restaurant context, orders workflow, QR menu cart & push, workspace themes
    ├── layouts/        # staff shell: per-role sidebar & bottom navigation, top bar, mobile drawer
    ├── lib/            # API client, endpoints, formatting, permissions
    └── pages/          # one folder per module (workspaces/ = waiter & cashier home pages)
```

Dependency direction: `Api → Infrastructure → Application → Domain`. Controllers only call Application services;
`IAppDbContext` acts as the repository/unit-of-work abstraction, so services never depend on EF Core's concrete context.

## Manual start (any OS)

```bash
cd backend
cp .env.example .env            # set the PostgreSQL password and a 32+ char JWT secret
dotnet tool restore
dotnet run --project src/FaroRestaurant.Api --launch-profile http
```

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

- Portal: <http://localhost:5173>
- API: <http://localhost:5080> · health: `/api/health` · interactive API docs (dev only): `/scalar`

### Testing the QR menu on a phone

This works out of the box in development. The Vite dev server listens on your network, and QR codes automatically
use this computer's Wi-Fi address (e.g. `http://10.50.0.136:5173/menu/table/…`) instead of `localhost`.

1. Connect the phone to the **same Wi-Fi** as the computer.
2. Open **Restaurant → QR Codes** and scan a code.

If it still doesn't open, check two things. Windows Firewall must allow Node.js on your network type. Some public or
corporate Wi-Fi networks isolate devices from each other; a phone hotspot or home Wi-Fi avoids this. For a real restaurant,
set the public menu address in **Settings → QR Settings** (e.g. `https://menu.yourrestaurant.com`).

## Configuration

Secrets live in `backend/.env` (git-ignored) using ASP.NET Core's `Section__Key` names, so the same keys work as real
environment variables in production (real env vars take precedence).

| Key | Purpose |
| --- | --- |
| `ConnectionStrings__DefaultConnection` | PostgreSQL connection string |
| `Jwt__Secret` / `Jwt__Issuer` / `Jwt__Audience` / `Jwt__ExpiresMinutes` | JWT signing |
| `Cors__AllowedOrigins` | Comma-separated allowed frontend origins |
| `App__TimeZone` | Restaurant time zone for "today" and reports (default `Europe/Istanbul`) |
| `App__HttpsRedirection` | `false` for an installation reached over plain `http://` on the restaurant's network (default `true`) |
| `License__FilePath` | Where the activated license key is stored (default `license.key` next to the API) |

`.env` values expand `$NAME` and treat ` #` as a comment: wrap values containing `$` or `#` (e.g. a password) in
single quotes: `ConnectionStrings__DefaultConnection='Host=…;Password=pa$$word'`.

## Database migrations

```bash
cd backend
dotnet tool run dotnet-ef migrations add <Name> --project src/FaroRestaurant.Infrastructure --startup-project src/FaroRestaurant.Api --output-dir Persistence/Migrations
dotnet tool run dotnet-ef database update --project src/FaroRestaurant.Infrastructure --startup-project src/FaroRestaurant.Api
```

To reset the development data: `dotnet tool run dotnet-ef database drop --force …` and restart the API.

## Images

The demo product photos and the restaurant cover come from [Unsplash](https://unsplash.com) (free to use under the
Unsplash License). They are loaded from Unsplash's CDN, so the portal needs internet access to show them; without it,
monochrome placeholders are shown instead. Photos are requested at the size each screen needs (`src/lib/images.ts`).

To use your own photos, change **Products → Edit → Main image URL** and **Restaurant → Cover photo URL**. The seeder only
fills images that are empty, so your changes are never overwritten.

## Security

- Passwords hashed by ASP.NET Core Identity (PBKDF2); strong password policy; lockout after 5 failed logins
- JWT with issuer/audience/lifetime validation; tokens are rejected after deactivation, password or role change (security stamp)
- Role-based authorization on every endpoint; tenant scoping on every query
- FluentValidation on every request body (global action filter); EF Core parameterized queries (SQL injection safe)
- CORS restricted to configured origins; rate limiting (global, stricter for login/register and anonymous QR orders)
- Security headers (CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy); HSTS + HTTPS outside development
- Global exception handler returns RFC 7807 ProblemDetails without leaking internals

## Going to production

- On a restaurant's own computer use the [installation package](#customer-installation-package): activation, then
  first-run setup creates the administrator.
- On a server, set real secrets as environment variables; set `Database__MigrateOnStartup=false` and
  `Database__SeedOnStartup=false` (the defaults in `appsettings.json`) and apply migrations in the deployment pipeline.
- Replace `SimulatedPaymentGateway` with a Stripe/Iyzico implementation of `IPaymentGateway`.
- Serve the built frontend (`npm run build` → `frontend/dist`) behind the same reverse proxy as the API (`/api`, `/hubs`)
  or set `VITE_API_BASE_URL` and `Cors__AllowedOrigins`.
- QuestPDF is used under its Community license (free for companies under USD 1M annual revenue).

## Troubleshooting

- **`An Application Control policy has blocked this file (0x800711C7)`**: Windows Smart App Control blocks locally
  compiled .NET assemblies. Turn it off (*Windows Security → App & browser control → Smart App Control*) or run the
  backend in WSL/a container.
- **`dotnet` is not recognized**: open a new terminal, or use `C:\Program Files\dotnet\dotnet.exe` (as `start.cmd` does).
- **Portal shows "Offline — retrying"**: the API isn't running on port 5080.
- **Portal shows "Activate FARO"**: this computer has no license yet (or it expired / belongs to another computer).
  Create a key for the machine code shown with `lisans-olustur.cmd`.
