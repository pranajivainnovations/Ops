import Link from "next/link"
import { notFound } from "next/navigation"

import {
  getCatalogueProduct,
  listBrandCollections,
} from "@/lib/pranajiva/catalogue"
import { SectionHeader } from "../../_components/section"
import ProductForm from "./product-form"
import { ArchivePanel, ImagesPanel, PricePanel } from "./side-panels"

/**
 * One product.
 *
 * The long form on the left is everything the storefront reads; the panels on the right are the
 * three things that are each a single decision — what it costs, what it looks like, and whether it
 * is on sale at all — and that are worth doing without scrolling past forty fields first.
 */
export const dynamic = "force-dynamic"

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [product, collections] = await Promise.all([
    getCatalogueProduct(id),
    listBrandCollections(),
  ])

  /* Not found covers both "no such product" and "not PranaJiva's" — the second is deliberately
     indistinguishable here, and the backend refuses the write regardless. */
  if (!product) notFound()

  const live = product.status === "published"

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SectionHeader
        title={product.title}
        description={`${product.handle} · ${product.collectionTitle ?? "no collection"}`}
        action={
          <div className="flex items-center gap-2">
            {live && (
              <a
                href={`https://pranajiva.in/shop/${product.handle}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                View on the site
              </a>
            )}
            <Link
              href="/pranajiva/catalogue"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back
            </Link>
          </div>
        }
      />

      <div className="grid flex-1 gap-4 px-6 py-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <ProductForm product={product} collections={collections} />
        </div>

        <aside className="space-y-4">
          <ImagesPanel product={product} />
          <PricePanel product={product} />
          <ArchivePanel product={product} />
        </aside>
      </div>
    </div>
  )
}
