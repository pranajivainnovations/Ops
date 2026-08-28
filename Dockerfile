# CrossFriend Ops — Next.js Dockerfile
# Multi-stage build for a lean production image (standalone output)

# Stage 1: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# No NEXT_PUBLIC_* build args needed here — every env var this app reads (DATABASE_URL,
# SESSION_SECRET, S3 credentials, Google Places key) is server-only and read at runtime, not baked
# into the client bundle, so nothing needs to be passed as a build ARG.
RUN npm run build

# Stage 2: Runner (Production)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4000
# Next.js standalone's server.js binds to os.hostname() by default inside some environments, which
# inside Docker resolves to the container's own bridge IP, NOT loopback — meaning external traffic
# via the port mapping works fine, but anything hitting localhost/127.0.0.1 *from inside the
# container* (like the HEALTHCHECK below) gets connection-refused. Forcing the wildcard bind fixes
# it. Verified this was a real, not theoretical, failure before adding it.
ENV HOSTNAME=0.0.0.0

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Standalone output already bundles next.config's compiled settings — no need to copy it separately.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 4000

# Explicit 127.0.0.1, not localhost — Alpine resolves "localhost" to ::1 (IPv6) first, but the
# HOSTNAME=0.0.0.0 bind above is IPv4-only, so the healthcheck would connection-refuse forever
# against the IPv6 loopback even with the app working fine. Verified both failure modes for real
# before landing on this fix, not assumed.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4000 || exit 1


# ── Build provenance ──────────────────────────────────────────────────────────────────────────
# Declared in the RUNNER stage, deliberately, not the builder. The /api/build route reads these
# from process.env at request time, so they have to exist in the image that actually runs — a
# value set in the builder stage is discarded the moment the runner stage starts from a fresh
# base. (This is the mirror image of the NEXT_PUBLIC_* rule: those must be in the BUILDER stage
# because the bundler inlines them at compile time. Getting the two confused is what left GA
# missing from two production builds.)
#
# These are readable by anyone who can reach the endpoint. That is an accepted trade: a short
# commit hash from a private repo is not actionable on its own, and the alternative — a shared
# token in five more places — is exactly the kind of env plumbing that has already failed here.
ARG BUILD_COMMIT=unknown
ARG BUILD_BRANCH=unknown
ARG BUILD_TREE=unknown
ARG BUILD_TIME=unknown
ENV BUILD_COMMIT=$BUILD_COMMIT
ENV BUILD_BRANCH=$BUILD_BRANCH
ENV BUILD_TREE=$BUILD_TREE
ENV BUILD_TIME=$BUILD_TIME
CMD ["node", "server.js"]
