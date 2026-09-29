import type { PublicMenu } from '@/types/api'
import { db, type CategoryRow, type ProductRow } from '../db'
import { RoleGroups, blank, clean, conflict, isHttpUrl, notFound, one, requireRoles, route, tooLong, validate } from '../http'
import { categoryDto, find, productDto } from '../model'
import { newId, tableName } from '../util'

/** CategoriesController, ProductsController, PublicMenuController (menu part) */

const bySortOrder = (a: CategoryRow, b: CategoryRow) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)

function categoryInput(b: Record<string, unknown> | undefined) {
  const input = b ?? {}
  const sortOrder = Number(input.sortOrder)
  validate([
    ['name', blank(input.name) || tooLong(input.name, 80), "'Name' must not be empty."],
    ['description', tooLong(input.description, 300), "The length of 'Description' must be 300 characters or fewer."],
    ['icon', tooLong(input.icon, 16), "The length of 'Icon' must be 16 characters or fewer."],
    ['sortOrder', !(Number.isInteger(sortOrder) && sortOrder >= 0 && sortOrder <= 10_000), "'Sort Order' must be between 0 and 10000."],
  ])
  return {
    name: String(input.name).trim(),
    description: (input.description as string | null) ?? null,
    icon: (input.icon as string | null) ?? null,
    sortOrder,
    isActive: !!input.isActive,
  }
}

function ensureUniqueCategory(name: string, exceptId: string | null) {
  if (db().categories.some((c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== exceptId))
    throw conflict(`A category named '${name}' already exists.`)
}

route('GET', '/categories', (req) => {
  requireRoles(req, RoleGroups.allStaff)
  return [...db().categories].sort(bySortOrder).map(categoryDto)
})

route('POST', '/categories', (req) => {
  requireRoles(req, RoleGroups.management)
  const input = categoryInput(req.body)
  ensureUniqueCategory(input.name, null)
  const category: CategoryRow = { id: newId(), ...input }
  db().categories.push(category)
  return categoryDto(category)
})

route('PUT', '/categories/:id', (req) => {
  requireRoles(req, RoleGroups.management)
  const category = find(db().categories, req.params.id, 'Category')
  const input = categoryInput(req.body)
  ensureUniqueCategory(input.name, category.id)
  Object.assign(category, input)
  return categoryDto(category)
})

route('DELETE', '/categories/:id', (req) => {
  requireRoles(req, RoleGroups.management)
  const d = db()
  const category = find(d.categories, req.params.id, 'Category')
  if (d.products.some((p) => p.categoryId === category.id)) throw conflict('This category still has products. Move or delete them first.')
  d.categories = d.categories.filter((c) => c !== category)
})

// ---- products ----------------------------------------------------------------------------------

function productInput(b: Record<string, unknown> | undefined, exceptId: string | null) {
  const input = b ?? {}
  const price = Number(input.price)
  const stock = input.stock === null || input.stock === undefined || input.stock === '' ? null : Number(input.stock)
  const prep = Number(input.preparationMinutes)
  const images = Array.isArray(input.images) ? (input.images as string[]) : []
  validate([
    ['categoryId', blank(input.categoryId), "'Category Id' must not be empty."],
    ['name', blank(input.name) || tooLong(input.name, 120), "'Name' must not be empty."],
    ['description', tooLong(input.description, 500), "The length of 'Description' must be 500 characters or fewer."],
    ['imageUrl', !blank(input.imageUrl) && !isHttpUrl(String(input.imageUrl)), 'Image URL must be an absolute http(s) URL.'],
    ['price', !(price >= 0 && price < 1_000_000), "'Price' must be greater than or equal to '0'."],
    ['sku', blank(input.sku) || !/^[A-Za-z0-9-_]+$/.test(String(input.sku).trim()), "SKU may contain letters, digits, '-' and '_' only."],
    ['stock', stock !== null && !(Number.isInteger(stock) && stock >= 0), "'Stock' must be greater than or equal to '0'."],
    ['preparationMinutes', !(Number.isInteger(prep) && prep >= 0 && prep <= 240), "'Preparation Minutes' must be between 0 and 240."],
    ['images', images.some((u) => !blank(u) && !isHttpUrl(u)), 'Image URLs must be absolute http(s) URLs.'],
  ])

  const d = db()
  if (!d.categories.some((c) => c.id === input.categoryId)) throw notFound('Category', input.categoryId)
  const sku = String(input.sku).trim().toUpperCase()
  if (d.products.some((p) => p.sku === sku && p.id !== exceptId)) throw conflict(`SKU '${sku}' is already used by another product.`)

  return {
    categoryId: String(input.categoryId),
    name: String(input.name).trim(),
    description: (input.description as string | null) ?? null,
    imageUrl: clean(input.imageUrl),
    price: Math.round(price * 100) / 100,
    sku,
    stock,
    isAvailable: !!input.isAvailable,
    isFeatured: !!input.isFeatured,
    preparationMinutes: prep,
    images: [...new Set(images.filter((u) => !blank(u)).map((u) => u.trim()))],
  }
}

route('GET', '/products', (req) => {
  requireRoles(req, RoleGroups.allStaff)
  const d = db()
  const search = one(req.query, 'search')?.trim().toLowerCase()
  const categoryId = one(req.query, 'categoryId')
  const available = one(req.query, 'available')
  const order = new Map(d.categories.map((c) => [c.id, c.sortOrder]))
  return d.products
    .filter((p) => !search || p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search))
    .filter((p) => !categoryId || p.categoryId === categoryId)
    .filter((p) => available === undefined || p.isAvailable === (available === 'true'))
    .sort((a, b) => (order.get(a.categoryId) ?? 0) - (order.get(b.categoryId) ?? 0) || a.name.localeCompare(b.name))
    .map(productDto)
})

