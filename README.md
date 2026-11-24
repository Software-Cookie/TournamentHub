# TournamentHub

A multi-sport tournament marketplace: discovery, registration (singles, doubles, squads), Razorpay payments, digital QR tickets, fixture/bracket engine, live match control, email notifications, an organiser console and a platform admin console.

**Stack:** Next.js 15 (App Router, server actions) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL + Prisma 6 · Auth.js v5 · Razorpay · Resend · Cloudinary · pdf-lib + qrcode · Recharts · Vercel Cron.

---

## Quick start (local)

```bash
npm install
cp .env.example .env            # then fill AUTH_SECRET (npx auth secret) and the admin password
npm run db:local                # terminal 1: local Postgres on :54330 (no Docker needed; dev only)
npx prisma migrate deploy       # terminal 2: create tables
npm run db:seed                 # sports + platform organisation (production-safe)
npm run admin:create            # provisions ADMIN_EMAIL as SUPER_ADMIN using ADMIN_INITIAL_PASSWORD
npm run demo:seed               # optional sample data (flagged isDemo; remove with npm run demo:clear)
npm run dev                     # http://localhost:3000
```

Without third-party keys the app still runs locally:

| Service missing | Local behaviour |
|---|---|
| Razorpay keys | Set `PAYMENTS_DEV_SIMULATOR="true"` to get a clearly-labelled simulated checkout. **Ignored when `NODE_ENV=production`.** |
| Resend key | Emails are printed to the server console (links included). In production a missing key is an error. |
| Cloudinary | Uploads are saved to `public/uploads` (dev only). |

Landing-page clips live in `public/media/sports/` (sources and licences in `CREDITS.md`).

---

## Deploying to production (Vercel)

1. **Database:** create a managed Postgres (Neon, Supabase, RDS…). Set `DATABASE_URL` (pooled) and `DIRECT_DATABASE_URL` (direct, for migrations). Enable automated backups / point-in-time recovery there.
2. **Env vars** in Vercel (all from `.env.example`): `APP_URL`, `NEXT_PUBLIC_APP_URL`, `AUTH_SECRET`, `RAZORPAY_*`, `RESEND_API_KEY`, `EMAIL_FROM` (a verified Resend domain), `CLOUDINARY_*`, `CRON_SECRET`, optionally `AUTH_GOOGLE_ID/SECRET`. Do **not** set `PAYMENTS_DEV_SIMULATOR` or `DEMO_MODE`.
3. **Build command:** `prisma migrate deploy && npm run build`.
4. **First run:** `npm run db:seed`, then `ADMIN_EMAIL=… ADMIN_INITIAL_PASSWORD=… npm run admin:create` once from a trusted machine against the production DB. Remove the password variable afterwards and change it from the profile page.
5. **Razorpay webhook:** Dashboard → Webhooks → URL `https://<domain>/api/webhooks/razorpay`, events `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`, `refund.failed`; copy the secret into `RAZORPAY_WEBHOOK_SECRET`.
6. **Google sign-in (optional):** OAuth client with redirect `https://<domain>/api/auth/callback/google`.
7. **Cron:** `vercel.json` calls `/api/cron` every 15 minutes (needs a Vercel Pro plan; Hobby allows daily only — or call the endpoint from any scheduler with `Authorization: Bearer $CRON_SECRET`). It expires unpaid holds, reconciles payments whose callback was missed, sends reminders and retries failed emails.
8. **Error monitoring:** add Sentry (or similar) at the hook in `src/app/error.tsx` and around `console.error` calls in `src/lib/http.ts`.

---

## How the important parts work

### Pricing (`src/lib/pricing.ts`, unit-tested)
- **Hosting fee:** sport listing fee (set in Platform admin → Sports) + 2% platform charge + 18% GST on both. Organisers see the itemised total while creating a tournament; publishing is blocked until it is paid.
- **Premium events:** a tournament whose cash prize pool is more than ₹30,000 is a premium event. Only Premium members can register (checked server-side in `createRegistration`).
- **Premium membership:** ₹59 for 1 month or ₹637.20 for 12 months (10% off), no auto-renewal. Paid via the same verified Razorpay flow (`src/server/membership.ts`); buying again extends the expiry. Members get a Premium badge on their profile.

