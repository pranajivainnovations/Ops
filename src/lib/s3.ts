/**
 * S3 upload for vendor/baker images — same bucket the backend already uses for AI Cake Studio
 * images, under its own `bakers-images/` prefix so it never collides with `ai-studio/...`.
 *
 * Storage structure:
 *   pranajiva-innovations/
 *   └── bakers-images/
 *       └── {bakerId}/
 *           ├── profile_{uuid}.{ext}   — single "most recent wins" image, shown small, not enlarged
 *           ├── banner_{uuid}.{ext}    — single "most recent wins" image, shown at the top of the page
 *           └── {uuid}.{ext}           — generic gallery images, no prefix, many per baker
 *
 * Public-read, unlike the private customer uploads in the backend — these are meant to eventually
 * show on a public vendor page.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import crypto from "crypto"

let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (s3Client) return s3Client

  const region = process.env.S3_REGION
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY must be set")
  }

  s3Client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } })
  return s3Client
}

function buildPublicUrl(s3Key: string): string {
  const bucket = process.env.S3_BUCKET || "pranajiva-innovations"
  const region = process.env.S3_REGION || "eu-north-1"
  const baseUrl = process.env.S3_URL || `https://${bucket}.s3.${region}.amazonaws.com`
  return `${baseUrl}/${s3Key}`
}

export type BakerImagePurpose = "profile" | "banner" | "generic"

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export const MAX_BAKER_IMAGE_BYTES = 8 * 1024 * 1024

export interface BakerImageUploadResult {
  s3Key: string
  url: string
}

/**
 * Uploads one baker vendor image. Internal ops tool, not a public upload surface, so validation is
 * proportionate — real size cap and an allowed-mime-type check, but not the full magic-byte
 * sniffing used for public customer uploads (lower risk profile: only logged-in ops staff can reach
 * this at all).
 */
export async function uploadBakerImage(
  bakerId: string,
  purpose: BakerImagePurpose,
  buffer: Buffer,
  mimeType: string
): Promise<BakerImageUploadResult> {
  if (buffer.length === 0) throw new Error("Uploaded file is empty.")
  if (buffer.length > MAX_BAKER_IMAGE_BYTES) {
    throw new Error(`Image must be under ${MAX_BAKER_IMAGE_BYTES / (1024 * 1024)}MB.`)
  }
  const extension = EXTENSION_BY_MIME[mimeType]
  if (!extension) throw new Error("File must be a JPEG, PNG, or WEBP image.")

  const uuid = crypto.randomUUID()
  const filename = purpose === "generic" ? `${uuid}.${extension}` : `${purpose}_${uuid}.${extension}`
  const s3Key = `bakers-images/${bakerId}/${filename}`

  const client = getS3Client()
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET || "pranajiva-innovations",
      Key: s3Key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: "public, max-age=31536000, immutable",
      ACL: "public-read",
    })
  )

  return { s3Key, url: buildPublicUrl(s3Key) }
}
