import { test } from "node:test"
import assert from "node:assert/strict"
import { createTelegramStatusReader } from "../../../server/telegram-status"

test("unconfigured status performs no Telegram request and exposes no destination", async () => {
  const request: typeof fetch = async () => { throw new Error("should not fetch") }
  const result = await createTelegramStatusReader({}, request)()
  assert.equal(result.tokenConfigured, false)
  assert.equal(result.destinationConfigured, false)
  assert.equal(result.botVerified, false)
  assert.equal(result.botUrl, null)
})

test("status verifies bot identity, shares concurrent lookups and strips secrets", async () => {
  let calls = 0
  const request: typeof fetch = async () => {
    calls++
    return new Response(JSON.stringify({ ok: true, result: { is_bot: true, username: "DataVerifyBot", first_name: "DataVerify", id: 123 } }))
  }
  const read = createTelegramStatusReader({ TELEGRAM_BOT_TOKEN: "123:private-token", TELEGRAM_CHAT_ID: "-987654321", MONITOR_ENABLED: "true" }, request)
  const results = await Promise.all([read(), read(), read()])
  assert.equal(calls, 1)
  assert.equal(results[0].botUrl, "https://t.me/DataVerifyBot")
  assert.equal(results[0].botVerified, true)
  assert.equal(results[0].destinationConfigured, true)
  assert.equal(results[0].monitoringEnabled, true)
  assert.equal(JSON.stringify(results).includes("private-token"), false)
  assert.equal(JSON.stringify(results).includes("987654321"), false)
  await read()
  assert.equal(calls, 1)
})

test("network errors and malformed bot usernames never become links or raw errors", async () => {
  const env = { TELEGRAM_BOT_TOKEN: "secret", TELEGRAM_CHAT_ID: "private-destination" }
  const broken: typeof fetch = async () => { throw new Error("https://api.telegram.org/botsecret/getMe") }
  const failed = await createTelegramStatusReader(env, broken)()
  assert.equal(failed.botVerified, false)
  assert.equal(JSON.stringify(failed).includes("secret"), false)
  const malformed: typeof fetch = async () => new Response(JSON.stringify({ ok: true, result: { is_bot: true, username: "../../evil.example" } }))
  assert.equal((await createTelegramStatusReader(env, malformed)()).botUrl, null)
})