### Payments (`src/server/registrations.ts`, `src/app/api/payments/*`, `src/app/api/webhooks/razorpay`)
1. Registration is created server-side; **fee, capacity, eligibility and deadline come from the database**, never the client. A pending entry holds a slot for 20 minutes.
2. `/api/payments/order` creates a Razorpay order for the DB amount.
3. After Checkout, `/api/payments/verify` checks the HMAC signature **and** fetches the payment from Razorpay (status, amount, currency) before confirming.
4. The webhook (signature-verified, stored by event ID for idempotency) runs the same `confirmPayment`. A conditional update makes confirmation idempotent, so checkout + webhook + reconciliation can race safely.
5. Payments that arrive after a hold expired are reinstated if a slot is free, otherwise refunded automatically; duplicate payments are refunded.
6. Success UI is shown only after backend verification.

### Duplicate prevention
Partial-unique "active keys" (`Registration.activeKey`, `Team.activeKey`, `Participant.activeKey`) enforce at the database level: one active entry per account per category, unique team names per category, and a player can't appear twice in a category. Capacity checks run under a per-tournament Postgres advisory lock.

### Fixture engine (`src/lib/bracket.ts` – pure & unit-tested, `src/server/fixtures.ts`)
- Bracket size = next power of two; BYEs spread evenly and given to top seeds; draws can be random, seeded or in registration order, or arranged manually before play starts.
- Full skeleton generated up front; recording a result advances the winner (and semi-final losers to an optional third-place playoff), completes rounds, crowns the champion and emails players.
- Completed matches change only through an explicit, reasoned correction, allowed while the next-round match hasn't started. Every change goes to `MatchHistory` and `AuditLog`. Optimistic versioning prevents two admins overwriting each other.

### Access control
- Roles: `SUPER_ADMIN`, `ADMIN`, `PLAYER` (plus `OrganisationMember` roles ready for multi-organiser SaaS).
- Every admin page, server action and API route re-checks the role server-side. Sessions are JWTs revalidated against the DB on each request, so disabling a user, changing roles or resetting a password takes effect immediately.
- Protected fixtures are served only to admins and confirmed participants (registrant or any listed player's account).

### Email
Every email has a `dedupeKey` (e.g. `reminder:24:<registration>:<email>`) — the same logical email is never sent twice. All sends are logged (`EmailLog`); failures retry automatically via cron. Admin broadcasts go through a channel adapter (`src/server/notifications.ts`) with SMS/WhatsApp stubs ready to plug in.

### Security checklist
bcrypt (cost 12) password hashing · rate limiting (Postgres-backed) on login, sign-up, resets, registration, payments, uploads, ticket verification · CSRF: server actions' built-in origin check + same-origin check on JSON routes · secure HttpOnly cookies via Auth.js · zod validation on every input · uploads validated by magic bytes, 5 MB cap · CSV/Excel formula-injection escaping · CSP and security headers (`next.config.ts`) · account-enumeration-safe password reset · audit log.

---

## Adding a sport
Add an entry to `src/lib/sports.ts` (categories, team size, gender rule, scoring hint) and run `npm run db:seed`; set `isActive` on the Sport row to offer it in the admin form.

## Scripts
| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Bracket and pricing unit tests |
| `npm run typecheck` / `lint` | Static checks |
| `npm run db:local` | Local embedded Postgres (dev only) |
| `npm run db:migrate` / `db:deploy` / `db:seed` | Prisma |
| `npm run admin:create` | Provision/promote the platform admin (`--reset-password` to rotate) |
| `npm run demo:seed` / `demo:clear` | Add / remove sample data |
