/**
 * Whether a business already has a website — Yes with the link behind it, or a plain No.
 *
 * Shared rather than re-implemented per page because the two halves have to stay together. Several
 * screens used to render the link only when one existed, which reads as "no website" and "not
 * checked yet" being the same thing. They are not: for outreach, "no website" IS the pitch, and a
 * blank cell hides the single most useful fact on the row.
 *
 * The link never carries the URL as its text. A Google Places website_url is routinely 80+
 * characters and would blow out a table column; the URL lives in the title attribute and the href,
 * where it is available without costing the layout.
 */
export default function WebsiteCell({
  url,
  className = "",
}: {
  url: string | null | undefined
  className?: string
}) {
  if (!url) {
    return <span className={`text-slate-400 ${className}`}>No</span>
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={url}
      className={`font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900 ${className}`}
    >
      Yes
    </a>
  )
}
