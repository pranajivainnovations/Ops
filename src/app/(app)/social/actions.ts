"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getCurrentSession } from "@/lib/auth"
import { callBackend } from "@/lib/backend"

/**
 * Every write the Social screens make.
 *
 * All through the backend, and here that is not a convention but a requirement: the operator's API
 * key is encrypted with a secret only the backend holds. An OPS instance that could encrypt a key
 * could decrypt everybody's, which is the one thing the design exists to prevent. The money is the
 * other reason — a render is charged to a person's own card, and the rules about whose and how much
 * belong next to the key rather than in a screen.
 */

export interface Result {
  error?: string
  ok?: string
}

async function requireUser(): Promise<string> {
  const session = await getCurrentSession()
  if (!session?.userId) throw new Error("Your session has expired. Sign in again.")
  return session.userId
}

/* ── The key ───────────────────────────────────────────────────────────────────────────────── */

export async function saveApiKey(_prev: Result, formData: FormData): Promise<Result> {
  let opsUserId: string
  try {
    opsUserId = await requireUser()
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Not signed in." }
  }

  const apiKey = String(formData.get("apiKey") ?? "").trim()
  if (!apiKey) return { error: "Paste your Gemini API key." }

  /* Dollars on the screen, cents on the wire — the column is an integer so the rounding happens
     once, here, rather than differently in three places. */
  const capDollars = Number(String(formData.get("capDollars") ?? "20"))
  if (!Number.isFinite(capDollars) || capDollars < 1 || capDollars > 1000) {
    return { error: "Set a monthly ceiling between $1 and $1,000." }
  }

  const { error } = await callBackend("/ops/social/credentials", {
    action: "save",
    opsUserId,
    apiKey,
    model: String(formData.get("model") ?? "gemini-omni-1.1-flash"),
    monthlyCapCents: Math.round(capDollars * 100),
  })

  if (error) return { error }

  revalidatePath("/social/settings")
  return { ok: "Saved. The key is encrypted and cannot be read back — only replaced." }
}

export async function forgetApiKey(): Promise<Result> {
  let opsUserId: string
  try {
    opsUserId = await requireUser()
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Not signed in." }
  }

  const { error } = await callBackend("/ops/social/credentials", { action: "forget", opsUserId })
  if (error) return { error }

  revalidatePath("/social/settings")
  return { ok: "Key removed. Nothing can be generated until another is added." }
}

/* ── Reels ─────────────────────────────────────────────────────────────────────────────────── */

export async function createReel(_prev: Result, formData: FormData): Promise<Result> {
  let opsUserId: string
  try {
    opsUserId = await requireUser()
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Not signed in." }
  }

  const { data, error } = await callBackend<{ id: string }>("/ops/social/reels", {
    action: "create",
    opsUserId,
    title: String(formData.get("title") ?? ""),
    brand: String(formData.get("brand") ?? "pranajiva"),
    aspectRatio: String(formData.get("aspectRatio") ?? "9:16"),
    resolution: String(formData.get("resolution") ?? "720p"),
    targetSeconds: Number(formData.get("targetSeconds") ?? 25),
  })

  if (error || !data) return { error: error ?? "The reel was not created." }

  revalidatePath("/social")
  /* Straight into the builder: a reel with no shots is not something anybody wants to look at. */
  redirect(`/social/${data.id}`)
}

export async function closeReel(reelId: string, status: "done" | "abandoned"): Promise<Result> {
  try {
    await requireUser()
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Not signed in." }
  }

  const { error } = await callBackend("/ops/social/reels", { action: "close", reelId, status })
  if (error) return { error }

  revalidatePath("/social")
  revalidatePath(`/social/${reelId}`)
  return { ok: status === "done" ? "Reel marked finished." : "Reel abandoned." }
}

/* ── Scenes ────────────────────────────────────────────────────────────────────────────────── */

/**
 * Stores a reference image and returns its key.
 *
 * Separate from saving the scene, because an operator picks frames and then writes around them,
 * and folding the upload into the same submit would re-upload every image on each corrected typo.
 */
