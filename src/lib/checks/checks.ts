import type { CheckDraft, CheckStatus, ListedToken, ChainMetadata } from "../../types/check"
import { ZERO_ADDRESS } from "../../config"

function sameText(left: string | null, right: string): boolean {
  return (left ?? "").trim() === right.trim()
}

export function buildChecks(
  listed: ListedToken,
  chain: ChainMetadata,
  implementation: `0x${string}` | null,
  implementationHasCode: boolean,
): CheckDraft[] {
  const symbol = chain.symbol ?? listed.symbol
  const name = chain.name ?? listed.name
  const decimals = chain.decimals ?? -1
  const readable = chain.name !== null && chain.symbol !== null && chain.decimals !== null

  const erc20Detail = readable
    ? "name, symbol and decimals returned"
    : [chain.nameError, chain.symbolError, chain.decimalsError].filter(Boolean).join("; ")

  const diffs: string[] = []
  if (chain.symbol !== null && !sameText(chain.symbol, listed.symbol)) {
    diffs.push(`symbol chain ${chain.symbol} list ${listed.symbol}`)
  }
  if (chain.name !== null && !sameText(chain.name, listed.name)) {
    diffs.push(`name chain ${chain.name} list ${listed.name}`)
  }
  if (chain.decimals !== null && chain.decimals !== listed.decimals) {
    diffs.push(`decimals chain ${chain.decimals} list ${listed.decimals}`)
  }

  let listStatus: CheckStatus = "pass"
  let listDetail = `matches list ${listed.symbol}/${listed.decimals}`
  if (!readable) {
    listStatus = "fail"
    listDetail = `could not read metadata to compare with ${listed.symbol}`
  } else if (diffs.length > 0) {
    listStatus = "mismatch"
    listDetail = diffs.join("; ")
  }

  let proxyStatus: CheckStatus = "absent"
  let proxyDetail = "EIP-1967 implementation slot is empty"
  if (implementation && implementationHasCode) {
    proxyStatus = "pass"
    proxyDetail = `implementation ${implementation}`
  } else if (implementation && !implementationHasCode) {
    proxyStatus = "fail"
    proxyDetail = `implementation ${implementation} has no code`
  }

  return [
    {
      check: "erc20",
      status: readable ? "pass" : "fail",
      implementation: ZERO_ADDRESS,
      symbol,
      name,
      decimals,
      detail: erc20Detail || "metadata call failed",
    },
    {
      check: "list-match",
      status: listStatus,
      implementation: ZERO_ADDRESS,
      symbol,
      name,
      decimals,
      detail: listDetail,
    },
    {
      check: "eip1967",
      status: proxyStatus,
      implementation: implementation ?? ZERO_ADDRESS,
      symbol,
      name,
      decimals,
      detail: proxyDetail,
    },
  ]
}
