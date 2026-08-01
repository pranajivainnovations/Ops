# CrossFriend Ops

Internal-only tool for managing the baker network. Separate app from the storefront and
Medusa backend, sharing the same Postgres instance (only touches the `baker_network` schema).
Intended to eventually live on its own subdomain (`admin.crossfriend.in`), password-protected.

Built step by step, on purpose — this is the smallest useful version (login + baker add/edit),
not a finished admin panel. Extend it as real needs come up.

## Setup

```bash
npm install
cp .env.local.example .env.local   # then fill in DATABASE_URL (same value as Backend/Backend/.env)
                                    # and generate a SESSION_SECRET:
                                    #   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Schema (`baker_network.bakers`, `baker_network.ops_users`) is created by migrations in the
**Backend** repo (`d:\apps\Backend\Backend\src\migrations`), not here — this app only reads/writes
it. Run migrations there first if the schema doesn't exist yet.

### Create your first login

There's no signup UI (internal tool, no self-serve accounts). Create/reset an account with:

```bash
node scripts/seed-admin.js you@crossfriend.in "your password" "Your Name"
```

Safe to re-run — same email updates the password instead of erroring, so it also works as a
password reset.

## Running

```bash
npm run dev
```

Runs on **port 4000** (not 3000 — that's the storefront's dev port; don't change this without
checking what else might be using whatever port you pick).

## What's here

- `/login` — email + password, session cookie (7-day expiry, HTTP-only, signed JWT)
- `/bakers` — list all bakers
- `/bakers/new`, `/bakers/[id]` — add / edit a baker (identity, geography, CRM status, commerce
  fields, and the two trust badges — Blue Tick and Trust Badge — plus `is_active` for
  soft-offboarding without deleting anything)
- `src/proxy.ts` — auth gate (Next.js 16's replacement for `middleware.ts`) — redirects any
  unauthenticated request to `/login`, except `/login` itself

## What's deliberately not here yet

No CRM pipeline view, no map, no baker discovery tooling, no bulk pincode import UI — add these
as they're actually needed, not ahead of time.
