/**
 * Data Power Index (DPI) — a principled, computable price for any dataset.
 *
 * Price is the base price scaled by how much the data is actually worth, measured
 * from the data itself. Each factor is a dimensionless multiplier; they compose
 * multiplicatively:
 *
 *     price = basePrice · φ · γ · δ · ι · ρ
 *     DPI   =             φ · γ · δ · ι · ρ          (the total multiplier)
 *
 *   φ  freshness  = 2^(−ageDays / halfLifeDays)   clamp [0.1,1]   recent data worth more
 *   γ  coverage   = 1 + 0.5·log2(groups)                          more distinct groups, diminishing
 *   δ  depth      = 1 + 0.1·log10(items)                          more records, diminishing
 *   ι  integrity  = completeness · (1 + 0.5·proven)              quality × on-chain-proof premium
 *   ρ  rarity     = per-dataset constant                          scarce (not free) > public
 *
 * This is dataset-agnostic: a `PriceItem` carries just what the formula needs —
 * a timestamp, a grouping key (site / region / category…), how complete the record
 * is, and whether it carries a verifiable on-chain proof. So the same formula
 * prices solar readings, a news-intelligence feed, a security feed, and so on.
 */

export type PriceItem = {
  /** unix seconds */
  observedAt: number
  /** grouping key for coverage — e.g. site, region, category, proxy */
  group: string
  /** 0..1, share of this record's expected fields that are present */
  completeness: number
  /** does this record carry a verifiable on-chain proof? */
  proven: boolean
}

export type DataPowerOptions = {
  basePriceTgml: number
  halfLifeDays: number
  rarity: number
}

export type DataPower = {
  priceTgml: number
  dpi: number
  factors: { freshness: number; coverage: number; depth: number; integrity: number; rarity: number }
  stats: { items: number; groups: number; ageDays: number; completeness: number; provenance: number }
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const round = (x: number, dp: number) => {
  const f = 10 ** dp
  return Math.round(x * f) / f
}

export function computeDataPower(items: PriceItem[], options: DataPowerOptions): DataPower {
  const n = items.length
  if (n === 0) {
    return {
      priceTgml: round(options.basePriceTgml, 4),
      dpi: 1,
      factors: { freshness: 1, coverage: 1, depth: 1, integrity: 1, rarity: options.rarity },
      stats: { items: 0, groups: 0, ageDays: 0, completeness: 0, provenance: 0 },
    }
  }

  const now = Date.now() / 1000
  const newest = Math.max(...items.map((r) => r.observedAt))
  const ageDays = Math.max(0, (now - newest) / 86_400)
  const groups = new Set(items.map((r) => r.group)).size
  const completeness = items.reduce((s, r) => s + clamp(r.completeness, 0, 1), 0) / n
  const proven = items.filter((r) => r.proven).length / n

  const freshness = clamp(2 ** (-ageDays / options.halfLifeDays), 0.1, 1)
  const coverage = 1 + 0.5 * Math.log2(groups || 1)
  const depth = 1 + 0.1 * Math.log10(n)
  const integrity = completeness * (1 + 0.5 * proven)
  const rarity = options.rarity

  const dpi = freshness * coverage * depth * integrity * rarity

  return {
    priceTgml: round(options.basePriceTgml * dpi, 4),
    dpi: round(dpi, 3),
    factors: {
      freshness: round(freshness, 3),
      coverage: round(coverage, 3),
      depth: round(depth, 3),
      integrity: round(integrity, 3),
      rarity: round(rarity, 3),
    },
    stats: {
      items: n,
      groups,
      ageDays: round(ageDays, 1),
      completeness: round(completeness, 3),
      provenance: round(proven, 3),
    },
  }
}
