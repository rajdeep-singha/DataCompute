import "dotenv/config"
import { resetWatcher, runWatch } from "./lib/alerts/watcher"
import { flushTelegram } from "./lib/notifications/telegram"

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index < 0) return undefined
  return process.argv[index + 1]
}

async function main() {
  if (process.argv.includes("--reset")) {
    console.log("resetting watcher")
    await resetWatcher(console.log)
  }
  try { await runWatch({ simulate: flag("--simulate"), log: console.log }) }
  finally { await flushTelegram() }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
