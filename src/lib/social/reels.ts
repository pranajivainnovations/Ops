import { getDbPool } from "@/lib/db"
import { type ShotMode, type ShotStatus } from "./shot-types"

/* Re-exported so a server component can keep importing everything reel-related from one place. */
export { MODE_LABEL, dollars, type ShotMode, type ShotStatus } from "./shot-types"

/**
 * Reading reels and their shots.
 *
 * Straight from the database, like every other OPS screen. The writes — creating a reel, starting
 * a render, saving an API key — all go through the backend, because that is where the operator's
 * encrypted key lives and where the money is spent. See the actions file.
 */

export interface Shot {
  id: string
  seq: number
  mode: ShotMode
  prompt: string
  firstImageKey: string | null
  lastImageKey: string | null
  interactionId: string | null
  videoUrl: string | null
  seconds: number | null
  cumulative: boolean | null
  status: ShotStatus
  error: string | null
  costCents: number | null
  startedAt: string | null
  finishedAt: string | null
}

export interface Reel {
  id: string
  title: string
  brand: string
  aspectRatio: string
  resolution: string
  targetSeconds: number
  status: string
  createdAt: string
  createdByName: string | null
  shots: Shot[]
}

export interface ReelSummary {
  id: string
  title: string
  brand: string
  aspectRatio: string
  resolution: string
  targetSeconds: number
  status: string
  createdAt: string
  shotCount: number
  readyCount: number
  renderingCount: number
  /** Seconds across ready shots — see `runningSeconds` for why this is not simply their sum. */
  seconds: number
  costCents: number
}

/**
 * How long the reel actually runs.
 *
 * ── Why this is not the sum of the shots ──────────────────────────────────────────────────────
 * Because it depends on something Google does not document: whether extending a clip returns the
 * continuation alone or the whole clip so far. If it returns the whole thing, every shot after the
 * first already contains the ones before it, and adding them up would claim a 10-second reel is 45
 * seconds long.
 *
 * So each shot records what was observed — `cumulative` — and this trusts that. When the last ready
 * shot is cumulative, it IS the reel and its own length is the answer. Otherwise the parts are
 * summed. Until a continuation has been measured the two agree anyway, because there is only one
 * shot.
 */
export function runningSeconds(shots: Shot[]): number {
  const ready = shots.filter((s) => s.status === "ready")
  if (!ready.length) return 0

  const last = ready[ready.length - 1]
  if (last.cumulative && last.seconds) return Number(last.seconds)

  return ready.reduce((total, s) => total + Number(s.seconds ?? 0), 0)
}

/** Whether a finished reel needs stitching, which is the practical question `cumulative` answers. */
export function needsStitching(shots: Shot[]): boolean | null {
  const measured = shots.filter((s) => s.status === "ready" && s.cumulative !== null)
  if (!measured.length) return null
  return !measured[measured.length - 1].cumulative
}

export async function listReels(): Promise<ReelSummary[]> {
  const { rows } = await getDbPool().query(
    `SELECT r.id, r.title, r.brand, r.aspect_ratio, r.resolution, r.target_seconds,
            r.status, r.created_at,
            COUNT(s.id)::int                                            AS shot_count,
            COUNT(s.id) FILTER (WHERE s.status = 'ready')::int           AS ready_count,
            COUNT(s.id) FILTER (WHERE s.status = 'rendering')::int       AS rendering_count,
            COALESCE(SUM(s.cost_cents) FILTER (WHERE s.status = 'ready'), 0)::int AS cost_cents,
            /* The cumulative flag on the LAST ready shot decides whether the parts overlap, so the
               length is resolved in SQL the same way runningSeconds resolves it in TypeScript. */
            COALESCE((
              SELECT CASE WHEN last.cumulative THEN last.seconds
                          ELSE (SELECT SUM(x.seconds) FROM social.reel_shots x
                                 WHERE x.reel_id = r.id AND x.status = 'ready')
                     END
                FROM social.reel_shots last
               WHERE last.reel_id = r.id AND last.status = 'ready'
               ORDER BY last.seq DESC LIMIT 1
            ), 0) AS seconds
       FROM social.reels r
       LEFT JOIN social.reel_shots s ON s.reel_id = r.id
      GROUP BY r.id
      ORDER BY r.created_at DESC
      LIMIT 200`
  )

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    brand: r.brand,
    aspectRatio: r.aspect_ratio,
    resolution: r.resolution,
    targetSeconds: r.target_seconds,
    status: r.status,
    createdAt: r.created_at,
    shotCount: r.shot_count,
    readyCount: r.ready_count,
    renderingCount: r.rendering_count,
    seconds: Number(r.seconds ?? 0),
    costCents: r.cost_cents,
  }))
}

export async function getReel(id: string): Promise<Reel | null> {
  /* A malformed id would make the ::uuid cast throw, and a bad URL is a not-found rather than a
     server error. */
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null

  const { rows } = await getDbPool().query(
    `SELECT r.*, COALESCE(NULLIF(u.name, ''), u.email) AS created_by_name,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'id', s.id, 'seq', s.seq, 'mode', s.mode, 'prompt', s.prompt,
                       'firstImageKey', s.first_image_key, 'lastImageKey', s.last_image_key,
                       'interactionId', s.interaction_id, 'videoUrl', s.video_url,
                       'seconds', s.seconds, 'cumulative', s.cumulative,
                       'status', s.status, 'error', s.error, 'costCents', s.cost_cents,
                       'startedAt', s.started_at, 'finishedAt', s.finished_at
                     ) ORDER BY s.seq)
                FROM social.reel_shots s WHERE s.reel_id = r.id
            ), '[]'::json) AS shots
       FROM social.reels r
       LEFT JOIN baker_network.ops_users u ON u.id = r.created_by
      WHERE r.id = $1::uuid`,
    [id]
  )

  const r = rows[0]
  if (!r) return null

  return {
    id: r.id,
    title: r.title,
    brand: r.brand,
    aspectRatio: r.aspect_ratio,
    resolution: r.resolution,
    targetSeconds: r.target_seconds,
    status: r.status,
    createdAt: r.created_at,
    createdByName: r.created_by_name ?? null,
    shots: (r.shots ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      seconds: s.seconds === null ? null : Number(s.seconds),
    })) as Shot[],
  }
}

/**
 * The public URL for a stored anchor frame.
 *
 * Built here rather than stored on the row, so the bucket or the CDN in front of it can change
 * without rewriting history. Mirrors the backend's own helper — if that one moves, this follows.
 */
export function anchorUrl(key: string): string {
  const bucket = process.env.S3_BUCKET || "pranajiva-innovations"
  const region = process.env.S3_REGION || "eu-north-1"
  const base = process.env.S3_URL || `https://${bucket}.s3.${region}.amazonaws.com`
  return `${base}/${key}`
}
