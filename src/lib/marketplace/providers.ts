import { desc } from "@arkiv-network/sdk/query"
import { getAddress, isAddress, type Address } from "viem"
import articlesData from "../aethera/sample-articles.json" with { type: "json" }
import stakingData from "../aethera/sample-staking.json" with { type: "json" }
import { buildChecks } from "../checks/checks"
import { ethereumClient, readImplementation, readMetadata } from "../eth/ethereum"
import { arkivPublic } from "../arkiv/write-checks"
import { UpgradeAlerts } from "../../schema"
import type { DataPowerOptions, PriceItem } from "./pricing"

/** A column descriptor so the UI can render any dataset generically. */
export type DatasetColumn = { key: string; label: string; kind?: "text" | "num" | "url" | "mono" }

export type DatasetRecord = Record<string, string | number>

/**
 * A marketplace data asset. Solar keeps its own oracle path; every other asset
 * plugs in here, so adding one is a single entry instead of a bespoke integration.
 */
export type Provider = {
  id: string // listing category
  kind: "dataset" | "compute"
  title: string
  summary: string
  preview: string
  /** Trust tier the platform stands behind for this first-party asset. */
  trust: "verified" | "attested"
  /** Data-Power pricing inputs; price is derived from the data at seed time. */
  pricing: DataPowerOptions
  columns: DatasetColumn[]
  provenanceNote: string
  /** The sellable records. `input` is the buyer's argument for compute assets. */
  load: (input?: string) => Promise<DatasetRecord[]>
  /** Maps a record to a Data-Power item (timestamp, group, completeness, proof). */
  toPriceItem: (record: DatasetRecord) => PriceItem
}

const WATCHER = "0x329753C220B38b8901fB38a247cdcD77f6AC8529" as Address
const secs = (ms: number) => Math.floor(ms / 1000)

// ── Research Intelligence ──────────────────────────────────────────────────
type Article = {
  title: string
  source: string
  category: string
  region: string
  relevance_score: number
  published_at: string
  url: string
}

const researchIntel: Provider = {
  id: "research-intel",
  kind: "dataset",
  title: "Aethera Research Intelligence — RWA / carbon / DePIN",
  summary:
    "Curated, classified, relevance-scored intelligence on tokenization, RWA, carbon and DePIN. Raw news is free; the curation is the product.",
  preview: "96 articles · classified by category & region · relevance-scored · batch-attested on Arkiv",
  trust: "attested",
  pricing: { basePriceTgml: 0.01, halfLifeDays: 30, rarity: 1.4 },
  columns: [
    { key: "title", label: "headline" },
    { key: "category", label: "category", kind: "mono" },
    { key: "region", label: "region", kind: "mono" },
    { key: "relevance", label: "score", kind: "num" },
    { key: "source", label: "source", kind: "mono" },
    { key: "url", label: "link", kind: "url" },
  ],
  provenanceNote: "each batch's source list + content hash is attested on Arkiv (unmodified, timestamped)",
  async load() {
    const articles = (articlesData as { articles: Article[] }).articles ?? []
    return articles.map((a) => ({
      title: a.title,
      category: a.category,
      region: a.region,
      relevance: a.relevance_score,
      source: a.source,
      url: a.url,
      _ts: secs(Date.parse(a.published_at) || Date.now()),
    }))
  },
  toPriceItem(r) {
    return {
      observedAt: Number(r._ts) || secs(Date.now()),
      group: String(r.category),
      completeness: 1,
      proven: false, // curated feed; attested as a batch, not per-record
    }
  },
}

// ── Security feed (DataVerify's own upgrade alerts) ─────────────────────────
const securityFeed: Provider = {
  id: "security-feed",
  kind: "dataset",
  title: "Proxy Upgrade & Admin-Risk feed",
  summary:
    "Every detected proxy upgrade across watched contracts, with Sourcify verification status. The kind of admin-key monitoring auditors and insurers pay for.",
  preview: "live from DataVerify's watcher · each alert signed on Arkiv by the watcher wallet",
  trust: "verified",
  pricing: { basePriceTgml: 0.01, halfLifeDays: 30, rarity: 1.6 },
  columns: [
    { key: "proxy", label: "proxy", kind: "mono" },
    { key: "severity", label: "severity", kind: "mono" },
    { key: "verified", label: "verified", kind: "mono" },
    { key: "newImpl", label: "new impl", kind: "mono" },
    { key: "block", label: "block", kind: "num" },
    { key: "detail", label: "detail" },
  ],
  provenanceNote: "every alert is signed by the watcher wallet on Arkiv — forgery-proof by construction",
  async load() {
    const page = await arkivPublic()
      .select({
        proxyName: true,
        severity: true,
        verified: true,
        newImpl: true,
        block: true,
        detail: true,
      })
      .from(UpgradeAlerts)
      .ownedBy(WATCHER)
      .orderBy(desc("block"))
      .limit(100)
      .fetch()
    return page.entities.map((e) => ({
      proxy: e.proxyName.value,
      severity: e.severity.value,
      verified: e.verified.value,
      newImpl: e.newImpl.value,
      block: Number(e.block.value),
      detail: e.detail.value,
    }))
  },
  toPriceItem(r) {
    return { observedAt: secs(Date.now()), group: String(r.severity), completeness: 1, proven: true }
  },
}

