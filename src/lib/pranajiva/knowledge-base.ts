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
import { parseLedger, type Ledger } from "./ledger"
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
  ledger: /pipeline[_ ]?ledger/i,
  contentStatus: /pipeline[_ ]?status/i,
  formulaLibrary: /classical[_ ]?formula[_ ]?library/i,
  productPortfolio: /pranajiva[_ ]?products/i,
} as const

/**
 * Retired documents, excluded from every read.
 *
 * The pipelines retire a document by moving it to `99_ARCHIVE` and prefixing the name with
 * `ARCHIVED_{date}_`, keeping the original name in the middle so it stays findable. That convention
 * is precisely what broke the overview: `PIPELINE_STATUS` still matches inside
 * `ARCHIVED_2026-09-06_PIPELINE_STATUS_md_superseded-by-PIPELINE_LEDGER.md`, so three superseded
 * status documents kept feeding the content panel after they were replaced by PIPELINE_LEDGER.
 *
 * Both halves of the convention are checked. Either alone would be enough today, and neither is
 * guaranteed to stay that way — a file dragged into the archive folder without a rename is still
 * archived, and a renamed file that has not been moved yet is too.
 */
const ARCHIVE_FOLDER = /^99[_-]?ARCHIVE$/i

function isArchived(doc: { name: string; pipeline: string | null; path: string[] }): boolean {
  if (/^ARCHIVED[_-]/i.test(doc.name)) return true
  if (doc.pipeline && ARCHIVE_FOLDER.test(doc.pipeline)) return true
  return doc.path.some((segment) => ARCHIVE_FOLDER.test(segment))
}

export interface PipelineSummary {
  id: string
  name: string
  /** A short human label — "Formula Engine" out of "01_FORMULA_RESEARCH". */
  label: string
  documentCount: number
  folderCount: number
  lastActivity: string | null
}

/** The languages the pipeline writes in since 2026-09-08. Null means a file written before that. */
export type ArtifactLanguage = "EN" | "HI"

export interface TopicArtifact {
  id: string
  name: string
  /**
   * The folder the file sits in. For a blog or a video pack this *is* its editorial stage — the
   * ledger is explicit that "stage is also structural: a file's folder IS its stage. Where the two
   * disagree, the folder wins".
   */
  stage: string
  /**
   * Read from the `_EN` / `_HI` suffix in the filename.
   *
   * Null is meaningful rather than unknown: the ledger records that "files with no language suffix
   * are pre-2026-09-08 and are in the retired scholarly format". An unsuffixed blog is therefore not
   * an English blog that forgot its label — it is a blog awaiting rewrite, and the screens say so.
   */
  language: ArtifactLanguage | null
  webViewLink: string | null
  modifiedTime: string | null
}

export interface TopicArtifacts {
  evidencePack: TopicArtifact | null
  blogEn: TopicArtifact | null
  blogHi: TopicArtifact | null
  /** A blog from before the bilingual split — no language suffix, retired scholarly format. */
  blogLegacy: TopicArtifact | null
  /** Reel packs from P05. One per language under the current standard; older runs produced one. */
  videoPacks: TopicArtifact[]
  /** The `_VO.json` and `_EDIT.json` render files that ship alongside a pack. */
  renderFiles: TopicArtifact[]
}

