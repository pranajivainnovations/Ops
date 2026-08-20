/**
 * The Pranajiva knowledge base, assembled from Drive into something OPS can show.
 *
 * ── How control documents are found ─────────────────────────────────────────────────────────────
 * By name, from the walked tree — never by Drive file id. The pipelines' own routing protocols name
 * these files precisely and treat the names as the contract ("route new/updated versions of the same
 * named file to the same folder"), while ids change every time a document is re-uploaded rather than
 * edited in place. That has already happened: all seven P01 corpus files were re-uploaded on
 * 2026-08-18 and every one of them got a new id. Names survived; ids did not.
 *
 * It also means a pipeline can reorganise its folders freely. Nothing here knows where a document
 * lives, only what it is called.
 */

import {
  findFilesByName,
  getDocumentContent,
  getDriveTree,
  type DriveDocument,
  type DriveTree,
} from "@/lib/google-drive"
import {
  classifyProductStatus,
  parseContentPipeline,
  parseFormulaLibrary,
  parseProductPortfolio,
  parseTopicIndex,
  type ClassicalFormula,
  type ContentPipelineState,
  type CountRow,
  type ProductConcept,
  type TopicIndex,
} from "./parse"

/** The name patterns that identify each control document. Order matters only within a pattern. */
const CONTROL_DOCUMENTS = {
  masterIndex: /master[_ ]?project[_ ]?index/i,
  contentStatus: /pipeline[_ ]?status/i,
  formulaLibrary: /classical[_ ]?formula[_ ]?library/i,
  productPortfolio: /pranajiva[_ ]?products/i,
} as const

export interface PipelineSummary {
  id: string
  name: string
  /** A short human label — "Formula Engine" out of "01_FORMULA_RESEARCH". */
  label: string
  documentCount: number
  folderCount: number
  lastActivity: string | null
}

export interface TopicArtifact {
  id: string
  name: string
  /**
   * The folder the file sits in. For an article this *is* its editorial stage — PIPELINE_STATUS is
   * explicit that "blog status is expressed by FOLDER, not by a field: drafts → review → approved →
   * published, moved with update_file(parentId)".
   */
  stage: string
  webViewLink: string | null
  modifiedTime: string | null
}

export interface TopicArtifacts {
  evidencePack: TopicArtifact | null
  article: TopicArtifact | null
}

export interface Gap {
  severity: "warning" | "info"
  title: string
  detail: string
  /** Where to go to act on it, when there is somewhere to go. */
  href?: string
  hrefLabel?: string
}

export interface KnowledgeBase {
  tree: DriveTree
  pipelines: PipelineSummary[]
  content: ContentPipelineState | null
  formulas: ClassicalFormula[]
  products: ProductConcept[]
  topics: TopicIndex | null
  /** Evidence Pack and article per topic, matched from Drive rather than read from the index. */
  topicArtifacts: Map<string, TopicArtifacts>
  /** Documents whose absence or staleness the team should know about, computed not hardcoded. */
  gaps: Gap[]
  /** Which control documents were located, for honest "not found" states in the UI. */
  found: Record<keyof typeof CONTROL_DOCUMENTS, DriveDocument | null>
}

/**
 * `01_FORMULA_RESEARCH` → `Formula Research`.
 *
 * The numeric prefixes are the pipelines' ordering mechanism, not part of their names, and the
 * underscores are a filesystem convention. Both are noise on a screen; the sort order they encode is
 * preserved separately by sorting on the raw name.
 */
