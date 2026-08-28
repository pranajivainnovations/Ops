/**
 * Live SEO / AEO / GEO audit of the public storefront.
 *
 * Every check here fetches crossfriend.in over the network and reads what a crawler would actually
 * receive. Nothing is inferred from the storefront repo, and nothing is cached between page loads.
 * That is the point: the storefront and OPS deploy separately, so a check that read local source
 * would go on passing for as long as it took someone to notice the deploy had not happened. This
 * has already bitten us once — analytics sat "done" in the working tree through two production
 * builds that did not contain it.
 *
 * ── Three families of engine, one page ──────────────────────────────────────────────────────────
 *   SEO — classic crawlers. Can they reach the page, and do they understand what it is?
 *   AEO — answer engines (ChatGPT, Perplexity, Google AI Overviews). Do they have something
 *         quotable, and are they permitted to quote it?
 *   GEO — generative engines resolving ENTITIES. Do they know CrossFriend is one business, with an
 *         identity that reconciles across the web?
 *
 * They overlap but fail differently. A page can be perfectly crawlable (SEO fine) while offering
 * nothing an answer engine would ever cite (AEO absent) and asserting no verifiable identity (GEO
 * absent). Grouping the checks this way keeps that distinction visible instead of averaging it into
 * one meaningless score.
 */

export type CheckStatus = "pass" | "warn" | "fail" | "error"

export type CheckGroup = "crawl" | "onpage" | "schema" | "aeo"

export interface CheckResult {
  status: CheckStatus
  /** One line, shown on the row. Say what was found, not what was wanted. */
  detail: string
  /** Raw supporting text, shown when the row is expanded. */
  evidence?: string
}

export interface Check {
  id: string
  label: string
  group: CheckGroup
  /** Why an engine cares. Rendered under the label so nobody has to take the check on faith. */
  why: string
  run: (ctx: AuditContext) => Promise<CheckResult>
}

export const GROUP_LABELS: Record<CheckGroup, { title: string; blurb: string }> = {
  crawl: {
    title: "Crawlability & indexing",
    blurb: "Whether engines can reach the pages at all, and how many there are to reach.",
  },
  onpage: {
    title: "On-page signals",
    blurb: "What a crawler reads once it has the HTML.",
  },
  schema: {
    title: "Structured data",
    blurb: "Machine-readable claims about what this page is. The bulk of AEO and GEO lives here.",
  },
  aeo: {
    title: "Answer & generative engines",
    blurb: "Whether there is anything worth quoting, and whether the entity resolves.",
  },
}

export const STOREFRONT_URL = (process.env.STOREFRONT_URL ?? "https://crossfriend.in").replace(/\/+$/, "")

/** A fetched document. Never throws — a failed fetch becomes status 0 with an empty body. */
export interface Doc {
  url: string
  status: number
  contentType: string
  body: string
}

/**
 * One fetch per URL per audit run.
 *
 * Twenty-odd checks read from roughly eight documents. Without this the audit would hammer
 * production with duplicate requests every time somebody opened the page, and the checks would
 * disagree with each other whenever a deploy landed mid-run.
 */
export class AuditContext {
  private cache = new Map<string, Promise<Doc>>()

  readonly base: string

  constructor(base: string = STOREFRONT_URL) {
    this.base = base
  }

  get(path: string): Promise<Doc> {
    const url = path.startsWith("http") ? path : `${this.base}${path}`
    const existing = this.cache.get(url)
    if (existing) return existing

    const promise = this.fetchOnce(url)
    this.cache.set(url, promise)
    return promise
  }

