import { getAddress, isAddress, type Address, type Hex } from "viem"
import type { TrustTier } from "../../config"
import { buildChecks } from "../checks/checks"
import { ethereumClient, readImplementation, readMetadata } from "../eth/ethereum"

/**
 * The listing verifier. Runs at publish time and decides a trust tier honestly:
 *
 *  - verified      — the platform re-ran a real check that passed (token-checks)
 *  - attested      — the seller gave an on-chain proof the platform confirmed exists
 *  - self-reported — no verifiable proof; the badge says so, so buyers aren't misled
 *
 * The `proof` is free text: a comma/space separated list of token addresses to
 * re-check, or a single transaction hash to confirm. Anything else stays
 * self-reported.
 */

function parseTokens(proof: string): Address[] {
  return proof
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length === 42 && isAddress(s))
    .map((s) => getAddress(s))
}

function parseTxHash(proof: string): Hex | null {
  const t = proof.trim()
  return /^0x[0-9a-fA-F]{64}$/.test(t) ? (t as Hex) : null
}

async function tokenPasses(eth: ReturnType<typeof ethereumClient>, token: Address): Promise<boolean> {
  const [metadata, proxy] = await Promise.all([readMetadata(eth, token), readImplementation(eth, token)])
  const drafts = buildChecks(
    { chainId: 1, address: token, name: metadata.name ?? "", symbol: metadata.symbol ?? "", decimals: metadata.decimals ?? -1 },
    metadata,
    proxy.implementation,
    proxy.hasCode,
  )
  return drafts.find((d) => d.check === "erc20")?.status === "pass"
}

export async function runVerifier(proof?: string): Promise<{ tier: TrustTier; detail: string }> {
  if (!proof || !proof.trim()) return { tier: "self-reported", detail: "no proof supplied" }

  const tokens = parseTokens(proof)
  if (tokens.length > 0) {
    const eth = ethereumClient()
    const results = await Promise.all(tokens.map((t) => tokenPasses(eth, t).catch(() => false)))
    const passed = results.filter(Boolean).length
    if (passed === tokens.length) {
      return { tier: "verified", detail: `re-checked ${tokens.length} token(s) on Ethereum — all pass erc20` }
    }
    return { tier: "self-reported", detail: `only ${passed}/${tokens.length} tokens pass re-check` }
  }

  const tx = parseTxHash(proof)
  if (tx) {
    const eth = ethereumClient()
    try {
      const found = await eth.getTransaction({ hash: tx })
      if (found) return { tier: "attested", detail: `on-chain tx ${tx.slice(0, 10)}… confirmed on Ethereum` }
    } catch {
      // not found
    }
    return { tier: "self-reported", detail: "proof tx not found on Ethereum" }
  }

  return { tier: "self-reported", detail: "proof is not a token address or tx hash" }
}
