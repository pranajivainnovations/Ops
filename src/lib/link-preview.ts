import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

/**
 * Reads the Open Graph card off a page somebody linked on the team board.
 *
 * Called once, when the message is posted — never at render time. See the migration comment for why
 * the result is stored rather than re-fetched.
 *
 * ── This makes our server fetch a URL a person typed, so it is a request forgery surface ───────
 * Only ops staff can reach it, which lowers the odds but not the consequences: this container sits
 * on the same network as the database and the Medusa backend, and cloud metadata endpoints are one
 * plausible link away. So the address is checked rather than the hostname — a name is just a lookup
 * that can point anywhere, and `http://internal.example.com` resolving to 10.0.0.5 is the whole
 * attack. Redirects are followed manually so each hop gets the same check; following them with
 * fetch's own redirect handling would validate the first address and then quietly go somewhere else.
 *
 * Everything here fails soft. A preview that cannot be read is not an error worth showing anybody —
 * the message posts, and the link renders as a link.
 */

const TIMEOUT_MS = 5000
const MAX_BYTES = 512 * 1024
const MAX_REDIRECTS = 3

export interface LinkPreview {
  url: string
  title: string | null
  description: string | null
  imageUrl: string | null
  siteName: string | null
}

/**
 * The first http(s) URL in a message, which is the one the card describes.
 *
 * One preview per message, not one per link: a message with five links wants to be a list, and five
 * stacked cards would bury the sentence that explains them.
 */
export function firstUrl(text: string): string | null {
  const match = /\bhttps?:\/\/[^\s<>"')]+/i.exec(text)
  if (!match) return null
  // Trailing punctuation is nearly always the sentence's, not the URL's.
  return match[0].replace(/[.,;:!?]+$/, "")
}

/**
 * Blocks anything that is not a public address.
 *
 * The ranges are the ones that reach something we do not want reached from a text box: loopback,
 * the three private IPv4 blocks, link-local (which is where 169.254.169.254 lives — cloud instance
 * metadata, the single most valuable target here), carrier-grade NAT, and the IPv6 equivalents
 * including the v4-mapped form, since ::ffff:10.0.0.1 is 10.0.0.1 wearing a hat.
 */
function isPublicAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 0) return false

  if (version === 4) {
    const [a, b] = address.split(".").map(Number)
    if (a === 0 || a === 127) return false // this network, loopback
    if (a === 10) return false // private
    if (a === 172 && b >= 16 && b <= 31) return false // private
    if (a === 192 && b === 168) return false // private
    if (a === 169 && b === 254) return false // link-local, incl. cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return false // carrier-grade NAT
    if (a >= 224) return false // multicast and reserved
    return true
  }

  const lower = address.toLowerCase()
  if (lower === "::" || lower === "::1") return false
  // ::ffff:10.0.0.1 — an IPv4 address in IPv6 clothing. Re-check it as what it is.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower)
  if (mapped) return isPublicAddress(mapped[1])
  if (/^f[cd]/.test(lower)) return false // unique local
  if (/^fe[89ab]/.test(lower)) return false // link-local
  return true
}

/** Parses and vets one hop. Returns null for anything we will not fetch. */
async function safeUrl(raw: string): Promise<URL | null> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null

  try {
    // `all` so a hostname with one public and one private record cannot pass on the public one and
    // then be reached on the private one.
    const records = await lookup(url.hostname, { all: true })
    if (records.length === 0) return null
    if (!records.every((record) => isPublicAddress(record.address))) return null
  } catch {
    return null
  }

  return url
}

/** The <head> only — enough for the meta tags, and a bounded amount of somebody else's page. */
async function readHead(url: URL): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    let current = url
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          // Identifying ourselves honestly. Sites that block unknown agents should block us, not be
          // fooled into serving a page we then store.
          "User-Agent": "CrossFriendOps/1.0 (+https://crossfriend.in) link-preview",
          Accept: "text/html,application/xhtml+xml",
        },
        cache: "no-store",
      })

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location")
        if (!location) return null
        const next = await safeUrl(new URL(location, current).toString())
        if (!next) return null
        current = next
        continue
      }

      if (!res.ok) return null
      if (!(res.headers.get("content-type") ?? "").includes("text/html")) return null

      /* Streamed and cut off rather than res.text(): a page that never ends, or one that is 400MB,
         should cost us half a megabyte and no more. */
      const reader = res.body?.getReader()
      if (!reader) return null

      const decoder = new TextDecoder()
      let html = ""
      let bytes = 0
      while (bytes < MAX_BYTES) {
        const { done, value } = await reader.read()
        if (done) break
        bytes += value.length
        html += decoder.decode(value, { stream: true })
        // The tags we want are in the head; there is no reason to keep reading the body.
        if (/<\/head>/i.test(html)) break
      }
      await reader.cancel().catch(() => {})
      return html
    }
    return null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** One meta tag by property or name, whichever the page used. */
function meta(html: string, key: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)\\s*=\\s*["']${key}["'][^>]*>`,
    "i"
  )
  const tag = pattern.exec(html)?.[0]
  if (!tag) return null
  const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]
  return content ? decodeEntities(content).trim() || null : null
}

/** The five entities that actually appear in title tags. A full table would be a parser. */
function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
}

function clamp(value: string | null, max: number): string | null {
  if (!value) return null
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview | null> {
  const url = await safeUrl(rawUrl)
  if (!url) return null

  const html = await readHead(url)
  if (!html) return null

  const title =
    meta(html, "og:title") ??
    meta(html, "twitter:title") ??
    decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").trim() ??
    null

  const rawImage = meta(html, "og:image") ?? meta(html, "twitter:image")
  let imageUrl: string | null = null
  if (rawImage) {
    try {
      // Resolved against the page, since og:image is often a path. Only http(s) survives — the
      // storefront renders this in an <img>, and a data: or javascript: value has no business there.
      const resolved = new URL(rawImage, url)
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        imageUrl = resolved.toString()
      }
    } catch {
      imageUrl = null
    }
  }

  const description = meta(html, "og:description") ?? meta(html, "description")
  const siteName = meta(html, "og:site_name") ?? url.hostname.replace(/^www\./, "")

  // A card with nothing but a hostname is worse than the link it replaces.
  if (!title && !description && !imageUrl) return null

  return {
    url: url.toString(),
    title: clamp(title, 200),
    description: clamp(description, 300),
    imageUrl,
    siteName: clamp(siteName, 80),
  }
}