export async function uploadAnchor(
  reelId: string,
  formData: FormData
): Promise<{ key?: string; url?: string; error?: string }> {
  try {
    await requireUser()
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Not signed in." }
  }

  const file = formData.get("file")
  if (!(file instanceof File) || !file.size) return { error: "Choose an image first." }

  if (file.size > 12 * 1024 * 1024) {
    return { error: "That image is over 12MB. Export it smaller — a reference frame does not need more." }
  }

  const { data, error } = await callBackend<{ key: string; url: string }>("/ops/social/anchors", {
    reelId,
    data: Buffer.from(await file.arrayBuffer()).toString("base64"),
    mimeType: file.type || "image/jpeg",
  })

  if (error || !data) return { error: error ?? "The image was not stored." }
  return data
}

export async function addScene(reelId: string): Promise<Result> {
  try {
    await requireUser()
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Not signed in." }
  }

  const { error } = await callBackend("/ops/social/scenes", { action: "add", reelId })
  if (error) return { error }

  revalidatePath(`/social/${reelId}`)
  return { ok: "Scene added." }
}

export interface ScenePatch {
  prompt: string
  shotType: string
  cameraMove: string
  audioNote: string
  avoid: string
  targetSeconds: number
  continuesFrom: string | null
  imageKeys: string[]
}

export async function saveScene(
  reelId: string,
  sceneId: string,
  patch: ScenePatch
): Promise<Result> {
  try {
    await requireUser()
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Not signed in." }
  }

  const { error } = await callBackend("/ops/social/scenes", {
    action: "update",
    sceneId,
    ...patch,
  })
  if (error) return { error }

  revalidatePath(`/social/${reelId}`)
  return { ok: "Saved." }
}

/**
 * The exact text a render would send.
 *
 * Composed by the backend using the same function a render uses, rather than reassembled here —
 * a preview built by different code is a preview that is eventually wrong, and at roughly fifty
 * cents a take the operator is entitled to read what they are buying.
 */
export async function previewScene(patch: ScenePatch): Promise<{ prompt?: string; error?: string }> {
  try {
    await requireUser()
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Not signed in." }
  }

  const { data, error } = await callBackend<{ prompt: string }>("/ops/social/scenes", {
    action: "preview",
    ...patch,
  })

  if (error || !data) return { error: error ?? "Could not build the preview." }
  return { prompt: data.prompt }
}

export async function deleteScene(reelId: string, sceneId: string): Promise<Result> {
  try {
    await requireUser()
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Not signed in." }
  }

  const { error } = await callBackend("/ops/social/scenes", { action: "delete", sceneId })
  if (error) return { error }

  revalidatePath(`/social/${reelId}`)
  return { ok: "Scene removed." }
}

export async function moveScene(
  reelId: string,
  sceneId: string,
  direction: "up" | "down"
): Promise<Result> {
  try {
    await requireUser()
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Not signed in." }
  }

  const { error } = await callBackend("/ops/social/scenes", { action: "move", sceneId, direction })
  if (error) return { error }

  revalidatePath(`/social/${reelId}`)
  return { ok: "Moved." }
}

export async function renderScene(reelId: string, sceneId: string): Promise<Result> {
  let opsUserId: string
  try {
    opsUserId = await requireUser()
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Not signed in." }
  }

  const { data, error } = await callBackend<{ attempt: number }>("/ops/social/scenes", {
    action: "render",
    sceneId,
    opsUserId,
  })
  if (error) return { error }

  revalidatePath(`/social/${reelId}`)
  return { ok: `Take ${data?.attempt ?? ""} is rendering. It takes a few minutes.` }
}

export async function chooseTake(
  reelId: string,
  sceneId: string,
  takeId: string | null
): Promise<Result> {
  try {
    await requireUser()
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Not signed in." }
  }

  const { error } = await callBackend("/ops/social/scenes", { action: "choose", sceneId, takeId })
  if (error) return { error }

  revalidatePath(`/social/${reelId}`)
  return { ok: takeId ? "Take selected." : "Selection cleared." }
}

export async function abandonTake(reelId: string, takeId: string): Promise<Result> {
  try {
    await requireUser()
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Not signed in." }
  }

  const { error } = await callBackend("/ops/social/shots", { action: "abandon", takeId })
  if (error) return { error }

  revalidatePath(`/social/${reelId}`)
  return { ok: "Marked failed. It may still have been billed." }
}
