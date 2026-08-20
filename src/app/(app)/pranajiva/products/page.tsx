import Link from "next/link"

import { GoogleDriveError, isDriveConfigured } from "@/lib/google-drive"
import { loadDecisions } from "@/lib/pranajiva/decisions"
import { loadKnowledgeBase, type KnowledgeBase } from "@/lib/pranajiva/knowledge-base"
import { classifyProductStatus } from "@/lib/pranajiva/parse"
import RecordCard, { CardList, TableWrap } from "../../_components/record-card"
import { DecisionControl } from "../_components/decision"
import { EmptyRow, MissingDocument, SectionHeader, StatCard } from "../_components/section"
import { DriveErrorPanel, SetupPanel } from "../_components/setup"

/**
 * The product concept portfolio.
 *
 * Eighteen concepts, each at some point between "handwritten note" and "researched and rejected".
 * The sheet already holds that state and a research order; this puts it in queue order with the
 * dossier one click away, and adds the column the sheet cannot have — what OPS decided, which is
 * separate from what the research concluded.
 */
export const dynamic = "force-dynamic"

const STATUS_CHIP: Record<string, string> = {
  done: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-700",
  queued: "bg-slate-100 text-slate-600",
}

export default async function ProductsPage() {
  if (!isDriveConfigured()) {
    return (
      <Shell>
        <SetupPanel />
      </Shell>
    )
  }

  let kb: KnowledgeBase | null = null
  let error: string | null = null

  try {
    kb = await loadKnowledgeBase()
  } catch (e) {
    error = e instanceof GoogleDriveError ? e.message : "Could not reach Google Drive."
    console.error("[pranajiva] products load failed", e)
  }

  if (!kb) {
    return (
      <Shell>
        <DriveErrorPanel message={error ?? "Unknown error."} />
      </Shell>
    )
  }

  if (kb.products.length === 0) {
    return (
      <Shell>
        <MissingDocument what="product portfolio" filename="pranajiva_products" />
      </Shell>
    )
  }

  const decisions = await loadDecisions("product")

  // Queue order, because that is how the work is actually sequenced. Concepts without an order fall
  // to the end rather than to the front, where a missing field would otherwise look like priority 0.
  const products = [...kb.products].sort(
    (a, b) => (a.researchOrder ?? 9999) - (b.researchOrder ?? 9999)
  )

  const counts = {
    done: products.filter((p) => classifyProductStatus(p.status) === "done").length,
    rejected: products.filter((p) => classifyProductStatus(p.status) === "rejected").length,
    queued: products.filter((p) => classifyProductStatus(p.status) === "queued").length,
  }

  /**
   * The Drive folder holding a concept's dossier, matched on the numeric prefix the P04 routing
   * protocol mandates (`02_OVERNIGHT_HERBAL_DIGESTIVE_POWDER` for research order 2). Matching on the
   * name would fail on every concept, because the sheet's wording and the folder's differ.
   */
  const folderFor = (order: number | null) => {
    if (order === null) return null
    const prefix = `${String(order).padStart(2, "0")}_`
    return kb!.tree.folders.find((f) => f.name.startsWith(prefix)) ?? null
  }

  const documentsIn = (folderId: string) =>
    kb!.tree.documents.filter((d) => d.folderId === folderId)

  return (
    <Shell>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Researched" value={counts.done} hint="dossier complete" />
        <StatCard label="Rejected" value={counts.rejected} hint="as originally conceived" />
        <StatCard label="Still queued" value={counts.queued} hint="not yet researched" />
      </div>

      <CardList>
        {products.map((product) => {
          const folder = folderFor(product.researchOrder)
          const docs = folder ? documentsIn(folder.id) : []
          return (
            <RecordCard
              key={product.number}
              title={`${product.researchOrder ?? product.number}. ${product.name}`}
              subtitle={product.primaryNeed ?? undefined}
              href={docs[0] ? `/pranajiva/documents/${docs[0].id}` : undefined}
              linkLabel="Dossier"
              fields={[
                {
                  label: "Status",
                  value: <StatusChip status={product.status} />,
                },
                { label: "Original", value: product.originalIngredients ?? "—" },
                { label: "Files", value: folder ? String(docs.length) : "No folder" },
              ]}
            >
              <DecisionControl
                kind="product"
                subjectKey={String(product.number)}
                decision={decisions.get(String(product.number))}
                returnTo="/pranajiva/products"
              />
            </RecordCard>
          )
        })}
      </CardList>

      <TableWrap>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">#</th>
              <th className="px-4 py-2 font-semibold">Concept</th>
              <th className="px-4 py-2 font-semibold">Research status</th>
              <th className="px-4 py-2 font-semibold">Dossier</th>
              <th className="px-4 py-2 font-semibold">OPS decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((product) => {
              const folder = folderFor(product.researchOrder)
              const docs = folder ? documentsIn(folder.id) : []
              return (
                <tr key={product.number} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-xs tabular-nums text-slate-400">
                    {product.researchOrder ?? product.number}
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-slate-900">{product.name}</p>
                    {product.evolved && (
                      <p className="mt-0.5 max-w-xl text-xs text-slate-500">{product.evolved}</p>
                    )}
                    {product.originalIngredients && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Original: {product.originalIngredients}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusChip status={product.status} />
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {!folder ? (
                      <span className="text-slate-300">No folder yet</span>
                    ) : docs.length === 0 ? (
                      // Stated plainly rather than shown as a blank cell: a complete concept with an
                      // empty folder is the corpus's most common inconsistency, and the overview
                      // raises it as a gap.
                      <span className="text-amber-700">Folder empty</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {docs.map((doc) => (
                          <li key={doc.id}>
                            <Link
                              href={`/pranajiva/documents/${doc.id}`}
                              className="text-slate-600 underline underline-offset-2 hover:text-slate-900"
                            >
                              {doc.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <DecisionControl
                      kind="product"
                      subjectKey={String(product.number)}
                      decision={decisions.get(String(product.number))}
                      returnTo="/pranajiva/products"
                    />
                  </td>
                </tr>
              )
            })}
            {products.length === 0 && <EmptyRow>The portfolio sheet is empty.</EmptyRow>}
          </tbody>
        </table>
      </TableWrap>

      {kb.found.productPortfolio && (
        <p className="text-xs text-slate-400">
          Read from{" "}
          <a
            href={`https://docs.google.com/spreadsheets/d/${kb.found.productPortfolio.id}`}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-slate-700"
          >
            {kb.found.productPortfolio.name}
          </a>
          . Edits belong in the sheet; the decision column is OPS&rsquo;s own.
        </p>
      )}
    </Shell>
  )
}

function StatusChip({ status }: { status: string | null }) {
  const bucket = classifyProductStatus(status)
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CHIP[bucket]}`}
    >
      {status ?? "Unknown"}
    </span>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex-1 bg-slate-50">
      <SectionHeader
        title="Product concepts"
        description="The P04 portfolio, in research order. Status comes from the pipeline's own sheet; the decision column is OPS's, and is never written back to Drive."
      />
      <div className="space-y-4 p-6">{children}</div>
    </main>
  )
}
