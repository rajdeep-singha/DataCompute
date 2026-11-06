import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Outbox } from "./outbox"

test("pending messages and deduplication survive restarts; recovery allows recurrence", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "dataverify-outbox-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const path = join(dir, "queue.sqlite")
  let now = 1000
  const sent: string[] = []
  const send = async (text: string) => { sent.push(text); return { ok: true as const } }
  const first = new Outbox(path, "chat", send, () => now)
  first.observe("contract", "bad", "risk")
  first.close()
  const next = new Outbox(path, "chat", send, () => now)
  t.after(() => next.close())
  next.observe("contract", "bad", "duplicate")
  assert.equal(await next.tick(), true)
  now += 3100
  assert.equal(await next.tick(), false)
  next.observe("contract", null, undefined, "recovered")
  next.observe("contract", "bad", "risk again")
  await next.tick()
  now += 3100
  await next.tick()
  assert.deepEqual(sent, ["risk", "recovered", "risk again"])
})

test("429 retry_after gates the destination, retries, and preserves other jobs", async (t) => {
  let now = 1000
  let calls = 0
  const queue = new Outbox(":memory:", "chat", async () => ++calls === 1
    ? { ok: false, code: "telegram_429", retryAfterMs: 60_000 }
    : { ok: true }, () => now)
  t.after(() => queue.close())
  queue.enqueue("first")
  queue.enqueue("second")
  await queue.tick()
  now += 59_999
  assert.equal(await queue.tick(), false)
  assert.equal(calls, 1)
  now += 1
  await queue.tick()
  now += 3100
  await queue.tick()
  assert.equal(calls, 3)
  assert.deepEqual(queue.status(), [])
})

test("permanent failures remain inspectable and can be retried after configuration repair", async (t) => {
  let now = 0
  let works = false
  const queue = new Outbox(":memory:", "chat", async () => works ? { ok: true } : { ok: false, permanent: true, code: "telegram_403" }, () => now)
  t.after(() => queue.close())
  queue.enqueue("alert")
  await queue.tick()
  assert.equal(queue.status()[0].status, "failed")
  now += 60_000
  assert.equal(await queue.tick(), false)
  works = true
  queue.retryFailed()
  assert.equal(await queue.tick(), true)
  assert.deepEqual(queue.status(), [])
})

test("two workers sharing storage do not claim the same delivery", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "dataverify-workers-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  let calls = 0
  const send = async () => { calls++; await pending; return { ok: true as const } }
  const first = new Outbox(join(dir, "q.sqlite"), "chat", send)
  const second = new Outbox(join(dir, "q.sqlite"), "chat", send)
  t.after(() => { first.close(); second.close() })
  first.enqueue("alert")
  const delivering = first.tick()
  assert.equal(await second.tick(), false)
  release()
  await delivering
  assert.equal(calls, 1)
})

test("network throws leave a retryable job", async (t) => {
  let now = 0
  let calls = 0
  const queue = new Outbox(":memory:", "chat", async () => { if (++calls === 1) throw new Error("offline"); return { ok: true } }, () => now)
  t.after(() => queue.close())
  queue.enqueue("alert")
  await queue.tick()
  assert.equal(queue.status()[0].status, "pending")
  now += 3100
  await queue.tick()
  assert.equal(calls, 2)
})
