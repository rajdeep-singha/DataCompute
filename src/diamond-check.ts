import "dotenv/config"
import { runDiamondCheck } from "./lib/diamond/check"

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index < 0 ? undefined : process.argv[index + 1]
}

async function main() {
  const diamondId = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "lifi"
  const simulate = flag("--simulate")
  await runDiamondCheck({
    diamondId,
    simulate: simulate ? Number(simulate) : undefined,
    log: console.log,
  })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
