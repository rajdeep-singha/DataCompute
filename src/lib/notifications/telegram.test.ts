import { test } from "node:test"
import assert from "node:assert/strict"
import { sendTelegram } from "./telegram"

test("sends bounded plain text without exposing credentials in content", async () => {
  let payload: Record<string, unknown> = {}
  const request: typeof fetch = async (_url, init) => {
    payload = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({ ok: true }))
  }
  assert.deepEqual(await sendTelegram("secret", "123", "x".repeat(5000), request), { ok: true })
  assert.equal(String(payload.text).length, 4000)
  assert.equal(payload.chat_id, "123")
  assert.equal(payload.parse_mode, undefined)
  assert.equal(JSON.stringify(payload).includes("secret"), false)
})

test("honors Telegram rate limits and sanitizes transport errors", async () => {
  const request: typeof fetch = async () => new Response(JSON.stringify({ ok: false, error_code: 429, parameters: { retry_after: 25 } }), { status: 429 })
  assert.deepEqual(await sendTelegram("secret", "123", "alert", request), {
    ok: false, code: "telegram_429", permanent: false, retryAfterMs: 25_000,
  })
  const broken: typeof fetch = async () => { throw new Error("URL contains secret") }
  assert.deepEqual(await sendTelegram("secret", "123", "alert", broken), { ok: false, code: "network_or_invalid_response" })
})

test("non-JSON authentication errors are permanent; malformed success is retryable", async () => {
  const unauthorized: typeof fetch = async () => new Response("unauthorized", { status: 401 })
  const result = await sendTelegram("secret", "123", "alert", unauthorized)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.permanent, true)
  const malformed: typeof fetch = async () => new Response("not JSON")
  assert.equal((await sendTelegram("secret", "123", "alert", malformed)).ok, false)
})
