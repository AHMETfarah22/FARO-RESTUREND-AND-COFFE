import type { Role } from '@/types/api'

export interface TestAccount {
  email: string
  password: string
  role: Role
}

/** Development accounts seeded by DbSeeder (documented in README.md). Shown on the login page in development and in the demo. */
export const testAccounts: TestAccount[] = [
  { email: 'admin@example.com', password: 'Admin@12345', role: 'SuperAdmin' },
  { email: 'manager@example.com', password: 'Manager@12345', role: 'Manager' },
  { email: 'waiter@example.com', password: 'Waiter@12345', role: 'Waiter' },
  { email: 'kitchen@example.com', password: 'Kitchen@12345', role: 'Kitchen' },
  { email: 'cashier@example.com', password: 'Cashier@12345', role: 'Cashier' },
]

/** Demo only: a customer account, so the "My orders" workspace can be tried without registering. */
export const demoCustomerAccount: TestAccount = { email: 'customer@example.com', password: 'Customer@12345', role: 'Customer' }
