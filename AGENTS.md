# AGENTS.md

## Cursor Cloud specific instructions

### Architecture Overview
This is a monorepo for **Save All** (HobbyCollection), a collectible management platform with AI-powered photo analysis. It has four main components:

| Component | Path | Tech | Dev Port |
|-----------|------|------|----------|
| Backend API | `Backend/` | .NET 8 / ASP.NET Core / EF Core 9 / PostgreSQL | `http://localhost:5014` |
| Public Web | `web/` | Next.js 15.5 / React 19 / Tailwind CSS 4 | `http://localhost:3000` |
| Admin Panel | `web-admin/` | Next.js 15.5 / React 19 / TanStack / Recharts | `http://localhost:3001` |
| Mobile | `Mobile/` | React Native 0.81 / Expo 54 | Expo dev server |

### Required Services
- **PostgreSQL 16** must be running locally. The database name is `hobbycollection_dev`. Auth is configured for local trust (no password). Start with `sudo pg_ctlcluster 16 main start`.
- **.NET 8 SDK** is required for the backend.

### Running Services

**Backend API:**
```bash
cd Backend
ASPNETCORE_ENVIRONMENT=Development dotnet run --project HobbyCollection.Api --urls "http://localhost:5014"
```
The backend runs automatic idempotent database migrations on startup. Some non-critical migration warnings (duplicate indexes, already-existing columns) are expected and harmless.

**Web (public):**
```bash
cd web
NEXT_PUBLIC_API_BASE_URL=http://localhost:5014 npm run dev
```

**Web Admin:**
```bash
cd web-admin
NEXT_PUBLIC_API_BASE_URL=http://localhost:5014 npx next dev --turbopack --port 3001
```

### Important Gotchas

- The default `api-client.ts` in both `web/` and `web-admin/` expects the backend on port **5015** (HTTPS). In dev mode without HTTPS, set `NEXT_PUBLIC_API_BASE_URL=http://localhost:5014` when starting frontends.
- The `appsettings.Development.json` connection string uses `Username=ubuntu` for the cloud dev environment. The original value is `gokhanmemik` (the developer's local username).
- Google Cloud credentials are not available in the cloud dev environment; image upload and AI photo analysis features won't work, but all other functionality operates normally.
- The web-admin project does not have an `eslint.config.*` file, so `npm run lint` will fail for that project. Use `npx next build --turbopack` to verify code correctness instead.
- The backend's Swagger UI is available at `http://localhost:5014/swagger` in Development mode.
- Auth flow in dev mode: `POST /api/auth/register` returns the verification code directly in the response body (no email needed). Use `POST /api/auth/verify-email` with the code to confirm and get a JWT token.

### Lint / Build / Test

| Project | Lint | Build |
|---------|------|-------|
| Backend | `dotnet build Backend/HobbyCollection.sln` (0 warnings, 0 errors) | Same |
| Web | `cd web && npx eslint .` | `cd web && npm run build` |
| Web Admin | N/A (no eslint config) | `cd web-admin && npx next build --turbopack` |
