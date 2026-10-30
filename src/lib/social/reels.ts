import { getDbPool } from "@/lib/db"
import { type TakeStatus } from "./shot-types"

export { AUDIO_PRESETS, CAMERA_MOVES, SHOT_TYPES, dollars, type TakeStatus } from "./shot-types"

/**
 * Reading storyboards.
 *
 * Straight from the database, like every other OPS screen. The writes — planning a scene, starting
 * a render, saving an API key — go through the backend, because that is where the operator's
 * encrypted key lives and where the money is spent.
 */

export interface Take {
  id: string
  attempt: number
  composedPrompt: string
  interactionId: string | null
  videoUrl: string | null
  seconds: number | null
  cumulative: boolean | null
  status: TakeStatus
  error: string | null
  costCents: number | null
  startedAt: string
}

export interface Scene {
  id: string
  seq: number
  prompt: string
  shotType: string
  cameraMove: string
  audioNote: string
  avoid: string
  targetSeconds: number
  continuesFrom: string | null
  imageKeys: string[]
  chosenTakeId: string | null
  takes: Take[]
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
  scenes: Scene[]
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
  sceneCount: number
  renderedCount: number
  renderingCount: number
  seconds: number
  costCents: number
}

/** The take a scene settled on, or nothing while it is still being decided. */
export function chosenTake(scene: Scene): Take | null {
  return scene.takes.find((t) => t.id === scene.chosenTakeId) ?? null
}

/**
 * How long the reel actually runs.
 *
 * ── Why this is not simply the sum of the scenes ──────────────────────────────────────────────
 * Because it depends on something Google does not document: whether extending a clip returns the
 * continuation alone or the whole clip so far. If it returns the whole thing, a continuing scene
 * already contains everything before it, and adding them up would claim a 10-second reel runs 45
 * seconds.
 *
 * So each take records what was observed, and this trusts that. When the last chosen take is
 * cumulative it IS the reel, and its own length is the answer.
 */
export function runningSeconds(scenes: Scene[]): number {
  const chosen = scenes.map(chosenTake).filter((t): t is Take => Boolean(t && t.status === "ready"))
  if (!chosen.length) return 0

  const last = chosen[chosen.length - 1]
  if (last.cumulative && last.seconds) return Number(last.seconds)

  return chosen.reduce((total, t) => total + Number(t.seconds ?? 0), 0)
}

/** Every take ever attempted, which is what the reel actually cost — not just the keepers. */
export function totalCostCents(scenes: Scene[]): number {
  return scenes.reduce(
    (sum, scene) => sum + scene.takes.reduce((s, t) => s + (t.costCents ?? 0), 0),
    0
  )
}

/** Whether a finished reel needs stitching, which is the practical question `cumulative` answers. */
export function needsStitching(scenes: Scene[]): boolean | null {
  const measured = scenes
    .flatMap((s) => s.takes)
    .filter((t) => t.status === "ready" && t.cumulative !== null)
  if (!measured.length) return null
  return !measured[measured.length - 1].cumulative
}

export async function listReels(): Promise<ReelSummary[]> {
  const { rows } = await getDbPool().query(
    `WITH chosen AS (
       SELECT s.reel_id, s.seq, t.seconds, t.cumulative
         FROM social.reel_scenes s
         JOIN social.reel_takes t ON t.id = s.chosen_take_id AND t.status = 'ready'
     )
     SELECT r.id, r.title, r.brand, r.aspect_ratio, r.resolution, r.target_seconds,
            r.status, r.created_at,
            (SELECT count(*)::int FROM social.reel_scenes s WHERE s.reel_id = r.id) AS scene_count,
            (SELECT count(*)::int FROM chosen c WHERE c.reel_id = r.id)             AS rendered_count,
            (SELECT count(*)::int FROM social.reel_scenes s
               JOIN social.reel_takes t ON t.scene_id = s.id
              WHERE s.reel_id = r.id AND t.status = 'rendering')                    AS rendering_count,
            /* Every take, not just the keepers — this is what the reel cost. */
            COALESCE((SELECT SUM(t.cost_cents)::int FROM social.reel_scenes s
               JOIN social.reel_takes t ON t.scene_id = s.id
              WHERE s.reel_id = r.id AND t.status = 'ready'), 0)                    AS cost_cents,
            /* Mirrors runningSeconds: a cumulative final take is the whole reel on its own. */
            COALESCE((
              SELECT CASE WHEN last.cumulative THEN last.seconds
                          ELSE (SELECT SUM(c.seconds) FROM chosen c WHERE c.reel_id = r.id)
                     END
                FROM chosen last WHERE last.reel_id = r.id
               ORDER BY last.seq DESC LIMIT 1
            ), 0) AS seconds
       FROM social.reels r
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
    sceneCount: r.scene_count,
    renderedCount: r.rendered_count,
    renderingCount: r.rendering_count,
    seconds: Number(r.seconds ?? 0),
    costCents: r.cost_cents,
  }))
}

export async function getReel(id: string): Promise<Reel | null> {
  /* A malformed id would make the ::uuid cast throw, and a bad URL is a not-found. */
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null

  const { rows } = await getDbPool().query(
    `SELECT r.*, COALESCE(NULLIF(u.name, ''), u.email) AS created_by_name,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'id', s.id, 'seq', s.seq, 'prompt', s.prompt,
                       'shotType', s.shot_type, 'cameraMove', s.camera_move,
                       'audioNote', s.audio_note, 'avoid', s.avoid,
                       'targetSeconds', s.target_seconds, 'continuesFrom', s.continues_from,
                       'imageKeys', s.image_keys, 'chosenTakeId', s.chosen_take_id,
                       'takes', COALESCE((
                         SELECT json_agg(json_build_object(
                                  'id', t.id, 'attempt', t.attempt,
                                  'composedPrompt', t.composed_prompt,
                                  'interactionId', t.interaction_id, 'videoUrl', t.video_url,
                                  'seconds', t.seconds, 'cumulative', t.cumulative,
                                  'status', t.status, 'error', t.error,
                                  'costCents', t.cost_cents, 'startedAt', t.started_at
                                ) ORDER BY t.attempt)
                           FROM social.reel_takes t WHERE t.scene_id = s.id
                       ), '[]'::json)
                     ) ORDER BY s.seq)
                FROM social.reel_scenes s WHERE s.reel_id = r.id
            ), '[]'::json) AS scenes
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
    scenes: (r.scenes ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      imageKeys: (s.imageKeys as string[]) ?? [],
      /* Postgres NUMERIC arrives as a string; the arithmetic downstream assumes a number. */
      takes: ((s.takes as Record<string, unknown>[]) ?? []).map((t) => ({
        ...t,
        seconds: t.seconds === null ? null : Number(t.seconds),
      })),
    })) as Scene[],
  }
}

/**
 * The public URL for a stored reference image.
 *
 * Built here rather than stored on the row, so the bucket or a CDN in front of it can change
 * without rewriting history. Mirrors the backend's helper — if that moves, this follows.
 */
export function anchorUrl(key: string): string {
  const bucket = process.env.S3_BUCKET || "pranajiva-innovations"
  const region = process.env.S3_REGION || "eu-north-1"
  const base = process.env.S3_URL || `https://${bucket}.s3.${region}.amazonaws.com`
  return `${base}/${key}`
}