route('GET', '/products/:id', (req) => {
  requireRoles(req, RoleGroups.allStaff)
  return productDto(find(db().products, req.params.id, 'Product'))
})

route('POST', '/products', (req) => {
  requireRoles(req, RoleGroups.management)
  const product: ProductRow = { id: newId(), ...productInput(req.body, null) }
  db().products.push(product)
  return productDto(product)
})

route('PUT', '/products/:id', (req) => {
  requireRoles(req, RoleGroups.management)
  const product = find(db().products, req.params.id, 'Product')
  Object.assign(product, productInput(req.body, product.id))
  return productDto(product)
})

route('DELETE', '/products/:id', (req) => {
  requireRoles(req, RoleGroups.management)
  const d = db()
  const product = find(d.products, req.params.id, 'Product')
  d.products = d.products.filter((p) => p !== product)
  // Order items keep their name/price snapshot.
  for (const order of d.orders) for (const item of order.items) if (item.productId === product.id) item.productId = null
})

// ---- public QR menu (no login) -------------------------------------------------------------------

/** Only active categories and available products are exposed. */
route('GET', '/menu/tables/:tableId', (req): PublicMenu => {
  const d = db()
  const r = d.restaurant
  const table = d.tables.find((t) => t.id === req.params.tableId)
  if (!table || !r.isActive) throw notFound('Table', req.params.tableId)

  const categories = [...d.categories]
    .filter((c) => c.isActive)
    .sort(bySortOrder)
    .map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      products: d.products
        .filter((p) => p.categoryId === c.id && p.isAvailable)
        .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.name.localeCompare(b.name))
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          imageUrl: p.imageUrl,
          price: p.price,
          isFeatured: p.isFeatured,
          inStock: p.stock === null || p.stock > 0,
          preparationMinutes: p.preparationMinutes,
        })),
    }))
    .filter((c) => c.products.length > 0)

  return {
    restaurantName: r.name,
    logoUrl: r.logoUrl,
    coverImageUrl: r.coverImageUrl,
    description: r.description,
    currency: r.currency,
    taxRate: r.taxRate,
    openingTime: r.openingTime,
    closingTime: r.closingTime,
    tableId: table.id,
    tableName: tableName(table.number),
    orderingEnabled: r.settings.qrOrderingEnabled && table.status !== 'Disabled',
    categories,
  }
})

/** Phone push needs a server to send it; the demo alerts inside the page instead. */
route('GET', '/menu/push/public-key', () => ({ publicKey: null }))
route('POST', '/menu/orders/:orderId/push-subscription', () => undefined)
