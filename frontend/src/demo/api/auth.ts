import type { AuthResponse } from '@/types/api'
import { db, type UserRow } from '../db'
import { blank, clean, conflict, isEmail, passwordProblem, requireRoles, requireUser, route, tokenFor, unauthorized, validate } from '../http'
import { byNewest, orderDto, userDto } from '../model'
import { newId } from '../util'

/** AuthController / AuthService */

const session = (user: UserRow): AuthResponse => ({
  accessToken: tokenFor(user),
  expiresAtUtc: new Date(Date.now() + 120 * 60_000).toISOString(),
  user: userDto(user),
})

route('POST', '/auth/login', ({ body }) => {
  validate([
    ['email', blank(body?.email), "'Email' must not be empty."],
    ['password', blank(body?.password), "'Password' must not be empty."],
  ])
  const login = String(body.email).trim().toLowerCase()
  const user = db().users.find((u) => u.email.toLowerCase() === login || u.userName.toLowerCase() === login)
  // Same message for unknown user and wrong password, so accounts can't be enumerated.
  if (!user || user.password !== body.password) throw unauthorized('Invalid email or password.')
  if (!user.isActive) throw unauthorized('This account is disabled. Contact your manager.')
  return session(user)
})

/** Self-registration creates a Customer account linked to (or creating) the customer record. */
route('POST', '/auth/register', ({ body }) => {
  const passwordError = passwordProblem(body?.password)
  validate([
    ['fullName', blank(body?.fullName), "'Full Name' must not be empty."],
    ['email', blank(body?.email) || !isEmail(String(body.email).trim()), "'Email' is not a valid email address."],
    ['password', !!passwordError, passwordError ?? ''],
  ])
  const d = db()
  const email = String(body.email).trim().toLowerCase()
  if (d.users.some((u) => u.email.toLowerCase() === email)) throw conflict('An account with this email already exists.')

  const phone = clean(body.phone)
  const user: UserRow = { id: newId(), fullName: body.fullName.trim(), email, userName: email, phone, roles: ['Customer'], restaurantId: null, password: body.password, isActive: true }
  d.users.push(user)

  let customer = d.customers.find((c) => c.email === email || (phone !== null && c.phone === phone))
  if (!customer) {
    customer = { id: newId(), name: user.fullName, phone, email, notes: null, userId: null, createdAt: new Date().toISOString() }
    d.customers.push(customer)
  }
  customer.userId = user.id
  return session(user)
})

route('GET', '/auth/me', (req) => userDto(requireUser(req)))

route('PUT', '/auth/profile', (req) => {
  const user = requireUser(req)
  validate([['fullName', blank(req.body?.fullName), "'Full Name' must not be empty."]])
  user.fullName = req.body.fullName.trim()
  user.phone = clean(req.body.phone)
  const staff = db().staff.find((s) => s.userId === user.id)
  if (staff) {
    staff.fullName = user.fullName
    staff.phone = user.phone
  }
  return userDto(user)
})

route('POST', '/auth/change-password', (req) => {
  const user = requireUser(req)
  const passwordError = passwordProblem(req.body?.newPassword)
  validate([
    ['currentPassword', blank(req.body?.currentPassword), "'Current Password' must not be empty."],
    ['newPassword', !!passwordError, passwordError ?? ''],
  ])
  validate([['currentPassword', req.body.currentPassword !== user.password, 'Current password is incorrect.']])
  user.password = req.body.newPassword
})

/** Orders of the signed-in customer account. */
route('GET', '/customers/me/orders', (req) => {
  const user = requireRoles(req, ['Customer'])
  const mine = new Set(db().customers.filter((c) => c.userId === user.id).map((c) => c.id))
  return db()
    .orders.filter((o) => o.customerId && mine.has(o.customerId))
    .sort(byNewest)
    .slice(0, 50)
    .map(orderDto)
})
