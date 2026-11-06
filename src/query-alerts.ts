import "dotenv/config"
import { desc, eq } from "@arkiv-network/sdk/query"
import { getAddress, isAddress } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import type { Hex } from "viem"
import { ALERT_SCHEMA_NAME, ZERO_ADDRESS } from "./config"
import { UpgradeAlerts } from "./schema"
import { arkivPublic } from "./lib/arkiv/write-checks"

/**
 * The public query judges can run: "proxy upgrades to <severity> in the watcher's
 * feed, newest first." Defaults to the most interesting slice — critical alerts,
 * i.e. upgrades to unverified code.
 *
 *   npm run query:alerts                 # critical (unverified) upgrades
 *   npm run query:alerts -- --severity warning
 *   npm run query:alerts -- --all
 */
function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index < 0) return undefined
  return process.argv[index + 1]
}

const severity = process.argv.includes("--all") ? undefined : flag("--severity") ?? "critical"

const fromKey = process.env.PRIVATE_KEY
const raw =
  fromKey && fromKey.startsWith("0x") && fromKey.length === 66
    ? privateKeyToAccount(fromKey as Hex).address
    : process.env.VITE_WATCHER_ADDRESS ?? process.env.VITE_VERIFIER_ADDRESS

if (!raw || !isAddress(raw) || getAddress(raw) === getAddress(ZERO_ADDRESS)) {
  throw new Error("Set PRIVATE_KEY or VITE_WATCHER_ADDRESS to the watcher wallet.")
}

const owner = getAddress(raw)
const client = arkivPublic()

let query = client
  .select({
    proxyName: true,
    proxy: true,
    oldImpl: true,
    newImpl: true,
    verified: true,
    severity: true,
    block: true,
    detail: true,
  })
  .from(UpgradeAlerts)
  .ownedBy(owner)
  .orderBy(desc("block"))
  .limit(100)

if (severity) query = query.where(eq("severity", severity))

const page = await query.fetch()

const where = [
  `arkiv.schema = str('${ALERT_SCHEMA_NAME}')`,
  severity ? `severity = str('${severity}')` : null,
  `$owner = addr(${owner})`,
]
  .filter(Boolean)
  .join(" AND ")
console.log(`query: ${where} ORDER BY block DESC`)
console.log(`${page.entities.length} alerts at Arkiv block ${page.blockNumber}\n`)
for (const row of page.entities) {
  console.log(
    `[${row.severity.value}] ${row.proxyName.value}  ${row.oldImpl.value} -> ${row.newImpl.value}  ${row.verified.value}  (block ${row.block.value})`,
  )
}
