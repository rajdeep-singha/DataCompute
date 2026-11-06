import type { Severity } from "../../types/alert"
import type { DiamondSnapshot, DiamondVerdict, FacetSnapshot, Finding } from "../../types/diamond"
import { shortAddress } from "../util/format"

type Hex = `0x${string}`

function bySelector(snapshot: DiamondSnapshot): Map<string, FacetSnapshot> {
  const map = new Map<string, FacetSnapshot>()
  for (const facet of snapshot.facets) {
    for (const selector of facet.selectors) map.set(selector.toLowerCase(), facet)
  }
  return map
}

/**
 * Diffs a chain's live diamond against its pinned manifest. Facets are compared
 * by code hash, not address, so redeploying identical code elsewhere is not a change.
 * Function findings are grouped per facet so one swapped facet is one finding.
 */
export function compareSnapshot(expected: DiamondSnapshot, live: DiamondSnapshot): Finding[] {
  const expectedMap = bySelector(expected)
  const liveMap = bySelector(live)
  const grouped = new Map<string, Finding>()

  function add(kind: Finding["kind"], selector: string, facet: FacetSnapshot, previous: FacetSnapshot | null) {
    const id = `${kind}:${facet.address.toLowerCase()}`
    const existing = grouped.get(id)
    if (existing) {
      existing.selectors.push(selector as Hex)
      return
    }
    grouped.set(id, {
      kind,
      selectors: [selector as Hex],
      facet: facet.address,
      expected: previous?.address ?? null,
      actual: facet.address,
      actualCodehash: facet.codehash,
    })
  }

  for (const [selector, facet] of liveMap) {
    const previous = expectedMap.get(selector)
    if (!previous) add("unexpected-function", selector, facet, null)
    else if (previous.codehash.toLowerCase() !== facet.codehash.toLowerCase()) {
      add("facet-code-changed", selector, facet, previous)
    }
  }
  for (const [selector, facet] of expectedMap) {
    if (!liveMap.has(selector)) add("missing-function", selector, facet, facet)
  }

  const findings = [...grouped.values()]
  if (expected.owner && live.owner && expected.owner.toLowerCase() !== live.owner.toLowerCase()) {
    findings.push({
      kind: "owner-changed",
      selectors: [],
      facet: null,
      expected: expected.owner,
      actual: live.owner,
    })
  }
  return findings
}

/** A finding is critical when new or changed code is unverified, or ownership moved. */
export function isCritical(finding: Finding): boolean {
  if (finding.kind === "owner-changed") return true
  if (finding.kind === "missing-function") return false
  return finding.verified === "unverified"
}

export function classify(findings: Finding[]): { verdict: DiamondVerdict; severity: Severity } {
  if (findings.length === 0) return { verdict: "ok", severity: "info" }
  if (findings.some(isCritical)) return { verdict: "suspicious", severity: "critical" }
  return { verdict: "changed", severity: "warning" }
}

function functionsLabel(finding: Finding): string {
  const names = finding.signatures?.length ? finding.signatures : finding.selectors
  const first = names[0] ?? ""
  return names.length > 1 ? `${first} +${names.length - 1}` : first
}

function describe(finding: Finding): string {
  const facet = finding.facet ? shortAddress(finding.facet) : ""
  const status = finding.verified ? `${finding.verified} ` : ""
  switch (finding.kind) {
    case "unexpected-function":
      return `new function ${functionsLabel(finding)} → ${status}facet ${facet}`
    case "facet-code-changed":
      return `${functionsLabel(finding)} now runs different code → ${status}facet ${facet}`
    case "missing-function":
      return `function ${functionsLabel(finding)} removed`
    case "owner-changed":
      return `owner changed ${shortAddress(finding.expected ?? "")} → ${shortAddress(finding.actual ?? "")}`
  }
}

/** One-line summary led by the worst finding; it has to fit an Arkiv `str`. */
export function summarize(findings: Finding[]): string {
  if (findings.length === 0) return "matches the pinned manifest"
  const critical = findings.find(isCritical)
  if (critical) {
    const rest = findings.length - 1
    const line = describe(critical)
    return rest > 0 ? `${line} (+${rest} more)` : line
  }
  const n = findings.length
  return `${n} verified change${n === 1 ? "" : "s"} since the manifest was pinned`
}
