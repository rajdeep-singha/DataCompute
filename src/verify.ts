import "dotenv/config"
import { ethereumClient, readImplementation, readMetadata } from "./lib/eth/ethereum"
import { buildChecks } from "./lib/checks/checks"
import { loadMainnetTokens } from "./lib/checks/tokenlist"
import { arkivClients, writeChecks } from "./lib/arkiv/write-checks"

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index < 0) return undefined
  return process.argv[index + 1]
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length)
  let cursor = 0
  async function worker() {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      const item = items[index]
      if (item === undefined) return
      results[index] = await fn(item, index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

const limit = Number(flag("--limit") ?? "30")
const dryRun = process.argv.includes("--dry-run")

if (!Number.isInteger(limit) || limit < 1) {
  throw new Error("--limit must be a positive integer")
}

const tokens = await loadMainnetTokens(limit)
console.log(`loaded ${tokens.length} mainnet tokens from the Uniswap default list`)

const eth = ethereumClient()
const block = await eth.getBlockNumber()
console.log(`reading Ethereum at block ${block}`)

const prepared = await mapPool(tokens, 4, async (token) => {
  const [metadata, proxy] = await Promise.all([
    readMetadata(eth, token.address),
    readImplementation(eth, token.address),
  ])
  const drafts = buildChecks(token, metadata, proxy.implementation, proxy.hasCode)
  console.log(
    `${token.symbol.padEnd(8)} ${drafts.map((draft) => `${draft.check}=${draft.status}`).join(" ")}`,
  )
  return drafts.map((draft) => ({
    subject: token.address,
    draft,
    chainId: 1n,
    block,
  }))
})

const rows = prepared.flat()
const counts = { pass: 0, mismatch: 0, fail: 0, absent: 0 }
for (const row of rows) counts[row.draft.status] += 1
console.log(
  `${rows.length} checks: ${counts.pass} pass, ${counts.mismatch} mismatch, ${counts.fail} fail, ${counts.absent} absent`,
)

if (dryRun) {
  console.log("dry run, nothing written")
} else {
  const clients = arkivClients()
  console.log(`writing as ${clients.account.address}`)
  await writeChecks(clients, rows)
  console.log("done. Put that address in VITE_VERIFIER_ADDRESS and refresh the app.")
}
