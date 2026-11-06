import type { Address } from "viem"
import { SOURCIFY_API, SOURCIFY_USER_AGENT } from "../../config"
import type { ethereumClient } from "../eth/ethereum"
import type { VerifiedStatus } from "./sourcify"

/**
 * The evidence bundle an alert points at on Swarm. It captures everything a
 * skeptic needs to re-check the alert independently: the bytecode of both
 * implementations and the Sourcify metadata snapshot of the new one, pinned at
 * the block the upgrade was observed.
 */
export type Evidence = {
  schema: "dataverify.upgrade-evidence/1"
  proxy: Address
  proxyName: string
  block: string
  observedAt: string
  oldImpl: Address
  newImpl: Address
  verified: VerifiedStatus
  oldImplBytecode: string
  newImplBytecode: string
  sourcifyMetadata: unknown
}

async function getCode(client: ReturnType<typeof ethereumClient>, address: Address): Promise<string> {
  if (/^0x0+$/.test(address)) return "0x"
  try {
    const code = await client.getCode({ address })
    return code ?? "0x"
  } catch {
    return "0x"
  }
}

/** Pulls the Sourcify metadata JSON for the new implementation, if any. */
async function sourcifyMetadata(address: Address, chainId = 1): Promise<unknown> {
  try {
    const res = await fetch(`${SOURCIFY_API}/v2/contract/${chainId}/${address}?fields=metadata`, {
      headers: { "User-Agent": SOURCIFY_USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { metadata?: unknown }
    return body.metadata ?? null
  } catch {
    return null
  }
}

export async function buildEvidence(
  client: ReturnType<typeof ethereumClient>,
  args: {
    proxy: Address
    proxyName: string
    block: bigint
    oldImpl: Address
    newImpl: Address
    verified: VerifiedStatus
  },
): Promise<Evidence> {
  const [oldImplBytecode, newImplBytecode, sourcify] = await Promise.all([
    getCode(client, args.oldImpl),
    getCode(client, args.newImpl),
    sourcifyMetadata(args.newImpl),
  ])
  return {
    schema: "dataverify.upgrade-evidence/1",
    proxy: args.proxy,
    proxyName: args.proxyName,
    block: args.block.toString(),
    observedAt: new Date().toISOString(),
    oldImpl: args.oldImpl,
    newImpl: args.newImpl,
    verified: args.verified,
    oldImplBytecode,
    newImplBytecode,
    sourcifyMetadata: sourcify,
  }
}
