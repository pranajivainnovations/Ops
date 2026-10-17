import Link from "next/link"

import { formatPaise, listCatalogue } from "@/lib/pranajiva/catalogue"
import { SectionHeader, StatCard } from "../_components/section"

/**
 * The live PranaJiva catalogue.
 *
 * Distinct from /pranajiva/products next door, which is the research portfolio — eighteen product
 * *concepts* and what was decided about each. This is the seventeen things customers can actually
 * see and buy, read from Medusa rather than from Drive.
 *
 * ── Why the warnings are the main column ──────────────────────────────────────────────────────
 * Medusa's own admin shows every one of these products as a perfectly healthy row. It has no
 * opinion about a product with no photograph, which is silently dropped from the Google Merchant
 * feed, or one with no INR price, which cannot be added to a cart, or one whose `brand` is unset
 * and which therefore reaches the site only through its collection. All three are live in the
 * catalogue right now and none of them is visible anywhere else.
 */
export const dynamic = "force-dynamic"

const STATUS_CHIP: Record<string, string> = {
  published: "bg-emerald-100 text-emerald-800",
  draft: "bg-slate-100 text-slate-600",
  proposed: "bg-amber-100 text-amber-800",
  rejected: "bg-rose-100 text-rose-700",
}

const STATUS_LABEL: Record<string, string> = {
  published: "on the site",
  draft: "draft",
  proposed: "proposed",
  rejected: "off the site",
}

export default async function CataloguePage() {
  const products = await listCatalogue()

  const live = products.filter((p) => p.status === "published").length
  const needsWork = products.filter((p) => p.warnings.length > 0).length
  const noImage = products.filter((p) => !p.thumbnail).length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SectionHeader
        title="Catalogue"
        description="The products on pranajiva.in. Everything here is read from Medusa; changes made on this screen go through it too, so the storefront, sitemap and Google feed all follow."
        action={
          <Link
            href="/pranajiva/catalogue/new"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
          >
            New product
          </Link>
        }
      />

      <div className="grid gap-3 px-6 py-4 sm:grid-cols-3">
        <StatCard label="On the site" value={String(live)} />
        <StatCard label="Needs attention" value={String(needsWork)} />
        <StatCard label="Without a photograph" value={String(noImage)} />
      </div>

      <div className="px-6 pb-8">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Collection</th>
                <th className="px-4 py-2 font-medium">From</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Needs attention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No PranaJiva products found. That means nothing in Medusa carries
                    <code className="mx-1 rounded bg-slate-100 px-1">brand: pranajiva</code>
                    and no collection does either.
                  </td>
                </tr>
              )}

              {products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/pranajiva/catalogue/${p.id}`}
                      className="flex items-center gap-3 font-medium text-slate-900 hover:underline"
                    >
                      {/* Deliberately a plain img: these are S3 urls on an internal tool, and
                          next/image would need every bucket in remotePatterns to show a thumbnail. */}
                      {p.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.thumbnail}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded border border-slate-200 object-cover"
                        />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-dashed border-slate-300 text-[10px] text-slate-400">
                          —
                        </span>
                      )}
                      <span>
                        {p.title}
                        <span className="block font-normal text-slate-400">{p.handle}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{p.collectionTitle ?? "—"}</td>
                  <td className="px-4 py-2 tabular-nums text-slate-700">
                    {formatPaise(p.fromPaise)}
                    {p.variantCount > 1 && (
                      <span className="ml-1 text-slate-400">({p.variantCount} sizes)</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        STATUS_CHIP[p.status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {p.warnings.length === 0 ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {p.warnings.map((w) => (
                          <li key={w} className="text-amber-700">
                            {w}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          Variants, options and inventory are still managed in Medusa&rsquo;s own admin — this
          screen covers what the storefront reads and Medusa edits badly. Removing a product here
          takes it off the site and is reversible; it never deletes, because past orders reference
          its variants.
        </p>
      </div>
    </div>
  )
}