/** True when the topic has anything at all — used to keep empty topics off the production board. */
export function hasArtifacts(artifacts: TopicArtifacts): boolean {
  return Boolean(
    artifacts.evidencePack ||
      artifacts.blogEn ||
      artifacts.blogHi ||
      artifacts.blogLegacy ||
      artifacts.videoPacks.length ||
      artifacts.renderFiles.length
  )
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
  /** Evidence pack, both blogs and the video packs per topic, matched from Drive. */
  topicArtifacts: Map<string, TopicArtifacts>
  /** The pipeline's own per-topic record. Null when PIPELINE_LEDGER.md cannot be read. */
  ledger: Ledger | null
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
 *
 * ── Two conventions this had to learn ──────────────────────────────────────────────────────────
 * **Video packs use a different prefix.** P05 files are named `PJV-C01-T05_…` — `PJV` for PranaJiva
 * Video, chosen so a blog and its pack sort together. A plain `startsWith(topic.key)` therefore
 * matches none of them: `PJV-C01-T05…` does not begin with `PJ-C01-T05`. Every reel pack the
 * pipeline has produced would have been invisible here. The key is normalised before comparing.
 *
 * **Blogs come in two languages.** Since 2026-09-08 the pipeline writes `_EN.md` and `_HI.md` from
 * the same evidence pack, natively rather than in translation. A file with no suffix is not English —
 * it is the retired pre-bilingual format, and the ledger tracks six of them as awaiting rewrite. It
 * gets its own slot so the screens can say "awaiting rewrite" instead of quietly showing it as the
 * English blog and making a topic look finished when half its work is outstanding.
 */
function matchTopicArtifacts(tree: DriveTree, topics: TopicIndex | null): Map<string, TopicArtifacts> {
  const byTopic = new Map<string, TopicArtifacts>()
  if (!topics) return byTopic

  const toArtifact = (doc: DriveDocument): TopicArtifact => ({
    id: doc.id,
    name: doc.name,
    stage: doc.path[doc.path.length - 1] ?? "root",
    language: languageOf(doc.name),
    webViewLink: doc.webViewLink,
    modifiedTime: doc.modifiedTime,
  })

  /**
   * Only files that are actually part of the pipeline's output.
   *
   * Archived work keeps its topic-key prefix — `ARCHIVED_2026-09-08_PJ-C01-T05_scholarly-format_…`
   * sits in 99_ARCHIVE — but is filtered by name before the key is even read, and the archive folder
   * is excluded regardless.
   */
  const live = tree.documents.filter((doc) => !isArchived(doc))

  for (const topic of topics.topics) {
    const matches = live.filter((doc) => {
      // PJV-C01-T05_… is PJ-C01-T05's video pack. Normalise before the prefix test, or every pack
      // in P05 goes unmatched.
      const name = doc.name.replace(/^PJV-/i, "PJ-")
      if (!name.startsWith(topic.key)) return false
      const next = name.charAt(topic.key.length)
      return next === "" || next === "_" || next === "-" || next === "." || next === " "
    })

    if (matches.length === 0) continue

    const under = (needle: string) =>
      matches.filter((doc) => doc.path.some((segment) => segment.toLowerCase() === needle))

    const blogs = under("blogs").map(toArtifact)
    // The render files sit beside the pack in scripts/*; they are handoff material for the editor,
    // not scripts, and listing them as packs would triple the apparent output.
    const scripts = under("scripts").map(toArtifact)
    const isRenderFile = (a: TopicArtifact) => /_(vo|edit)\.json$/i.test(a.name)

    byTopic.set(topic.key, {
      evidencePack: under("evidence_packs").map(toArtifact)[0] ?? null,
      blogEn: blogs.find((b) => b.language === "EN") ?? null,
      blogHi: blogs.find((b) => b.language === "HI") ?? null,
      blogLegacy: blogs.find((b) => b.language === null) ?? null,
      videoPacks: scripts.filter((a) => !isRenderFile(a)),
      renderFiles: scripts.filter(isRenderFile),
    })
  }

  return byTopic
}

/**
 * The language suffix in a filename, or null for a file written before the split.
 *
 * Matched as a whole underscore-delimited token so a slug can contain the letters without being
 * misread — `_EN_PACK.md`, `_HI.md` and `_EN.md` all resolve, while a topic slugged
 * `…_hi-matra.md` does not.
 */
function languageOf(name: string): ArtifactLanguage | null {
  const match = /_(EN|HI)(?=[_.]|$)/i.exec(name.replace(/\.[a-z0-9]+$/i, "."))
  return match ? (match[1].toUpperCase() as ArtifactLanguage) : null
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
  content: ContentPipelineState | null,
  topicArtifacts: Map<string, TopicArtifacts>
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

  /**
   * 4. Blogs still in the retired pre-bilingual format.
   *
   * Since 2026-09-08 every blog is written twice, English and Hindi, natively from the same evidence
   * pack. A blog with no language suffix predates that and is queued for a rewrite — the pipeline
   * will not touch it without an explicit `overwrite EN`, so it sits there indefinitely and nothing
   * else in Drive says it is waiting.
   *
   * Counted from the files, so it drops to zero on its own as each one is rewritten.
   */
  const legacyBlogs = Array.from(topicArtifacts.entries()).filter(
    ([, artifacts]) => artifacts.blogLegacy && !artifacts.blogEn
  )
  if (legacyBlogs.length > 0) {
    gaps.push({
      severity: "info",
      title: `${legacyBlogs.length} blog${legacyBlogs.length === 1 ? " is" : "s are"} still in the pre-bilingual format`,
      detail: `${legacyBlogs
        .map(([key]) => key)
        .join(", ")} — written before the English/Hindi split and in the retired scholarly format, with no Hindi version. The pipeline will not replace them on its own: each needs an explicit "overwrite EN" to be rewritten to the current standard.`,
      href: "/pranajiva/content",
      hrefLabel: "Open the production board",
    })
  }

  /**
   * 5. Approved blogs with no reel pack.
   *
   * P05 reads from P02 and is bounded by blog production, not by topics — so a blog that has reached
   * approved with no pack behind it is the pipeline's actual bottleneck, and it is invisible unless
   * the two pipelines are compared. Drafts are excluded deliberately: a pack built from a draft has
   * to be re-verified if the blog text then changes, which the video spec calls out.
   */
  const packableBlogs = Array.from(topicArtifacts.entries()).filter(([, a]) => {
    const blog = a.blogEn ?? a.blogHi
    return blog && stageRank(blog.stage) > stageRank("drafts") && a.videoPacks.length === 0
  })
  if (packableBlogs.length > 0) {
    gaps.push({
      severity: "info",
      title: `${packableBlogs.length} approved blog${packableBlogs.length === 1 ? "" : "s"} with no reel pack`,
      detail: `${packableBlogs
        .map(([key]) => key)
        .join(", ")} — past drafts in P02 with nothing built on top in P05. Say "reels for ${
        packableBlogs[0][0]
      }" to start one.`,
      href: "/pranajiva/content",
      hrefLabel: "Open the production board",
    })
  }

  /* 6. The topic-level state that OPS cannot reach. */
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

  // Archived documents are excluded from every lookup below. They keep their original name inside
  // the `ARCHIVED_{date}_…` prefix, so a pattern written for the live document still matches them.
  const liveDocuments = tree.documents.filter((doc) => !isArchived(doc))

  const locate = (pattern: RegExp): DriveDocument | null =>
    liveDocuments.find((doc) => pattern.test(doc.name)) ?? null

  const found = {
    masterIndex: locate(CONTROL_DOCUMENTS.masterIndex),
    ledger: locate(CONTROL_DOCUMENTS.ledger),
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
   * Every *live* status document, not just the newest — see mergeContentState for why. Ordered
   * newest first so the merge's "first non-empty wins" rule means "most recent that actually says
   * something".
   *
   * As of 2026-09-06 this list is empty: all three PIPELINE_STATUS documents were retired into
   * 99_ARCHIVE in favour of PIPELINE_LEDGER, and archived documents no longer qualify. The merge
   * handles an empty list by returning null, and the content panel falls back to recounting from the
   * topic index — which is what it should have been doing anyway. The path stays here because a
   * pipeline is free to publish a status document again.
   */
  const statusDocuments = liveDocuments.filter((doc) =>
    CONTROL_DOCUMENTS.contentStatus.test(doc.name)
  )

  const [masterIndexText, ledgerText, statusTexts, formulaText, productText, topicFiles] =
    await Promise.all([
      readDocument(found.masterIndex),
      readDocument(found.ledger),
      Promise.all(statusDocuments.map(readDocument)),
      readDocument(found.formulaLibrary),
      readDocument(found.productPortfolio),
      topicFilePromise,
    ])

  const topicText = await readDocument(topicFiles[0] ?? null)

  const products = productText ? parseProductPortfolio(productText) : []
  const topics = topicText ? parseTopicIndex(topicText) : null
  const ledger = ledgerText ? parseLedger(ledgerText) : null

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

  const topicArtifacts = matchTopicArtifacts(tree, topics)

  return {
    tree,
    pipelines,
    content,
    formulas: formulaText ? parseFormulaLibrary(formulaText) : [],
    products,
    topics,
    topicArtifacts,
    ledger,
    gaps: findGaps(tree, masterIndexText, products, topics, content, topicArtifacts),
    found,
  }
}
