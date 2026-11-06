import { desc, eq } from "@arkiv-network/sdk/query"
import { addr } from "@arkiv-network/sdk/schema"
import { isAddress, type Address } from "viem"
import { UpgradeAlerts } from "../../schema"
import type { AlertFilters, AlertRow } from "../../types/alert"
import { browserClient } from "../arkiv/read-checks"

type Reader = ReturnType<typeof browserClient>

const SELECTION = {
  $key: true,
  $owner: true,
  $expiresAt: true,
  proxy: true,
  proxyName: true,
  oldImpl: true,
  newImpl: true,
  verified: true,
  severity: true,
  block: true,
  detail: true,
  evidence: true,
} as const

export async function readAlerts(
  client: Reader,
  filters: AlertFilters,
  owner: string,
): Promise<{ rows: AlertRow[]; blockNumber: bigint }> {
  // Newest alerts first: block is the chain height when the upgrade was seen.
  let query = client.select(SELECTION).from(UpgradeAlerts).orderBy(desc("block")).limit(100)

  if (isAddress(owner)) query = query.ownedBy(owner as Address)
  if (filters.severity) query = query.where(eq("severity", filters.severity))
  if (filters.verified) query = query.where(eq("verified", filters.verified))
  if (filters.proxy.trim() && isAddress(filters.proxy.trim())) {
    query = query.where(eq("proxy", addr(filters.proxy.trim())))
  }

  const page = await query.fetch()
  const rows: AlertRow[] = page.entities.map((row) => ({
    key: row.$key,
    owner: row.$owner,
    expiresAt: row.$expiresAt,
    proxy: row.proxy.value,
    proxyName: row.proxyName.value,
    oldImpl: row.oldImpl.value,
    newImpl: row.newImpl.value,
    verified: row.verified.value,
    severity: row.severity.value,
    block: row.block.value,
    detail: row.detail.value,
    evidence: row.evidence.value,
  }))
  return { rows, blockNumber: page.blockNumber }
}
