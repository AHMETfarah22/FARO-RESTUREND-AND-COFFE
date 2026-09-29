# Security Policy

## Reporting Security Issues
If you discover any security vulnerabilities, please do not open a public issue. Instead, report it privately to the maintainers.

## Security Architecture & Best Practices
1. **Never commit `.env` files**: All local secrets, database passwords, and JWT secret keys must remain in `.env` files which are excluded via `.gitignore`.
   The license signing key lives outside the repository (`%USERPROFILE%\.faro-license`); only its public half is in the code.
2. **Production Secrets**: Use secure environment variables or a secrets manager (e.g., GitHub Secrets, Azure Key Vault, Render Environment Variables).
3. **Database Security**:
   - Connection strings must be parameterized through environment variables (`ConnectionStrings__DefaultConnection`).
   - All EF Core queries are parameterized to prevent SQL injection.
   - Migrations and seeder are configured via `Database:MigrateOnStartup` and `Database:SeedOnStartup`. **Never enable `SeedOnStartup` in production.**
4. **Authentication & Authorization**:
   - Passwords are encrypted using ASP.NET Core Identity with PBKDF2 with HMAC-SHA512.
   - Account lockout is activated after 5 failed attempts.
   - JWT tokens include security stamps: changing passwords or roles immediately revokes previous tokens.
5. **Defensive Headers & Rate Limiting**:
   - CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy headers are enforced on all responses.
   - Built-in rate limiting mitigates brute-force attacks and abuse.
