"use server"

import { revalidatePath } from "next/cache"
import { getDbPool } from "@/lib/db"
import { uploadBakerImage, type BakerImagePurpose } from "@/lib/s3"

export async function uploadBakerImageAction(
  bakerId: string,
  purpose: BakerImagePurpose,
  formData: FormData
): Promise<{ error?: string }> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image to upload." }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const { s3Key, url } = await uploadBakerImage(bakerId, purpose, buffer, file.type)

    const db = getDbPool()
    await db.query(
      `INSERT INTO baker_network.baker_images
        (baker_id, purpose, s3_key, url, original_filename, mime_type, size_bytes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [bakerId, purpose, s3Key, url, file.name || null, file.type, file.size]
    )
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed." }
  }

  revalidatePath(`/bakers/${bakerId}`)
  return {}
}