function humanise(folderName: string): string {
  return folderName
    .replace(/^\d+[_-]/, "")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

async function readDocument(doc: DriveDocument | null): Promise<string | null> {
  if (!doc) return null
  try {
    const content = await getDocumentContent(doc.id, doc.mimeType)
    return content.unreadable ? null : content.text
  } catch (error) {
    console.error(`[pranajiva] could not read ${doc.name}`, error)
    return null
  }
}

/**
 * The master index's per-pipeline "Status:" lines, so they can be checked against reality.
 *
 * Returns the status prose keyed by the section heading it sits under.
 */
function parseIndexStatuses(text: string): Map<string, string> {
  const statuses = new Map<string, string>()
  let section: string | null = null

  for (const line of text.split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*(?:—.*)?$/.exec(line)
    if (heading) {
      // Google Docs escapes underscores in Markdown export: `01\_FORMULA\_RESEARCH`.
      section = heading[1].replace(/\\/g, "").trim()
      continue
    }
    const status = /^\*\*Status:?\*\*\s*(.+)$/i.exec(line.trim())
    if (status && section && !statuses.has(section)) {
      statuses.set(section, status[1].trim())
    }
  }

  return statuses
}

/**
 * Combine every PIPELINE_STATUS document into one view of the pipeline.
 *
 * There are now two, and they are not versions of each other. The 2026-08-19 Markdown file declares
 * itself the canonical *current-state* authority and carries a richer metric table, but expresses
 * editorial ranking as Tier A/B/C/D and has no flag table at all. The older Google Doc has the
 * P1/P2/P3 priority split, the flag counts and the seven-stage workflow.
 *
 * Taking only the newest — which sorting by modified time would do — silently drops the breakdowns
 * from the overview. Taking only the oldest reports superseded counts. So: newest wins on the fields
 * it actually has, and older documents fill the gaps rather than overwrite.
 */
function mergeContentState(states: ContentPipelineState[]): ContentPipelineState | null {
  if (states.length === 0) return null

  const firstNonEmpty = <T>(pick: (s: ContentPipelineState) => T[]): T[] =>
    states.map(pick).find((list) => list.length > 0) ?? []

  return {
    headline: firstNonEmpty((s) => s.headline),
    priorities: firstNonEmpty((s) => s.priorities),
    flags: firstNonEmpty((s) => s.flags),
    attributes: firstNonEmpty((s) => s.attributes),
    workflow: firstNonEmpty((s) => s.workflow),
    phase: states.map((s) => s.phase).find(Boolean) ?? null,
    lastUpdated: states.map((s) => s.lastUpdated).find(Boolean) ?? null,
  }
}

/**
 * Recount priorities, flags and content attributes from the topic index itself.
 *
 * A published summary is a number somebody wrote down once. The CSV is the state. While the two
 * agreed exactly when this was written — P1 142 / P2 158 / P3 132, 314 consumer-relevant, matching
 * PIPELINE_STATUS to the row — they will diverge the first time the pipeline runs and the summary
 * is not regenerated, and nothing about a stale count looks wrong.
 *
 * So when the index is readable, it wins. When it is not, the published summary is all there is and
 * is used unchanged.
 */
function recountFromIndex(state: ContentPipelineState | null, topics: TopicIndex): ContentPipelineState {
  const tally = (pick: (t: TopicIndex["topics"][number]) => string | null): CountRow[] => {
    const counts = new Map<string, number>()
    for (const topic of topics.topics) {
      const key = pick(topic)
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }

  /** One topic can carry several flags in one cell — count each, not the cell. */
  const flagCounts = new Map<string, number>()
  for (const topic of topics.topics) {
    for (const flag of (topic.flags ?? "").split(/[;,]/).map((f) => f.trim()).filter(Boolean)) {
      flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1)
    }
  }

  const yes = (pick: (t: TopicIndex["topics"][number]) => string | null, label: string): CountRow[] => {
    const count = topics.topics.filter((t) => (pick(t) ?? "").toUpperCase() === "Y").length
    return count > 0 ? [{ label, count }] : []
  }

  return {
    headline: state?.headline ?? [],
    priorities: tally((t) => t.priority),
    flags: Array.from(flagCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    attributes: [
      ...yes((t) => t.consumerRelevant, "Consumer relevant"),
      ...(state?.attributes ?? []).filter((a) => !/consumer/i.test(a.label)),
    ],
    workflow: state?.workflow ?? [],
    phase: state?.phase ?? null,
    lastUpdated: state?.lastUpdated ?? null,
  }
}

/**
 * Match every topic to the files the pipeline has produced for it.
 *
 * ── Why match on the filename and not the index's own columns ───────────────────────────────────
 * master_index.csv has `Evidence Pack Location` and `Blog Location` columns, and they are empty on
 * all 432 rows — including PJ-C22-T13, whose Evidence Pack and article both demonstrably exist in
 * Drive. Trusting those columns would tell the team no articles have been written while one sits in
 * blogs/drafts. The files are the fact; the columns are a note someone has not made yet.
 *
 * The pipeline's naming convention is the join: `PJ-C{chapter}-T{topic}_{slug}.md`. The topic key is
 * matched as a prefix followed by a separator, never bare — without that boundary `PJ-C1-T1` would
 * also claim `PJ-C1-T13`'s files.
 *
 * Evidence Pack and article can carry the *identical* filename (PJ-C22-T13_murdha-taila.md is both),
 * so they are told apart by the folder they are in, which is also what encodes an article's stage.
 */
function matchTopicArtifacts(tree: DriveTree, topics: TopicIndex | null): Map<string, TopicArtifacts> {
  const byTopic = new Map<string, TopicArtifacts>()
  if (!topics) return byTopic

  const toArtifact = (doc: DriveDocument): TopicArtifact => ({
    id: doc.id,
    name: doc.name,
    stage: doc.path[doc.path.length - 1] ?? "root",
    webViewLink: doc.webViewLink,
    modifiedTime: doc.modifiedTime,
  })

  for (const topic of topics.topics) {
    const matches = tree.documents.filter((doc) => {
      if (!doc.name.startsWith(topic.key)) return false
      const next = doc.name.charAt(topic.key.length)
      return next === "" || next === "_" || next === "-" || next === "." || next === " "
    })

    if (matches.length === 0) continue

    const inFolder = (needle: string) =>
      matches.find((doc) => doc.path.some((segment) => segment.toLowerCase() === needle))

    byTopic.set(topic.key, {
      evidencePack: (inFolder("evidence_packs") && toArtifact(inFolder("evidence_packs")!)) || null,
      // Any file under a `blogs` folder is the article, whichever stage subfolder it has reached.
      article:
        (() => {
          const doc = matches.find((d) => d.path.some((s) => s.toLowerCase() === "blogs"))
          return doc ? toArtifact(doc) : null
        })() || null,
    })
  }

  return byTopic
}

/**
 * Editorial stages in the order the pipeline moves work through them.
 *
 * Used only to sort and order what is displayed. Stages are discovered from the folders that
 * actually exist — a stage not in this list still shows, it just sorts last, so renaming or adding
 * a folder in Drive cannot make an article disappear from the screen.
 */
const STAGE_ORDER = ["drafts", "review", "approved", "published"]

export function stageRank(stage: string): number {
  const index = STAGE_ORDER.indexOf(stage.toLowerCase())
  return index === -1 ? STAGE_ORDER.length : index
}

/**
 * Everything wrong that the corpus can be made to admit to.
 *
 * Each of these is derived by comparing two things the pipelines wrote — never by hardcoding a known
 * problem. A hardcoded warning is right once and then wrong forever, and nobody notices it went
 * stale; a computed one disappears the moment the underlying thing is fixed, which is the only way
 * a team learns to trust it.
 */
function findGaps(
  tree: DriveTree,
  masterIndexText: string | null,
  products: ProductConcept[],
  topics: TopicIndex | null,
  content: ContentPipelineState | null
): Gap[] {
  const gaps: Gap[] = []
  const topicsReachable = topics !== null

  /* 1. A pipeline the master index calls empty that is not empty. */
  if (masterIndexText) {
    const statuses = parseIndexStatuses(masterIndexText)
    for (const [section, status] of statuses) {
      if (!/^empty\b/i.test(status)) continue

      const documentCount = tree.documents.filter((d) => d.pipeline === section).length
      if (documentCount > 0) {
        gaps.push({
          severity: "warning",
          title: `MASTER_PROJECT_INDEX still calls ${humanise(section)} empty`,
          detail: `The index reads "Status: ${status}" for ${section}, but that pipeline holds ${documentCount} file${documentCount === 1 ? "" : "s"} in Drive. The index is a Google Doc and the Drive connector cannot edit a Doc's body, so a correction was written as a separate file instead and the index itself was never patched. It needs a manual edit.`,
          href: "/pranajiva/documents",
          hrefLabel: "Browse the files",
        })
      }
    }
  }

  /* 2. A product marked complete whose folder holds nothing. */
  for (const product of products) {
    if (classifyProductStatus(product.status) !== "done") continue
    if (product.researchOrder === null) continue

    const prefix = String(product.researchOrder).padStart(2, "0")
    const folder = tree.folders.find((f) => f.name.startsWith(`${prefix}_`))
    if (!folder) continue

    const filesInside = tree.documents.filter((d) => d.folderId === folder.id).length
    if (filesInside === 0) {
      gaps.push({
        severity: "warning",
        title: `${product.name} is marked "${product.status}" but its folder is empty`,
        detail: `The portfolio sheet records ${product.name} as complete, and ${folder.name} exists in Drive, but no dossier was ever written into it. Either the research output was never uploaded or it went somewhere else.`,
        href: "/pranajiva/products",
        hrefLabel: "Open the portfolio",
      })
    }
  }

  /**
   * 3. The status summary and the per-topic file disagreeing.
   *
   * PIPELINE_STATUS publishes rows like "Topics at DRAFTED | 1". master_index.csv holds the status
   * of every topic. When the two disagree, one of them was not updated after a pipeline run — and
   * that is worth knowing before anyone plans work off either number.
   *
   * Both sides are read from the corpus, so this warning appears and disappears on its own.
   */
  if (topics && content) {
    for (const row of content.headline) {
      const match = /^topics?\s+at\s+(.+)$/i.exec(row.label.trim())
      if (!match || row.count === null) continue

      const status = match[1].trim().toUpperCase()
      const actual = topics.topics.filter(
        (topic) => (topic.status ?? "").trim().toUpperCase() === status
      ).length

      if (actual !== row.count) {
        gaps.push({
          severity: "warning",
          title: `PIPELINE_STATUS and master_index.csv disagree on ${status}`,
          detail: `The status file reports ${row.count} topic${row.count === 1 ? "" : "s"} at ${status}, but the topic index has ${actual}. One of the two was not updated after the last pipeline run — the index is what this board filters on.`,
          href: "/pranajiva/topics",
          hrefLabel: "Open the topic board",
        })
      }
    }
  }

  /* 4. The topic-level state that OPS cannot reach. */
  if (!topicsReachable) {
    gaps.push({
      severity: "info",
      title: "The 432-topic index is not shared with OPS",
      detail:
        "master_index.csv holds the per-topic state behind the content pipeline — status, priority and flags for all 432 topics. It sits in claude-cowork/Blog/, outside the shared root, and the service account cannot see it. Share that folder as Viewer and the topic board fills in on the next load; nothing else needs to change.",
      href: "/help/operations",
      hrefLabel: "Setup notes",
    })
  }

  return gaps
}

/**
 * Read and assemble everything. One call per screen; the Drive layer's one-minute cache means the
 * overview, the boards and the reader share a single walk and a single fetch per document.
 */
export async function loadKnowledgeBase(): Promise<KnowledgeBase> {
  const tree = await getDriveTree()

  const locate = (pattern: RegExp): DriveDocument | null =>
    tree.documents.find((doc) => pattern.test(doc.name)) ?? null

  const found = {
    masterIndex: locate(CONTROL_DOCUMENTS.masterIndex),
    contentStatus: locate(CONTROL_DOCUMENTS.contentStatus),
    formulaLibrary: locate(CONTROL_DOCUMENTS.formulaLibrary),
    productPortfolio: locate(CONTROL_DOCUMENTS.productPortfolio),
  }

  /**
   * The topic index is searched for by name across everything the account can see, rather than
   * looked up in the tree, because it is the one asset that deliberately lives outside the canonical
   * root. Failure here is expected today and must not take the page down.
   */
  const topicFilePromise = findFilesByName("master_index.csv").catch((error) => {
    console.error("[pranajiva] topic index lookup failed", error)
    return [] as DriveDocument[]
  })

  /**
   * Every status document, not just the newest — see mergeContentState for why. Ordered newest
   * first so the merge's "first non-empty wins" rule means "most recent that actually says
   * something".
   */
  const statusDocuments = tree.documents.filter((doc) =>
    CONTROL_DOCUMENTS.contentStatus.test(doc.name)
  )

  const [masterIndexText, statusTexts, formulaText, productText, topicFiles] = await Promise.all([
    readDocument(found.masterIndex),
    Promise.all(statusDocuments.map(readDocument)),
    readDocument(found.formulaLibrary),
    readDocument(found.productPortfolio),
    topicFilePromise,
  ])

  const topicText = await readDocument(topicFiles[0] ?? null)

  const products = productText ? parseProductPortfolio(productText) : []
  const topics = topicText ? parseTopicIndex(topicText) : null

  const publishedState = mergeContentState(
    statusTexts.filter((text): text is string => Boolean(text)).map(parseContentPipeline)
  )
  // The index is the state; the summary is a note about it. When both exist, recount.
  const content = topics ? recountFromIndex(publishedState, topics) : publishedState

  const pipelines: PipelineSummary[] = tree.folders
    .filter((folder) => folder.path.length === 1)
    .map((folder) => {
      const documents = tree.documents.filter((d) => d.pipeline === folder.name)
      const lastActivity = documents
        .map((d) => d.modifiedTime)
        .filter((t): t is string => Boolean(t))
        .sort()
        .pop()

      return {
        id: folder.id,
        name: folder.name,
        label: humanise(folder.name),
        documentCount: documents.length,
        folderCount: tree.folders.filter((f) => f.pipeline === folder.name && f.path.length > 1).length,
        lastActivity: lastActivity ?? null,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    tree,
    pipelines,
    content,
    formulas: formulaText ? parseFormulaLibrary(formulaText) : [],
    products,
    topics,
    topicArtifacts: matchTopicArtifacts(tree, topics),
    gaps: findGaps(tree, masterIndexText, products, topics, content),
    found,
  }
}
