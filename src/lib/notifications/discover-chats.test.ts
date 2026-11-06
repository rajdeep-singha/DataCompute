import { test } from "node:test"
import assert from "node:assert/strict"
import { discoverTelegramChats } from "./discover-chats"

function responses(results: unknown[]): typeof fetch {
  return async () => new Response(JSON.stringify({ ok: true, result: results.shift() }))
}
const bot = { is_bot: true, username: "DataVerifyBot" }

test("discovery identifies the actual bot and returns unique private and group destinations", async () => {
  const logs: string[] = []
  const chats = await discoverTelegramChats("secret", (line) => logs.push(line), responses([bot, { url: "" }, [
    { message: { chat: { id: 123, type: "private" } } },
    { message: { chat: { id: 123, type: "private" } } },
    { my_chat_member: { chat: { id: -456, type: "group", title: "Workspace" } } },
    { channel_post: { chat: { id: -789, type: "channel" } } },
  ]]))
  assert.deepEqual(chats.map(c => c.id), [123, -456, -789])
  assert.ok(logs[0].includes("https://t.me/DataVerifyBot"))
  assert.equal(logs.join().includes("secret"), false)
})

test("webhook conflicts explain the blocker without removing the webhook", async () => {
  let calls = 0
  const request: typeof fetch = async () => {
    calls++
    return new Response(JSON.stringify({ ok: true, result: calls === 1 ? bot : { url: "https://private.example/webhook" } }))
  }
  await assert.rejects(discoverTelegramChats("secret", () => {}, request), /webhook managed by another application/)
  assert.equal(calls, 2)
})

test("bad token and network failures give specific errors without leaking credentials", async () => {
  const unauthorized: typeof fetch = async () => new Response(JSON.stringify({ ok: false, error_code: 401 }), { status: 401 })
  await assert.rejects(discoverTelegramChats("secret", () => {}, unauthorized), /rejected the bot token/)
  const offline: typeof fetch = async () => { throw new Error("fetch failed https://api.telegram.org/botsecret/getMe") }
  await assert.rejects(discoverTelegramChats("secret", () => {}, offline), (error: Error) => error.message.includes("Could not reach Telegram") && !error.message.includes("botsecret"))
})
