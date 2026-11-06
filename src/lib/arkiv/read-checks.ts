import { createPublicClient } from "@arkiv-network/sdk"
import { rabdi } from "@arkiv-network/sdk/chains"
import { asc, eq } from "@arkiv-network/sdk/query"
import { addr } from "@arkiv-network/sdk/schema"
import { http, isAddress, type Address } from "viem"
import { ZERO_ADDRESS } from "../../config"
import { Checks } from "../../schema"
import type { CheckFilters, CheckRow } from "../../types/check"

const SELECTION = {
  $key: true,
  $owner: true,
  $expiresAt: true,
  chainId: true,
  subject: true,
  check: true,
  status: true,
  block: true,
  implementation: true,
  symbol: true,
  name: true,
  decimals: true,
  detail: true,
} as const

export function browserClient() {
  return createPublicClient({
    chain: rabdi({ accessKey: import.meta.env.VITE_ARKIV_ACCESS_KEY ?? "" }),
    transport: http(undefined, { timeout: 8_000, retryCount: 0 }),
  })
}

type Reader = ReturnType<typeof browserClient>

export async function readChecks(
  client: Reader,
  filters: CheckFilters,
  owner: string,
): Promise<{ rows: CheckRow[]; blockNumber: bigint }> {
  let query = client.select(SELECTION).from(Checks).orderBy(asc("$key")).limit(100)

  if (isAddress(owner) && owner.toLowerCase() !== ZERO_ADDRESS) {
    query = query.ownedBy(owner as Address)
  }
  if (filters.status) query = query.where(eq("status", filters.status))
  if (filters.check) query = query.where(eq("check", filters.check))
  if (filters.symbol.trim()) query = query.where(eq("symbol", filters.symbol.trim()))
  if (filters.subject.trim() && isAddress(filters.subject.trim())) {
    query = query.where(eq("subject", addr(filters.subject.trim())))
  }

  const page = await query.fetch()
  const rows: CheckRow[] = page.entities.map((row) => ({
    key: row.$key,
    owner: row.$owner,
    expiresAt: row.$expiresAt,
    chainId: row.chainId.value,
    subject: row.subject.value,
    check: row.check.value,
    status: row.status.value,
    block: row.block.value,
    implementation: row.implementation.value,
    symbol: row.symbol.value,
    name: row.name.value,
    decimals: row.decimals.value,
    detail: row.detail.value,
  }))
  return { rows, blockNumber: page.blockNumber }
}
