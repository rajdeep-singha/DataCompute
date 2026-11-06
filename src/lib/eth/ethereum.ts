import {
  createPublicClient,
  decodeAbiParameters,
  getAddress,
  hexToString,
  http,
  isAddressEqual,
  type Address,
  type Hex,
} from "viem"
import { mainnet } from "viem/chains"
import { EIP1967_IMPLEMENTATION_SLOT, LEGACY_IMPLEMENTATION_SLOT } from "../../config"
import type { ChainMetadata } from "../../types/check"

const decimalsAbi = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const

const SELECTORS = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
} as const

export function ethereumClient() {
  return createPublicClient({
    chain: mainnet,
    transport: http(process.env.ETH_RPC_URL || "https://ethereum.publicnode.com"),
  })
}

function bytes32ToText(word: Hex): string | null {
  const text = hexToString(word, { size: 32 }).replace(/\u0000/g, "").trim()
  if (!text) return null
  if ([...text].some((char) => char.charCodeAt(0) < 32)) return null
  return text
}

function decodeReturnedString(data: Hex): string | null {
  if (data === "0x" || data.length < 2 + 64) return null
  try {
    const [asString] = decodeAbiParameters([{ type: "string" }], data)
    const text = asString.trim()
    if (text) return text
  } catch {
    // Older tokens such as USDT return a bytes32 instead of a string.
  }
  if (data.length === 2 + 64) return bytes32ToText(data)
  return null
}

async function readStringField(
  client: ReturnType<typeof ethereumClient>,
  address: Address,
  field: "name" | "symbol",
): Promise<{ value: string | null; error: string | null }> {
  try {
    const data = await client.call({ to: address, data: SELECTORS[field] })
    const text = data.data ? decodeReturnedString(data.data) : null
    if (text) return { value: text, error: null }
    return { value: null, error: `${field}() returned nothing` }
  } catch {
    return { value: null, error: `${field}() reverted` }
  }
}

async function readDecimals(
  client: ReturnType<typeof ethereumClient>,
  address: Address,
): Promise<{ value: number | null; error: string | null }> {
  try {
    const value = await client.readContract({
      address,
      abi: decimalsAbi,
      functionName: "decimals",
    })
    return { value, error: null }
  } catch {
    try {
      const data = await client.call({ to: address, data: SELECTORS.decimals })
      if (!data.data || data.data === "0x") {
        return { value: null, error: "decimals() returned nothing" }
      }
      const [wide] = decodeAbiParameters([{ type: "uint256" }], data.data)
      if (wide > 255n) return { value: null, error: "decimals() out of range" }
      return { value: Number(wide), error: null }
    } catch {
      return { value: null, error: "decimals() reverted" }
    }
  }
}

export async function readMetadata(
  client: ReturnType<typeof ethereumClient>,
  address: Address,
): Promise<ChainMetadata> {
  const [name, symbol, decimals] = await Promise.all([
    readStringField(client, address, "name"),
    readStringField(client, address, "symbol"),
    readDecimals(client, address),
  ])
  return {
    name: name.value,
    symbol: symbol.value,
    decimals: decimals.value,
    nameError: name.error,
    symbolError: symbol.error,
    decimalsError: decimals.error,
  }
}

function slotToAddress(slot: Hex | undefined): Address | null {
  if (!slot || slot === `0x${"0".repeat(64)}`) return null
  const implementation = getAddress(`0x${slot.slice(-40)}`)
  if (isAddressEqual(implementation, "0x0000000000000000000000000000000000000000")) return null
  return implementation
}

export async function readImplementation(
  client: ReturnType<typeof ethereumClient>,
  address: Address,
): Promise<{ implementation: Address | null; hasCode: boolean }> {
  const slot = await client.getStorageAt({
    address,
    slot: EIP1967_IMPLEMENTATION_SLOT,
  })
  const implementation = slotToAddress(slot)
  if (!implementation) return { implementation: null, hasCode: false }
  const code = await client.getCode({ address: implementation })
  return { implementation, hasCode: Boolean(code && code !== "0x") }
}

/**
 * Reads a proxy's current implementation, trying the EIP-1967 slot first and
 * falling back to the legacy OpenZeppelin slot that older proxies like USDC use.
 * Returns which slot pattern matched, so an alert can record how it was found.
 */
export async function readProxyImplementation(
  client: ReturnType<typeof ethereumClient>,
  address: Address,
): Promise<{ implementation: Address | null; slot: "eip1967" | "legacy" | null }> {
  const eip1967 = slotToAddress(
    await client.getStorageAt({ address, slot: EIP1967_IMPLEMENTATION_SLOT }),
  )
  if (eip1967) return { implementation: eip1967, slot: "eip1967" }

  const legacy = slotToAddress(
    await client.getStorageAt({ address, slot: LEGACY_IMPLEMENTATION_SLOT }),
  )
  if (legacy) return { implementation: legacy, slot: "legacy" }

  return { implementation: null, slot: null }
}
