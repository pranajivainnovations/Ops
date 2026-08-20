/**
 * Presentation helpers shared by the research list and the document viewer.
 *
 * Kept out of lib/google-drive.ts on purpose: that file is the Drive contract, and how a MIME type
 * is spelled for a human is a decision this screen makes, not something the API dictates.
 */

const MIME_LABELS: Record<string, string> = {
  "application/vnd.google-apps.document": "Google Doc",
  "application/vnd.google-apps.spreadsheet": "Google Sheet",
  "application/vnd.google-apps.presentation": "Google Slides",
  "text/markdown": "Markdown",
  "text/plain": "Text",
  "text/csv": "CSV",
  "application/json": "JSON",
  "application/pdf": "PDF",
}

export function mimeLabel(mimeType: string): string {
  if (MIME_LABELS[mimeType]) return MIME_LABELS[mimeType]
  if (mimeType.startsWith("image/")) return "Image"
  // Anything unrecognised shows its subtype rather than "Unknown" — "vnd.ms-excel" is at least a
  // clue, and a viewer that says "Unknown" for everything it has not been taught is useless.
  return mimeType.split("/").pop()?.slice(0, 24) ?? "File"
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** How long ago, for the list — "when did this pipeline last produce something" at a glance. */
export function relativeTime(iso: string | null): string {
  if (!iso) return "—"
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "—"

  const minutes = Math.round((Date.now() - then) / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.round(months / 12)}y ago`
}

export function formatSize(bytes: number | null): string {
  // Google-native files report no size — they have no stored bytes until exported, so "—" is the
  // honest answer rather than "0 B".
  if (bytes === null || Number.isNaN(bytes)) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Frontmatter `status: draft` deserves a colour; anything unrecognised stays neutral. */
export function statusClass(status: string): string {
  const value = status.toLowerCase()
  if (value === "final" || value === "published" || value === "approved") {
    return "bg-emerald-100 text-emerald-800"
  }
  if (value === "draft" || value === "wip" || value === "in-progress") {
    return "bg-amber-100 text-amber-800"
  }
  if (value === "rejected" || value === "archived" || value === "obsolete") {
    return "bg-slate-200 text-slate-600"
  }
  return "bg-slate-100 text-slate-600"
}
