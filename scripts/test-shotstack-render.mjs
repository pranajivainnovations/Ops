/**
 * End-to-end probe of the Shotstack render pipeline.
 *
 * Submits a three-second edit to the STAGE environment, polls until it finishes, and prints the
 * resulting URL. This is the smallest thing that proves the whole path works — credentials, the
 * edit schema, the queue, and the CDN — before any of it is wired into the P05 video pipeline.
 *
 * ── Usage ──────────────────────────────────────────────────────────────────────────────────────
 *   SHOTSTACK_API_KEY=<key> node scripts/test-shotstack-render.mjs
 *   SHOTSTACK_API_KEY=<key> node scripts/test-shotstack-render.mjs --env v1   (production)
 *
 * The key is read from the environment and never written into this file. Committing a Shotstack key
 * would let anyone who reads the repo spend the account's render credits, and a key in git history
 * outlives every attempt to remove it.
 *
 * Stage is the default deliberately. Stage renders are free and watermark-free but expire after 24
 * hours; v1 renders cost credits. A test that silently billed the production account would be a bad
 * default for a file whose whole purpose is being run repeatedly.
 */

import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))

const API_KEY = process.env.SHOTSTACK_API_KEY
if (!API_KEY) {
  console.error("SHOTSTACK_API_KEY is not set.")
  console.error("Run: SHOTSTACK_API_KEY=<key> node scripts/test-shotstack-render.mjs")
  process.exit(1)
}

const envArg = process.argv.indexOf("--env")
const STAGE = envArg !== -1 ? process.argv[envArg + 1] : "stage"
const BASE = `https://api.shotstack.io/edit/${STAGE}`

/** Renders are queued, so the first poll almost never finds it done. */
const POLL_INTERVAL_MS = 3000
const MAX_WAIT_MS = 180_000

const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "x-api-key": API_KEY,
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function submit(edit) {
  const res = await fetch(`${BASE}/render`, {
    method: "POST",
    headers,
    body: JSON.stringify(edit),
  })

  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw new Error(`Shotstack returned a non-JSON body (HTTP ${res.status}): ${text.slice(0, 400)}`)
  }

  if (!res.ok) {
    /**
     * Shotstack puts schema complaints in response.error, and they are the useful part — a 400 here
     * almost always means the edit JSON is malformed rather than that anything is wrong with the
     * account. Surfacing the raw body beats "request failed".
     */
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(body, null, 2)}`)
  }

  const id = body?.response?.id
  if (!id) throw new Error(`No render id in response: ${JSON.stringify(body)}`)
  return id
}

async function poll(id) {
  const startedAt = Date.now()
  let last = null

  while (Date.now() - startedAt < MAX_WAIT_MS) {
    const res = await fetch(`${BASE}/render/${id}`, { headers })
    const body = await res.json()

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} while polling: ${JSON.stringify(body)}`)
    }

    const status = body?.response?.status
    if (status !== last) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0)
      console.log(`  [${elapsed}s] ${status}`)
      last = status
    }

    if (status === "done") return body.response
    // "failed" is terminal — Shotstack does not retry, so continuing to poll would just burn the
    // timeout and report a less useful error than the one already in hand.
    if (status === "failed") {
      throw new Error(`Render failed: ${body?.response?.error ?? "no reason given"}`)
    }

    await sleep(POLL_INTERVAL_MS)
  }

  throw new Error(`Gave up after ${MAX_WAIT_MS / 1000}s — last status was "${last}"`)
}

const edit = JSON.parse(await readFile(join(HERE, "shotstack-edit.json"), "utf8"))

console.log(`environment : ${STAGE}`)
console.log(`edit        : ${edit.output.resolution} ${edit.output.format}, ${edit.timeline.tracks[0].clips[0].length}s`)
console.log("")

console.log("submitting…")
const id = await submit(edit)
console.log(`render id   : ${id}`)
console.log("")

console.log("polling…")
const result = await poll(id)

console.log("")
console.log("URL:", result.url)
if (STAGE === "stage") {
  console.log("(stage renders expire 24 hours after creation)")
}
