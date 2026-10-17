import Link from "next/link"

import { listBrandCollections } from "@/lib/pranajiva/catalogue"
import { SectionHeader } from "../../_components/section"
import NewProductForm from "./new-form"

export const dynamic = "force-dynamic"

export default async function NewProductPage() {
  const collections = await listBrandCollections()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SectionHeader
        title="New product"
        description="Created as a draft with one priced variant, so it is a complete product from the moment it exists. Nothing is on the site until you publish it."
        action={
          <Link
            href="/pranajiva/catalogue"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
        }
      />
      <div className="px-6 py-4">
        <NewProductForm collections={collections} />
      </div>
    </div>
  )
}
