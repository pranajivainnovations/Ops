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

## Deploying with Docker

Same shape as the pranajiva-backend/storefront setup already running in production: build the
image yourself, then `docker compose` just runs the pre-built `:latest` tag (no `build:` block in
the compose file) — one less thing that looks different across all three services if you ever
compare them side by side.

```bash
cp .env.template .env               # fill in real values (docker compose reads .env automatically)
docker build -t crossfriend-ops:latest .
docker compose up -d
```

To deploy a new version later: rebuild the image, then `docker compose up -d` again — Compose
notices the image changed and recreates the container.

Runs on port 4000, same as local dev. A couple of things specific to this app, not copy-pasted
blindly from the storefront's Dockerfile:

- No `NEXT_PUBLIC_*` build args — every env var this app reads (`DATABASE_URL`, `SESSION_SECRET`,
  `GOOGLE_PLACES_API_KEY`, the `S3_*` vars) is server-only, read at runtime, so nothing needs
  baking into the image at build time. If you add a new customer-facing (`NEXT_PUBLIC_`) env var
  later, that's the one case that *would* need a build ARG.
- `HOSTNAME=0.0.0.0` is set explicitly in the Dockerfile. Without it, Next.js standalone's server
  binds in a way that leaves external traffic (through the Docker port mapping) working fine while
  connections *from inside the container itself* — like the HEALTHCHECK — get refused. Found this
  as a real failure while testing the build, not a theoretical concern.
- The healthcheck (both in the Dockerfile and docker-compose.yml) explicitly targets `127.0.0.1`,
  not `localhost` — Alpine resolves `localhost` to `::1` (IPv6) first, and the IPv4-only bind above
  doesn't cover that, so `localhost` in the healthcheck would silently fail forever.
- After changing `.env` on a running server, use `docker compose up -d --force-recreate`, not just
  `restart` — a plain restart doesn't re-read a changed `environment:` block.

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
