import "dotenv/config"
import { setTimeout as delay } from "node:timers/promises"
import { telegramOutbox } from "./lib/notifications/telegram"
import { fileURLToPath } from "node:url"
import { ensureTelegramToken } from "./lib/notifications/setup"
import { discoverTelegramChats } from "./lib/notifications/discover-chats"

async function main() {
  const command = process.argv[2] ?? "status"
  if (!["chat", "chats", "status", "retry", "worker"].includes(command)) {
    console.error("Usage: npm run telegram -- chats|status|retry|worker (chat is also accepted)")
    process.exit(1)
  }
  if (command === "chats" || command === "chat") {
    const token = await ensureTelegramToken(fileURLToPath(new URL("../.env", import.meta.url)))
    const chats = await discoverTelegramChats(token)
    if (!chats.length) console.log("No chat received yet. Send /start to the bot linked above and rerun this command. If another app uses this bot, it may be consuming the updates.")
    else {
      for (const chat of chats) console.log(`TELEGRAM_CHAT_ID=${chat.id} (${chat.type}${chat.title ? `: ${chat.title}` : ""})`)
      console.log("Add the intended TELEGRAM_CHAT_ID to the project root .env, then restart npm run server.")
    }
  } else {
    const queue = telegramOutbox()
    if (!queue) throw new Error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env first.")
    if (command === "status") console.log(queue.status())
    else if (command === "retry") { queue.retryFailed(); console.log("Failed messages returned to the pending queue.") }
    else if (command === "worker") {
      console.log("Telegram delivery worker running. Ctrl+C to stop.")
      for (;;) { await queue.tick(); await delay(1500) }
    } else throw new Error("Usage: npm run telegram -- chats|status|retry|worker")
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Telegram setup failed.")
  process.exitCode = 1
})
