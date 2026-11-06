import { test } from "node:test"
import assert from "node:assert/strict"
import { Outbox } from "./outbox"
import { notifyDiamond, notifyProxy } from "./events"
import type { ChainResult } from "../../types/diamond"

const address = "0x0000000000000000000000000000000000000001"
const bad: ChainResult = { chainId: 137, chain: "Polygon", verdict: "suspicious", severity: "critical", facets: 1, selectors: 1,
  detail: "unexpected function", findings: [{ kind: "unexpected-function", selectors: ["0x12345678"], facet: address,
    expected: null, actual: address, actualCodehash: "0xaa", verified: "unverified" }] }

test("diamond simulation and unreachable reads cannot clear real risk; changes and recovery notify", async (t) => {
  let now = 0
  const messages: string[] = []
  const queue = new Outbox(":memory:", "chat", async (text) => { messages.push(text); return { ok: true } }, () => now)
  t.after(() => queue.close())
  const record = (fn: (queue: Outbox) => void) => fn(queue)
  const notify = (result: ChainResult, simulated = false) => notifyDiamond("LI.FI", address, result, simulated, record)
  notify(bad)
  notify(bad) // duplicate
  notify(bad, true)
  notify({ ...bad, verdict: "unreachable", findings: [] })
  notify(bad) // health recovery, no repeated risk
  notify({ ...bad, findings: [{ ...bad.findings[0], actualCodehash: "0xbb" }] })
  notify({ ...bad, verdict: "ok", severity: "info", findings: [] })
  for (let i = 0; i < 10; i++) { await queue.tick(); now += 3100 }
  assert.equal(messages.length, 6)
  assert.equal(messages.filter((m) => m.includes("SIMULATION")).length, 1)
  assert.equal(messages.filter((m) => m.includes("Findings cleared")).length, 1)
  assert.equal(messages.filter((m) => m.includes("Monitoring restored")).length, 1)
})

test("proxy baselines are silent and simulations don't replace live deduplication state", async (t) => {
  let now = 0
  const messages: string[] = []
  const queue = new Outbox(":memory:", "chat", async (text) => { messages.push(text); return { ok: true } }, () => now)
  t.after(() => queue.close())
  const record = (fn: (queue: Outbox) => void) => fn(queue)
  const args = { proxy: address, name: "USDC", oldImpl: address, newImpl: address, block: 1n, verified: "unverified", severity: "critical" } as const
  notifyProxy({ ...args, baseline: true }, record)
  notifyProxy({ ...args, newImpl: "0x0000000000000000000000000000000000000002" }, record)
  notifyProxy({ ...args, simulated: true }, record)
  notifyProxy({ ...args, newImpl: "0x0000000000000000000000000000000000000002" }, record)
  for (let i = 0; i < 5; i++) { await queue.tick(); now += 3100 }
  assert.equal(messages.length, 2)
  assert.equal(messages[1].startsWith("🧪 SIMULATION"), true)
})
