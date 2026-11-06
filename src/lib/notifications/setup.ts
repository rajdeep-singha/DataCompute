import { appendFile, readFile } from "node:fs/promises"
import { createInterface } from "node:readline"
import { Writable } from "node:stream"
import { parse } from "dotenv"

/** Read a secret with terminal echo disabled; never put it in command history. */
export async function promptBotToken(): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("No bot token found. Run npm run telegram -- chats in an interactive terminal to configure it.")
  }
  console.log("No TELEGRAM_BOT_TOKEN was found in the saved project .env.")
  process.stdout.write("Paste your BotFather token (hidden), then press Enter: ")
  const muted = new Writable({ write(_chunk, _encoding, callback) { callback() } })
  const terminal = createInterface({ input: process.stdin, output: muted, terminal: true, historySize: 0 })
  try {
    return await new Promise<string>((resolve, reject) => {
      terminal.once("SIGINT", () => reject(new Error("Telegram setup cancelled. No token was saved.")))
      terminal.once("close", () => reject(new Error("Telegram setup cancelled. No token was saved.")))
      terminal.question("", resolve)
    })
  } finally {
    terminal.close()
    muted.end()
    process.stdout.write("\n")
  }
}

export async function ensureTelegramToken(
  envPath: string,
  env: NodeJS.ProcessEnv = process.env,
  prompt = promptBotToken,
): Promise<string> {
  if (env.TELEGRAM_BOT_TOKEN?.trim()) return env.TELEGRAM_BOT_TOKEN.trim()
  let saved = ""
  try { saved = await readFile(envPath, "utf8") }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Could not read the project .env. Check its file permissions.") }
  const existing = parse(saved).TELEGRAM_BOT_TOKEN?.trim()
  // An exported empty shell variable must not hide a saved token.
  if (existing) { env.TELEGRAM_BOT_TOKEN = existing; return existing }

  const token = (await prompt()).trim()
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) {
    throw new Error("That does not look like a BotFather token. Copy the complete token and try again; nothing was saved.")
  }
  // Append without rewriting other settings. dotenv uses the final assignment
  // if an earlier TELEGRAM_BOT_TOKEN entry was empty.
  try { await appendFile(envPath, `\nTELEGRAM_BOT_TOKEN=${token}\n`, { mode: 0o600 }) }
  catch { throw new Error("Could not save the token to the project .env. Check its file permissions.") }
  env.TELEGRAM_BOT_TOKEN = token
  console.log(`Bot token saved to ${envPath}.`)
  console.log("Send /start to your bot in Telegram if you have not already done so.")
  return token
}
