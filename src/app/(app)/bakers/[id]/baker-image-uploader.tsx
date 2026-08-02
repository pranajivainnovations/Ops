"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { uploadBakerImageAction } from "./image-actions"
import type { BakerImagePurpose } from "@/lib/s3"

export default function BakerImageUploader({
  bakerId,
  purpose,
  label,
}: {
  bakerId: string
  purpose: BakerImagePurpose
  label: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    const formData = new FormData()
    formData.append("file", file)
    startTransition(async () => {
      const result = await uploadBakerImageAction(bakerId, purpose, formData)
      if (result.error) setError(result.error)
      else router.refresh()
      if (inputRef.current) inputRef.current.value = ""
    })
  }

  return (
    <div>
      <label
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 ${
          pending ? "cursor-not-allowed opacity-60" : ""
        }`}
      >
        {pending ? "Uploading..." : label}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleChange}
          disabled={pending}
        />
      </label>
      {error && <p className="mt-1 text-[11px] font-semibold text-red-600">{error}</p>}
    </div>
  )
}