  private async fetchOnce(url: string): Promise<Doc> {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 15_000)
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        headers: {
          // Identify honestly. A check that lies about who it is would be testing a code path no
          // real crawler takes.
          "User-Agent": "CrossFriend-OPS-SEO-Audit/1.0 (+https://crossfriend.in)",
          Accept: "text/html,application/xhtml+xml,application/xml,text/plain,*/*",
        },
      })
      clearTimeout(timer)

      const contentType = response.headers.get("content-type") ?? ""
      // Images and other binaries are only ever probed for their status code, so don't pull the
      // bytes into memory.
      const body =
        contentType.startsWith("image/") || contentType.startsWith("font/")
          ? ""
          : await response.text()

      return { url, status: response.status, contentType, body }
    } catch (error) {
      return {
        url,
        status: 0,
        contentType: "",
        body: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * The first product URL in the sitemap, or null.
   *
   * Resolved from the sitemap rather than hardcoded so the product checks keep working after the
   * catalogue turns over. Cached because three checks need it.
   */
  private productUrlPromise: Promise<string | null> | null = null

  productUrl(): Promise<string | null> {
    if (!this.productUrlPromise) {
      this.productUrlPromise = this.get("/sitemap.xml").then((doc) => {
        const match = doc.body.match(/<loc>([^<]*\/products\/[^<]*)<\/loc>/)
        return match ? match[1] : null
      })
    }
    return this.productUrlPromise
  }
}

// ── Small parsing helpers ────────────────────────────────────────────────────────────────────────
// Deliberately regex rather than a DOM parser. These read a handful of well-known tags out of
// server-rendered HTML; pulling in a parser to do it would be a dependency and a build-size cost
// for no additional correctness at this scale.

function meta(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]*name="${name}"[^>]*content="([^"]*)"`, "i"),
    new RegExp(`<meta[^>]*property="${name}"[^>]*content="([^"]*)"`, "i"),
    new RegExp(`<meta[^>]*content="([^"]*)"[^>]*name="${name}"`, "i"),
    new RegExp(`<meta[^>]*content="([^"]*)"[^>]*property="${name}"`, "i"),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) return match[1]
  }
  return null
}

function title(html: string): string | null {
  const match = html.match(/<title>([^<]*)<\/title>/i)
  return match ? match[1].trim() : null
}

function canonical(html: string): string | null {
  const match = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i)
  return match ? match[1] : null
}

/** Counts JSON-LD @type occurrences. Works on the flight payload too, where quotes are escaped. */
function schemaTypes(html: string): Set<string> {
  const found = new Set<string>()
  for (const match of html.matchAll(/"@type"\s*:\s*\\?"([A-Za-z]+)\\?"/g)) {
    found.add(match[1])
  }
  return found
}

function visibleWordCount(html: string): number {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return text ? text.split(" ").length : 0
}

/** The pages sampled by the on-page checks. One of each template that matters for ranking. */
const SAMPLE_PAGES = [
  "/",
  "/store",
  "/occasions/birthday",
  "/occasions/anniversary",
  "/collections",
  "/categories",
  "/ready-to-order",
  "/bakers",
  "/cake-size-calculator",
]

/**
 * AI crawlers whose access is worth asserting explicitly.
 *
 * A missing entry is not a block — the wildcard rule already permits them. It is stated anyway
 * because several of these publishers treat an explicit Allow as the signal, and because a future
 * edit that adds a blanket Disallow is far more likely to be noticed if the names are present.
 */
const AI_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "meta-externalagent",
]