// ── Staking / DePIN registry (aggregate, no PII) ────────────────────────────
type StakingAgg = {
  generatedAt: number
  totalInstallers: number
  projects: number
  locations: number
  byStatus: Record<string, number>
  byLocation: Record<string, number>
  byProject: Record<string, number>
}

const stakingRegistry: Provider = {
  id: "staking-registry",
  kind: "dataset",
  title: "Aethera DePIN Registry — network growth",
  summary:
    "Aggregate stats on registered solar installers and projects (counts by KYC status, location, project). Network-growth intelligence, privacy-safe (no personal data).",
  preview: "installer / project / location counts · on-chain registry on Aptos",
  trust: "attested",
  pricing: { basePriceTgml: 0.01, halfLifeDays: 14, rarity: 1.3 },
  columns: [
    { key: "metric", label: "metric", kind: "mono" },
    { key: "key", label: "key", kind: "mono" },
    { key: "count", label: "count", kind: "num" },
  ],
  provenanceNote: "derived from the Aethera staking registry on Aptos; only aggregate counts, no PII",
  async load() {
    const agg = stakingData as StakingAgg
    const rows: DatasetRecord[] = [
      { metric: "totals", key: "installers", count: agg.totalInstallers },
      { metric: "totals", key: "projects", count: agg.projects },
      { metric: "totals", key: "locations", count: agg.locations },
    ]
    for (const [k, v] of Object.entries(agg.byStatus)) rows.push({ metric: "kyc_status", key: k, count: v })
    for (const [k, v] of Object.entries(agg.byProject)) rows.push({ metric: "project", key: k, count: v })
    for (const [k, v] of Object.entries(agg.byLocation)) rows.push({ metric: "location", key: k, count: v })
    return rows
  },
  toPriceItem(r) {
    return { observedAt: secs(Date.now()), group: String(r.metric), completeness: 1, proven: true }
  },
}

// ── Token rug-risk (compute: buyer names a token) ───────────────────────────
const rugRisk: Provider = {
  id: "rug-risk",
  kind: "compute",
  title: "Token Rug-Risk score (on demand)",
  summary:
    "Name any ERC-20 and get a computed risk assessment — metadata integrity, proxy upgradeability and verification — the kind of check scanners charge for.",
  preview: "compute · you name a token · result attested",
  trust: "verified",
  pricing: { basePriceTgml: 0.02, halfLifeDays: 365, rarity: 1.5 },
  columns: [
    { key: "signal", label: "signal", kind: "mono" },
    { key: "status", label: "status", kind: "mono" },
    { key: "detail", label: "detail" },
  ],
  provenanceNote: "computed live from Ethereum state + Sourcify at purchase time",
  async load(input) {
    if (!input || !isAddress(input)) throw new Error("rug-risk needs a token address")
    const token = getAddress(input)
    const eth = ethereumClient()
    const [metadata, proxy] = await Promise.all([readMetadata(eth, token), readImplementation(eth, token)])
    const drafts = buildChecks(
      { chainId: 1, address: token, name: metadata.name ?? "", symbol: metadata.symbol ?? "", decimals: metadata.decimals ?? -1 },
      metadata,
      proxy.implementation,
      proxy.hasCode,
    )
    const upgradeable = proxy.implementation
      ? { signal: "upgradeable", status: "risk", detail: `proxy implementation ${proxy.implementation}` }
      : { signal: "upgradeable", status: "ok", detail: "no proxy implementation slot" }
    return [
      ...drafts.map((d) => ({ signal: d.check, status: d.status, detail: d.detail })),
      upgradeable,
    ]
  },
  toPriceItem() {
    return { observedAt: secs(Date.now()), group: "risk", completeness: 1, proven: true }
  },
}

const PROVIDERS: Provider[] = [researchIntel, securityFeed, stakingRegistry, rugRisk]

export function getProvider(category: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === category)
}

export function allProviders(): Provider[] {
  return PROVIDERS
}
