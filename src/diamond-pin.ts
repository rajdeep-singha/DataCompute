import "dotenv/config"
import { getAddress } from "viem"
import { diamondChain } from "./config"
import { findDiamond } from "./lib/diamond/check"
import { blockDaysAgo, readDiamond } from "./lib/diamond/loupe"
import { writeManifest } from "./lib/diamond/manifest"
import type { DiamondManifest, DiamondSnapshot } from "./types/diamond"

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index < 0 ? undefined : process.argv[index + 1]
}

/**
 * Snapshots a diamond's facets on every chain as the trusted manifest.
 * Only pin after reviewing the diamond: everything pinned is treated as correct.
 * `--days-ago N` pins the state from N days back, so the next check shows what
 * really changed since; chains whose RPC has no history that far fall back to now.
 */
async function main() {
  const diamondId = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "lifi"
  const daysAgo = Number(flag("--days-ago") ?? 0)
  const diamond = findDiamond(diamondId)
  const address = getAddress(diamond.address)
  const manifest: DiamondManifest = {
    diamond: diamond.id,
    address,
    pinnedAt: new Date().toISOString(),
    chains: {},
  }
  for (const chainId of diamond.chainIds) {
    const name = diamondChain(chainId)?.name
    let snapshot: DiamondSnapshot
    let when = "now"
    if (daysAgo > 0) {
      try {
        snapshot = await readDiamond(chainId, address, await blockDaysAgo(chainId, daysAgo))
        when = `${daysAgo} days ago`
      } catch (error) {
        const reason = error instanceof Error ? error.message.split("\n")[0] : String(error)
        console.log(`${name}: couldn't read ${daysAgo} days back (${reason}), pinning current state instead`)
        snapshot = await readDiamond(chainId, address)
      }
    } else {
      snapshot = await readDiamond(chainId, address)
    }
    manifest.chains[String(chainId)] = snapshot
    const selectors = snapshot.facets.reduce((n, f) => n + f.selectors.length, 0)
    console.log(`${name}: ${snapshot.facets.length} facets, ${selectors} functions, block ${snapshot.block} (${when})`)
  }
  console.log(`pinned → ${await writeManifest(diamond.id, manifest)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
