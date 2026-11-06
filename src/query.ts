import "dotenv/config"
import { getAddress, isAddress } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import type { Hex } from "viem"
import { arkivPublic, readMismatchSample } from "./lib/arkiv/write-checks"
import { SCHEMA_NAME, ZERO_ADDRESS } from "./config"

const fromKey = process.env.PRIVATE_KEY
const raw = fromKey && fromKey.startsWith("0x") && fromKey.length === 66
  ? privateKeyToAccount(fromKey as Hex).address
  : process.env.VITE_VERIFIER_ADDRESS

if (!raw || !isAddress(raw) || getAddress(raw) === getAddress(ZERO_ADDRESS)) {
  throw new Error("Set PRIVATE_KEY or VITE_VERIFIER_ADDRESS to the wallet that wrote the checks.")
}

const owner = getAddress(raw)
const page = await readMismatchSample(arkivPublic(), owner)
console.log(`query: arkiv.schema = str('${SCHEMA_NAME}') AND status = str('mismatch') AND $owner = addr(${owner})`)
console.log(`${page.entities.length} mismatch rows at Arkiv block ${page.blockNumber}`)
for (const row of page.entities) {
  console.log(`${row.symbol.value}\t${row.check.value}\t${row.subject.value}\t${row.detail.value}`)
}
