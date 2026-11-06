import { desc, eq } from "@arkiv-network/sdk/query"
import { isAddress, type Address } from "viem"
import { DiamondChecks } from "../../schema"
import type { DiamondCheckRow } from "../../types/diamond"
import { browserClient } from "../arkiv/read-checks"

type Reader = ReturnType<typeof browserClient>

export type DiamondRunRows = { run: bigint; rows: DiamondCheckRow[] }

/** Recent check runs for one diamond, newest first, each with one row per chain. */
export async function readDiamondRuns(
  client: Reader,
  diamondId: string,
  owner: string,
): Promise<{ runs: DiamondRunRows[]; blockNumber: bigint }> {
  let query = client
    .select({
      $key: true,
      $expiresAt: true,
      diamond: true,
      chainId: true,
      chainName: true,
      address: true,
      verdict: true,
      severity: true,
      run: true,
      findings: true,
      detail: true,
      evidence: true,
    })
    .from(DiamondChecks)
    .where(eq("diamond", diamondId))
    .orderBy(desc("run"))
    .limit(100)
  if (isAddress(owner)) query = query.ownedBy(owner as Address)

  const page = await query.fetch()
  const byRun = new Map<bigint, DiamondCheckRow[]>()
  for (const row of page.entities) {
    const run = row.run.value
    const rows = byRun.get(run) ?? []
    rows.push({
      key: row.$key,
      expiresAt: row.$expiresAt,
      diamond: row.diamond.value,
      chainId: row.chainId.value,
      chainName: row.chainName.value,
      address: row.address.value,
      verdict: row.verdict.value,
      severity: row.severity.value,
      run,
      findings: row.findings.value,
      detail: row.detail.value,
      evidence: row.evidence.value,
    })
    byRun.set(run, rows)
  }
  const runs = [...byRun.entries()]
    .sort(([a], [b]) => (a > b ? -1 : 1))
    .map(([run, rows]) => ({ run, rows }))
  return { runs, blockNumber: page.blockNumber }
}
