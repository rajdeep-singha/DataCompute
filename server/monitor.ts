import { DIAMONDS } from "../src/config"
import { runWatch } from "../src/lib/alerts/watcher"
import { runDiamondCheck } from "../src/lib/diamond/check"
import { recordNotification } from "../src/lib/notifications/telegram"

/** Shares the server's write lock; schedules after completion to avoid overlap. */
export function startMonitor(exclusive: (name: string, fn: () => Promise<void>) => Promise<void>) {
  if (process.env.MONITOR_ENABLED !== "true") return () => {}
  const seconds = Number(process.env.MONITOR_INTERVAL_SECONDS || 60)
  if (!Number.isFinite(seconds) || seconds < 15) throw new Error("MONITOR_INTERVAL_SECONDS must be at least 15")
  let stopped = false
  let timer: ReturnType<typeof setTimeout>
  async function check(name: string, run: () => Promise<unknown>) {
    try {
      await run()
      recordNotification((q) => q.observe(`monitor:${name}`, null, undefined, `Tracer — Monitor restored\n${name}`))
    } catch {
      console.error(`Monitor: ${name} failed; retrying next cycle.`)
      recordNotification((q) => q.observe(`monitor:${name}`, "failed", `Tracer — Monitor error\n${name} could not finish. Monitoring or audit persistence may be incomplete; inspect server logs/configuration.`))
    }
  }
  async function cycle() {
    try {
      await exclusive("scheduled monitoring", async () => {
        await check("proxy watcher", () => runWatch({ log: console.log }))
        for (const diamond of DIAMONDS) {
          if (stopped) break
          await check(diamond.name, () => runDiamondCheck({ diamondId: diamond.id, log: console.log }))
        }
      })
    } finally {
      if (!stopped) timer = setTimeout(() => void cycle(), seconds * 1000)
    }
  }
  timer = setTimeout(() => void cycle(), 0)
  console.log(`Continuous monitoring enabled; ${seconds}s between completed cycles.`)
  return () => { stopped = true; clearTimeout(timer) }
}