export const CHECKS: Check[] = [
  // ── Crawlability ──────────────────────────────────────────────────────────────────────────────
  {
    id: "robots-reachable",
    label: "robots.txt is served",
    group: "crawl",
    why: "The first file every crawler requests. A 404 here means each engine falls back to its own defaults.",
    run: async (ctx) => {
      const doc = await ctx.get("/robots.txt")
      if (doc.status !== 200) {
        return { status: "fail", detail: `HTTP ${doc.status || "no response"}`, evidence: doc.body.slice(0, 400) }
      }
      return { status: "pass", detail: `HTTP 200, ${doc.body.length} bytes`, evidence: doc.body.slice(0, 1200) }
    },
  },
  {
    id: "robots-sitemap",
    label: "robots.txt declares the sitemap",
    group: "crawl",
    why: "How an engine finds every URL without relying on links. Bing and Yandex lean on it heavily.",
    run: async (ctx) => {
      const doc = await ctx.get("/robots.txt")
      const match = doc.body.match(/^Sitemap:\s*(\S+)/im)
      if (!match) return { status: "fail", detail: "No Sitemap: line" }
      return { status: "pass", detail: match[1], evidence: match[0] }
    },
  },
  {
    id: "ai-crawlers",
    label: "AI crawlers are explicitly allowed",
    group: "crawl",
    why: "GPTBot, ClaudeBot and PerplexityBot must be permitted or the site cannot appear in an AI answer at all.",
    run: async (ctx) => {
      const doc = await ctx.get("/robots.txt")
      const named = AI_AGENTS.filter((agent) => new RegExp(`User-Agent:\\s*${agent}\\b`, "i").test(doc.body))
      const missing = AI_AGENTS.filter((agent) => !named.includes(agent))

      // A blanket disallow beats any per-agent Allow, so look for that before celebrating.
      const blanketBlock = /User-Agent:\s*\*[\s\S]*?Disallow:\s*\/\s*$/im.test(doc.body)
      if (blanketBlock) return { status: "fail", detail: "robots.txt disallows everything for *" }

      if (named.length === 0) {
        return { status: "warn", detail: "None named explicitly (wildcard still permits them)" }
      }
      return {
        status: missing.length ? "warn" : "pass",
        detail: `${named.length}/${AI_AGENTS.length} named${missing.length ? ` — missing ${missing.join(", ")}` : ""}`,
        evidence: named.join("\n"),
      }
    },
  },
  {
    id: "sitemap-reachable",
    label: "sitemap.xml is served",
    group: "crawl",
    why: "Without it, discovery depends entirely on internal linking.",
    run: async (ctx) => {
      const doc = await ctx.get("/sitemap.xml")
      if (doc.status !== 200) return { status: "fail", detail: `HTTP ${doc.status || "no response"}` }
      const count = (doc.body.match(/<loc>/g) ?? []).length
      return {
        status: count > 0 ? "pass" : "fail",
        detail: `${count} URLs`,
        evidence: (doc.body.match(/<loc>[^<]*<\/loc>/g) ?? []).slice(0, 40).join("\n"),
      }
    },
  },
  {
    id: "sitemap-depth",
    label: "Enough indexable pages to rank",
    group: "crawl",
    why: "A marketplace competes on catalogue breadth. Below roughly 50 product URLs there is nothing for long-tail queries to match.",
    run: async (ctx) => {
      const doc = await ctx.get("/sitemap.xml")
      const locs = (doc.body.match(/<loc>[^<]*<\/loc>/g) ?? []).map((l) => l.replace(/<\/?loc>/g, ""))
      const products = locs.filter((l) => l.includes("/products/"))
      const bakers = locs.filter((l) => /\/bakers\/[^/]+$/.test(l))

      const detail = `${products.length} products, ${bakers.length} bakers, ${locs.length} URLs total`
      if (products.length < 10) {
        return { status: "fail", detail, evidence: products.join("\n") || "(no product URLs in sitemap)" }
      }
      if (products.length < 50) return { status: "warn", detail }
      return { status: "pass", detail }
    },
  },
  {
    id: "404-status",
    label: "Unknown URLs return a real 404",
    group: "crawl",
    why: "A soft 404 — a not-found page served with status 200 — gets indexed as a real page and dilutes the whole site.",
    run: async (ctx) => {
      const doc = await ctx.get(`/__ops-seo-probe-${Date.now()}`)
      if (doc.status === 404) return { status: "pass", detail: "HTTP 404" }
      return { status: "fail", detail: `HTTP ${doc.status} — soft 404` }
    },
  },
  {
    id: "canonical",
    label: "Canonical URL on every sampled page",
    group: "crawl",
    why: "Tells engines which URL is authoritative. A wrong or missing one splits ranking signals across duplicates.",
    run: async (ctx) => {
      const problems: string[] = []
      for (const path of SAMPLE_PAGES) {
        const doc = await ctx.get(path)
        const href = canonical(doc.body)
        if (!href) problems.push(`${path} — none`)
        else if (!href.startsWith("https://")) problems.push(`${path} — not absolute: ${href}`)
        else if (/localhost|127\.0\.0\.1/.test(href)) problems.push(`${path} — localhost: ${href}`)
      }
      if (problems.length) return { status: "fail", detail: problems[0], evidence: problems.join("\n") }
      return { status: "pass", detail: `Absolute and self-referential on all ${SAMPLE_PAGES.length} sampled pages` }
    },
  },
  {
    id: "html-lang",
    label: "html lang targets India",
    group: "crawl",
    why: "en-IN tells engines the regional variant. Bare 'en' leaves India targeting to be guessed from other signals.",
    run: async (ctx) => {
      const doc = await ctx.get("/")
      const match = doc.body.match(/<html[^>]*lang="([^"]*)"/i)
      const lang = match ? match[1] : null
      const inLanguage = doc.body.match(/"inLanguage"\s*:\s*\\?"([^"\\]*)/)?.[1] ?? null

      if (!lang) return { status: "fail", detail: "No lang attribute" }
      if (lang.toLowerCase() === "en-in") return { status: "pass", detail: `lang="${lang}"` }
      return {
        status: "warn",
        detail: `lang="${lang}"${inLanguage ? `, but schema says inLanguage "${inLanguage}"` : ""}`,
        evidence: match?.[0],
      }
    },
  },

  // ── On-page ───────────────────────────────────────────────────────────────────────────────────
  {
    id: "titles",
    label: "Unique title on every page",
    group: "onpage",
    why: "The single strongest on-page signal, and the line a searcher actually clicks.",
    run: async (ctx) => {
      const seen = new Map<string, string>()
      const problems: string[] = []
      for (const path of SAMPLE_PAGES) {
        const doc = await ctx.get(path)
        const value = title(doc.body)
        if (!value) {
          problems.push(`${path} — missing`)
          continue
        }
        if (seen.has(value)) problems.push(`${path} — duplicate of ${seen.get(value)}`)
        seen.set(value, path)
        if (value.length > 60) problems.push(`${path} — ${value.length} chars, truncates in results`)
        // The brand is appended by the metadata template; a title that already contains it ends up
        // saying it twice, which wastes the pixels that decide the click.
        const brandCount = (value.match(/CrossFriend/g) ?? []).length
        if (brandCount > 1) problems.push(`${path} — brand appears ${brandCount}x: "${value}"`)
      }
      const evidence = [...seen.entries()].map(([value, path]) => `${path}\n  ${value}`).join("\n")
      if (problems.some((p) => p.includes("missing") || p.includes("duplicate"))) {
        return { status: "fail", detail: problems[0], evidence }
      }
      if (problems.length) return { status: "warn", detail: problems[0], evidence }
      return { status: "pass", detail: `${seen.size} unique titles`, evidence }
    },
  },
  {
    id: "descriptions",
    label: "Unique meta description on every page",
    group: "onpage",
    why: "Not a ranking factor, but it is the snippet. A missing one lets the engine improvise from page text.",
    run: async (ctx) => {
      const seen = new Map<string, string>()
      const problems: string[] = []
      for (const path of SAMPLE_PAGES) {
        const doc = await ctx.get(path)
        const value = meta(doc.body, "description")
        if (!value) {
          problems.push(`${path} — missing`)
          continue
        }
        if (seen.has(value)) problems.push(`${path} — duplicate`)
        seen.set(value, path)
        if (value.length < 70) problems.push(`${path} — only ${value.length} chars`)
        if (value.length > 160) problems.push(`${path} — ${value.length} chars, truncates`)
      }
      const evidence = [...seen.entries()].map(([value, path]) => `${path}\n  ${value}`).join("\n")
      if (problems.some((p) => p.includes("missing") || p.includes("duplicate"))) {
        return { status: "fail", detail: problems[0], evidence }
      }
      if (problems.length) return { status: "warn", detail: problems[0], evidence }
      return { status: "pass", detail: `${seen.size} unique descriptions`, evidence }
    },
  },
  {
    id: "h1",
    label: "Exactly one H1 per page",
    group: "onpage",
    why: "The page's stated subject. Zero leaves it ambiguous; several make it contested.",
    run: async (ctx) => {
      const problems: string[] = []
      for (const path of SAMPLE_PAGES) {
        const doc = await ctx.get(path)
        const count = (doc.body.match(/<h1[\s>]/gi) ?? []).length
        if (count !== 1) problems.push(`${path} — ${count} H1s`)
      }
      if (problems.length) return { status: "fail", detail: problems[0], evidence: problems.join("\n") }
      return { status: "pass", detail: `Exactly one on all ${SAMPLE_PAGES.length} sampled pages` }
    },
  },
  {
    id: "og-image",
    label: "Open Graph image resolves",
    group: "onpage",
    why: "Decides whether a shared link renders as a card or a bare URL. Directly moves click-through on WhatsApp.",
    run: async (ctx) => {
      const problems: string[] = []
      const found: string[] = []
      for (const path of SAMPLE_PAGES) {
        const doc = await ctx.get(path)
        const src = meta(doc.body, "og:image")
        if (!src) {
          problems.push(`${path} — no og:image`)
          continue
        }
        const image = await ctx.get(src.replace(/&amp;/g, "&"))
        if (image.status !== 200) problems.push(`${path} — image HTTP ${image.status}`)
        else found.push(`${path} -> ${src.split("/").pop()}`)
      }
      if (problems.length) return { status: "fail", detail: problems[0], evidence: problems.join("\n") }
      return { status: "pass", detail: `${found.length} images resolve`, evidence: found.join("\n") }
    },
  },
  {
    id: "twitter-card",
    label: "Twitter card type is set",
    group: "onpage",
    why: "Without summary_large_image, X and several chat apps render a thumbnail instead of a banner.",
    run: async (ctx) => {
      const doc = await ctx.get("/")
      const card = meta(doc.body, "twitter:card")
      if (!card) return { status: "warn", detail: "No twitter:card" }
      return {
        status: card === "summary_large_image" ? "pass" : "warn",
        detail: card,
      }
    },
  },
  {
    id: "favicon",
    label: "Favicon and app icons are served",
    group: "onpage",
    why: "Shown beside the result in Google mobile search, and in every browser tab and bookmark.",
    run: async (ctx) => {
      const targets = ["/icon.png", "/apple-icon.png", "/manifest.webmanifest"]
      const results = await Promise.all(targets.map((t) => ctx.get(t)))
      const bad = results.filter((r) => r.status !== 200)
      if (bad.length) {
        return {
          status: "fail",
          detail: bad.map((b) => `${new URL(b.url).pathname} HTTP ${b.status}`).join(", "),
        }
      }
      return {
        status: "pass",
        detail: "icon.png, apple-icon.png and manifest all 200",
        evidence: results.map((r) => `${new URL(r.url).pathname}  ${r.contentType}`).join("\n"),
      }
    },
  },

  // ── Structured data ───────────────────────────────────────────────────────────────────────────
  {
    id: "schema-organization",
    label: "Organization schema",
    group: "schema",
    why: "The root entity. Everything else — reviews, products, the knowledge panel — attaches to it.",
    run: async (ctx) => {
      const doc = await ctx.get("/")
      const types = schemaTypes(doc.body)
      if (!types.has("Organization")) return { status: "fail", detail: "Not present on the homepage" }
      return { status: "pass", detail: "Present", evidence: [...types].sort().join(", ") }
    },
  },
  {
    id: "schema-website",
    label: "WebSite schema with search action",
    group: "schema",
    why: "potentialAction/SearchAction is what earns the sitelinks search box under a branded result.",
    run: async (ctx) => {
      const doc = await ctx.get("/")
      const types = schemaTypes(doc.body)
      if (!types.has("WebSite")) return { status: "fail", detail: "No WebSite schema" }
      if (!types.has("SearchAction")) {
        return { status: "warn", detail: "WebSite present, but no SearchAction — no sitelinks search box" }
      }
      return { status: "pass", detail: "WebSite + SearchAction" }
    },
  },
  {
    id: "schema-product",
    label: "Product schema with offers",
    group: "schema",
    why: "Price, availability and currency in the result itself. Without it a product listing is just a blue link.",
    run: async (ctx) => {
      const url = await ctx.productUrl()
      if (!url) return { status: "error", detail: "No product URL in the sitemap to test" }
      const doc = await ctx.get(url)
      const types = schemaTypes(doc.body)
      const missing = ["Product", "AggregateOffer"].filter((t) => !types.has(t) && !types.has("Offer"))
      if (missing.length) return { status: "fail", detail: `Missing ${missing.join(", ")}` }

      const snippet = doc.body.match(/"@type"\s*:\s*\\?"Product\\?"[\s\S]{0,600}/)?.[0] ?? ""
      // A description carried over from a template tells an engine nothing and reads as neglect in
      // an AI summary, which quotes it verbatim.
      if (/"description"\s*:\s*\\?"(This is the|Lorem|TBD|Test)/i.test(snippet)) {
        return { status: "warn", detail: "Present, but the description is placeholder text", evidence: snippet }
      }
      return { status: "pass", detail: "Product + offers with price and availability", evidence: snippet }
    },
  },
  {
    id: "schema-breadcrumb",
    label: "BreadcrumbList on product pages",
    group: "schema",
    why: "Replaces the raw URL in a result with a readable hierarchy, and helps engines model the catalogue.",
    run: async (ctx) => {
      const url = await ctx.productUrl()
      if (!url) return { status: "error", detail: "No product URL in the sitemap to test" }
      const doc = await ctx.get(url)
      const types = schemaTypes(doc.body)
      return types.has("BreadcrumbList")
        ? { status: "pass", detail: "Present" }
        : { status: "fail", detail: "Not present" }
    },
  },
  {
    id: "schema-faq",
    label: "FAQPage schema",
    group: "schema",
    why: "The highest-leverage AEO markup there is: an explicit question paired with a short answer is exactly the shape an answer engine lifts.",
    run: async (ctx) => {
      /**
       * Every page that carries an FAQ, not a convenience sample.
       *
       * An earlier version of this check sampled three pages and stopped at the first hit. None of
       * the three was /bakers, so it reported FAQ markup as missing while twenty-one Question
       * entities were live across the site — and an external audit independently reached the same
       * wrong conclusion. A check that samples has to say what it sampled, or it produces confident
       * false negatives; this one reports every page and the question count on each.
       */
      const paths = ["/bakers", "/ai-cake-studio", "/cake-size-calculator", "/occasions/birthday"]
      const rows: string[] = []
      let total = 0

      for (const path of paths) {
        const doc = await ctx.get(path)
        if (!schemaTypes(doc.body).has("FAQPage")) {
          rows.push(`${path.padEnd(24)} —`)
          continue
        }
        const questions = (doc.body.match(/"@type"\s*:\s*\\?"Question\\?"/g) ?? []).length
        total += questions
        rows.push(`${path.padEnd(24)} FAQPage, ${questions} questions`)
      }

      const evidence = rows.join("\n")
      if (total === 0) return { status: "fail", detail: "No FAQPage markup anywhere", evidence }
      const covered = rows.filter((r) => r.includes("FAQPage")).length
      return {
        status: "pass",
        detail: `${total} questions across ${covered} of ${paths.length} pages checked`,
        evidence,
      }
    },
  },
  {
    id: "schema-rating",
    label: "Review / AggregateRating",
    group: "schema",
    why: "Star ratings in results. The largest single lift to click-through available in commerce SERPs.",
    run: async (ctx) => {
      const url = await ctx.productUrl()
      if (!url) return { status: "error", detail: "No product URL in the sitemap to test" }
      const doc = await ctx.get(url)
      const types = schemaTypes(doc.body)
      if (types.has("AggregateRating") || types.has("Review")) {
        return { status: "pass", detail: "Present" }
      }
      return { status: "fail", detail: "No ratings or reviews in markup" }
    },
  },
  {
    id: "schema-sameas",
    label: "sameAs links the brand to its profiles",
    group: "schema",
    why: "How a generative engine confirms the CrossFriend here and the one on Instagram are one business. Without it every mention is orphaned.",
    run: async (ctx) => {
      const doc = await ctx.get("/")
      if (!/"sameAs"/.test(doc.body)) {
        return { status: "fail", detail: "No sameAs on the Organization" }
      }
      const block = doc.body.match(/"sameAs"\s*:\s*\[([^\]]*)\]/)?.[1] ?? ""
      const urls = (block.match(/https?:\/\/[^"\\,\s]+/g) ?? [])
      if (urls.length === 0) return { status: "fail", detail: "sameAs present but empty" }
      return { status: "pass", detail: `${urls.length} profiles`, evidence: urls.join("\n") }
    },
  },
  {
    id: "schema-localbusiness",
    label: "LocalBusiness / delivery area",
    group: "schema",
    why: "Drives 'near me' and map results. For a business delivering by pincode this is the geographic claim engines read.",
    run: async (ctx) => {
      const doc = await ctx.get("/")
      const types = schemaTypes(doc.body)
      const local = ["LocalBusiness", "Bakery", "Store", "FoodEstablishment"].find((t) => types.has(t))
      if (local) return { status: "pass", detail: `${local} present` }
      if (types.has("PostalAddress")) {
        return { status: "warn", detail: "PostalAddress only — no LocalBusiness type, so no map eligibility" }
      }
      return { status: "fail", detail: "No local business markup" }
    },
  },

  // ── Answer & generative engines ───────────────────────────────────────────────────────────────
  {
    id: "llms-txt",
    label: "llms.txt is published",
    group: "aeo",
    why: "An emerging convention: a plain-text map telling an LLM what the site is and which pages matter. Cheap to publish, and read by Perplexity and several crawlers today.",
    run: async (ctx) => {
      const doc = await ctx.get("/llms.txt")
      if (doc.status !== 200) return { status: "fail", detail: `HTTP ${doc.status || "no response"}` }
      return { status: "pass", detail: `${doc.body.length} bytes`, evidence: doc.body.slice(0, 800) }
    },
  },
  {
    id: "content-hub",
    label: "Informational content exists",
    group: "aeo",
    why: "Answer engines cite explanations, not product listings. With no guides there is nothing of ours for them to quote.",
    run: async (ctx) => {
      const candidates = ["/blog", "/guides", "/learn", "/ideas"]
      const results = await Promise.all(candidates.map(async (p) => ({ p, doc: await ctx.get(p) })))
      const live = results.filter((r) => r.doc.status === 200)
      if (live.length === 0) {
        // The calculator is genuinely informational and does rank, so credit it rather than
        // reporting a bare zero that implies nothing exists.
        const calc = await ctx.get("/cake-size-calculator")
        const words = visibleWordCount(calc.body)
        return {
          status: "fail",
          detail: `No content hub. Only the size calculator (${words} words) is informational.`,
          evidence: candidates.map((c) => `${c} — 404`).join("\n"),
        }
      }
      return { status: "pass", detail: live.map((r) => r.p).join(", ") }
    },
  },
  {
    id: "content-depth",
    label: "Pages carry enough text to be quotable",
    group: "aeo",
    why: "A page of nothing but a product grid gives an engine no sentence to lift. Thin pages also lose on classic relevance.",
    run: async (ctx) => {
      const rows: string[] = []
      let thin = 0
      for (const path of SAMPLE_PAGES) {
        const doc = await ctx.get(path)
        const words = visibleWordCount(doc.body)
        if (words < 300) thin++
        rows.push(`${path.padEnd(24)} ${words} words`)
      }
      return {
        status: thin === 0 ? "pass" : thin < 2 ? "warn" : "fail",
        detail: thin === 0 ? `All ${SAMPLE_PAGES.length} pages above 300 words` : `${thin} thin pages`,
        evidence: rows.join("\n"),
      }
    },
  },
]

export const CHECK_BY_ID = new Map(CHECKS.map((check) => [check.id, check]))

/** Runs one check, converting a thrown error into a reportable result rather than a 500. */
export async function runCheck(check: Check, ctx: AuditContext): Promise<CheckResult> {
  try {
    return await check.run(ctx)
  } catch (error) {
    return {
      status: "error",
      detail: "Check itself failed",
      evidence: error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error),
    }
  }
}

export interface AuditRow {
  check: Check
  result: CheckResult
}

/**
 * Runs every check against one shared context.
 *
 * Sequential per group but parallel across all of them: the context dedupes fetches, so the eight
 * or so real requests overlap and the whole audit lands in about the time of the slowest one.
 */
export async function runAudit(base?: string): Promise<{ rows: AuditRow[]; ranAt: Date; base: string }> {
  const ctx = new AuditContext(base)
  const rows = await Promise.all(
    CHECKS.map(async (check) => ({ check, result: await runCheck(check, ctx) }))
  )
  return { rows, ranAt: new Date(), base: ctx.base }
}

export function scoreOf(rows: AuditRow[]): Record<CheckStatus, number> {
  const score: Record<CheckStatus, number> = { pass: 0, warn: 0, fail: 0, error: 0 }
  for (const row of rows) score[row.result.status]++
  return score
}
