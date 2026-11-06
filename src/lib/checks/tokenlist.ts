import { getAddress, isAddress } from "viem"
import { PINNED_MAINNET, TOKEN_LIST_URL } from "../../config"
import type { ListedToken } from "../../types/check"

type RawToken = {
  chainId: number
  address: string
  name: string
  symbol: string
  decimals: number
}

type RawList = { tokens: RawToken[] }

export async function loadMainnetTokens(limit: number): Promise<ListedToken[]> {
  const response = await fetch(TOKEN_LIST_URL)
  if (!response.ok) {
    throw new Error(`Token list request failed: ${response.status} ${TOKEN_LIST_URL}`)
  }
  const list = (await response.json()) as RawList
  const byAddress = new Map<string, ListedToken>()

  for (const token of list.tokens) {
    if (token.chainId !== 1 || !isAddress(token.address, { strict: false })) continue
    const address = getAddress(token.address)
    byAddress.set(address.toLowerCase(), {
      chainId: 1,
      address,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
    })
  }

  const pinned: ListedToken[] = []
  for (const address of PINNED_MAINNET) {
    const token = byAddress.get(address.toLowerCase())
    if (token) pinned.push(token)
  }
  const pinnedSet = new Set(pinned.map((token) => token.address.toLowerCase()))
  const rest = [...byAddress.values()]
    .filter((token) => !pinnedSet.has(token.address.toLowerCase()))
    .sort((a, b) => a.symbol.localeCompare(b.symbol) || a.address.localeCompare(b.address))

  return [...pinned, ...rest].slice(0, Math.max(limit, pinned.length))
}
