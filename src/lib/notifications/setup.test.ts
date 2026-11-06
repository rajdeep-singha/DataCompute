import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parse } from "dotenv"
import { ensureTelegramToken } from "./setup"

const fakeToken = "12345:fake_token_for_offline_testing_only"

test("missing token can be entered locally without overwriting existing settings", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "telegram-setup-"))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const path = join(dir, ".env")
  const original = "# preserve this\nPORT=8787\nTELEGRAM_BOT_TOKEN=\n"
  await writeFile(path, original)
  const env: NodeJS.ProcessEnv = {}
  assert.equal(await ensureTelegramToken(path, env, async () => fakeToken), fakeToken)
  const saved = await readFile(path, "utf8")
  assert.ok(saved.startsWith(original))
  assert.equal(parse(saved).TELEGRAM_BOT_TOKEN, fakeToken)
  assert.equal(env.TELEGRAM_BOT_TOKEN, fakeToken)
})

test("empty shell variable falls back to saved token without prompting", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "telegram-setup-"))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const path = join(dir, ".env")
  await writeFile(path, `TELEGRAM_BOT_TOKEN=${fakeToken}\n`)
  assert.equal(await ensureTelegramToken(path, { TELEGRAM_BOT_TOKEN: "" }, async () => { throw new Error("should not prompt") }), fakeToken)
})

test("invalid or multiline tokens do not change the saved file", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "telegram-setup-"))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const path = join(dir, ".env")
  await writeFile(path, "PORT=8787\n")
  await assert.rejects(ensureTelegramToken(path, {}, async () => `${fakeToken}\nOTHER=bad`), /nothing was saved/)
  assert.equal(await readFile(path, "utf8"), "PORT=8787\n")
})
