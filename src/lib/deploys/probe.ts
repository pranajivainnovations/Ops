/**
 * Asks each service what it was built from.
 *
 * The alternative design — having deploy.sh write a row to Postgres — was rejected deliberately.
 * That records *intent*: it says a deploy was attempted and what the developer's checkout looked
 * like at the time. This records *reality*. If a deploy half-fails, if someone restarts an older
 * image, if a rollback happens, or if a colleague deploys from a different machine, the probe still
 * reports what is genuinely serving traffic. A table would go on asserting the last thing anyone
 * tried.
 *
 * That distinction is not hypothetical here. A storefront fix sat in a working tree through two
 * production builds while everyone believed it had shipped, and separately, work that HAD shipped
 * was repeatedly described as pending. Both are questions this endpoint answers in one request.
 */

export interface Service {
  key: string
  label: string
  /** Where the build endpoint lives. Medusa mounts its store API under /store. */
  url: string
  /** The host it runs on, for orienting when several services share a box. */
  host: string
}

export const SERVICES: Service[] = [
  {
    key: "storefront",
    label: "CrossFriend storefront",
    url: "https://crossfriend.in/api/build",
    host: "Oracle · 155.248.243.46",
  },
  {
    key: "backend",
    label: "Medusa backend",
    url: "https://api.pranajiva.in/store/build",
    host: "AWS · 13.62.195.167",
  },
  {
    key: "ops",
    label: "OPS console",
    // Loopback rather than the public hostname: this is the app serving the page, so a public
    // round-trip would only add a way for the check to fail while the thing it checks is fine.
    url: `http://127.0.0.1:${process.env.PORT || 4000}/api/build`,
    host: "AWS · 13.62.195.167",
  },
  {
    key: "baker",
    label: "Baker portal",
    url: "https://baker.crossfriend.in/api/build",
    host: "AWS · 13.62.195.167",
  },
]

export interface BuildInfo {
  service?: string
  commit?: string
  branch?: string
  tree?: string
  builtAt?: string
  node?: string
}

export type ProbeStatus = "ok" | "stale-image" | "unreachable" | "no-endpoint"

export interface ProbeResult {
  service: Service
  status: ProbeStatus
  info: BuildInfo | null
  /** Round-trip time, which doubles as a rough health signal. */
  ms: number
  error?: string
}

/**
 * One probe. Never throws — an unreachable service is a result, not an exception, because a page
 * that 500s when one of four services is down is useless precisely when it is needed.
 */
async function probeOne(service: Service): Promise<ProbeResult> {
  const started = Date.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(service.url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
    clearTimeout(timer)
    const ms = Date.now() - started

    // A 404 means the service is up but predates this endpoint — worth distinguishing from down,
    // because the fix is "deploy it once" rather than "something is broken".
    if (response.status === 404) {
      return { service, status: "no-endpoint", info: null, ms }
    }
    if (!response.ok) {
      return { service, status: "unreachable", info: null, ms, error: `HTTP ${response.status}` }
    }

    const info = (await response.json()) as BuildInfo

    // The endpoint exists but the image was built before the args were wired, or built by hand.
    if (!info.commit || info.commit === "unknown") {
      return { service, status: "stale-image", info, ms }
    }

    return { service, status: "ok", info, ms }
  } catch (error) {
    return {
      service,
      status: "unreachable",
      info: null,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** All four in parallel — the page should take as long as the slowest, not the sum. */
export async function probeAll(): Promise<{ results: ProbeResult[]; checkedAt: Date }> {
  const results = await Promise.all(SERVICES.map(probeOne))
  return { results, checkedAt: new Date() }
}

/** Whole days since a build, or null when the timestamp is missing or unparseable. */
export function ageInDays(builtAt?: string): number | null {
  if (!builtAt || builtAt === "unknown") return null
  const then = Date.parse(builtAt)
  if (Number.isNaN(then)) return null
  return Math.floor((Date.now() - then) / 86_400_000)
}
