import assert from "node:assert/strict"
import test from "node:test"
import type { DiamondSnapshot } from "../../types/diamond"
import { classify, compareSnapshot, summarize } from "./compare"

const OWNER = "0x5604A94A3438C3074EFFF803fab14B7244fe4E29" as const
const FACET_A = "0x1111111111111111111111111111111111111111" as const
const FACET_B = "0x2222222222222222222222222222222222222222" as const
const EVIL = "0x000000000000000000000000000000000000dEaD" as const
const HASH_A = `0x${"a".repeat(64)}` as const
const HASH_B = `0x${"b".repeat(64)}` as const
const HASH_EVIL = `0x${"e".repeat(64)}` as const

const pinned: DiamondSnapshot = {
  owner: OWNER,
  block: "1",
  facets: [
    { address: FACET_A, codehash: HASH_A, selectors: ["0xaaaaaaaa", "0xaaaaaaab"] },
    { address: FACET_B, codehash: HASH_B, selectors: ["0xbbbbbbbb"] },
  ],
}

test("an identical diamond has no findings and is ok", () => {
  const findings = compareSnapshot(pinned, structuredClone(pinned))
  assert.deepEqual(findings, [])
  assert.deepEqual(classify(findings), { verdict: "ok", severity: "info" })
})

test("the same code redeployed at a new address is not a change", () => {
  const live = structuredClone(pinned)
  live.facets[0]!.address = "0x3333333333333333333333333333333333333333"
  assert.deepEqual(compareSnapshot(pinned, live), [])
})

test("a new function on an unverified facet is critical", () => {
  const live = structuredClone(pinned)
  live.facets.push({ address: EVIL, codehash: HASH_EVIL, selectors: ["0xdeadbeef"] })
  const findings = compareSnapshot(pinned, live)
  assert.equal(findings.length, 1)
  assert.equal(findings[0]!.kind, "unexpected-function")
  findings[0]!.verified = "unverified"
  assert.deepEqual(classify(findings), { verdict: "suspicious", severity: "critical" })
  assert.match(summarize(findings), /new function 0xdeadbeef → unverified facet 0x0000…dEaD/)
})

test("a verified facet swap is a warning, grouped into one finding", () => {
  const live = structuredClone(pinned)
  live.facets[0] = { address: EVIL, codehash: HASH_EVIL, selectors: ["0xaaaaaaaa", "0xaaaaaaab"] }
  const findings = compareSnapshot(pinned, live)
  assert.equal(findings.length, 1)
  assert.equal(findings[0]!.kind, "facet-code-changed")
  assert.deepEqual(findings[0]!.selectors, ["0xaaaaaaaa", "0xaaaaaaab"])
  findings[0]!.verified = "exact_match"
  assert.deepEqual(classify(findings), { verdict: "changed", severity: "warning" })
  assert.equal(summarize(findings), "1 verified change since the manifest was pinned")
})

test("a removed function is a warning and an owner change is critical", () => {
  const live = structuredClone(pinned)
  live.facets.pop()
  assert.deepEqual(classify(compareSnapshot(pinned, live)), { verdict: "changed", severity: "warning" })

  live.owner = EVIL
  const findings = compareSnapshot(pinned, live)
  assert.deepEqual(classify(findings), { verdict: "suspicious", severity: "critical" })
  assert.match(summarize(findings), /^owner changed 0x5604…4E29 → 0x0000…dEaD \(\+1 more\)$/)
})
