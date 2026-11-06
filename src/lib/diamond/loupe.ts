import { createPublicClient, getAddress, http, keccak256, parseAbi, type Address } from "viem"
import { diamondChain } from "../../config"
import type { DiamondSnapshot } from "../../types/diamond"

const loupeAbi = parseAbi([
  "function facets() view returns ((address facetAddress, bytes4[] functionSelectors)[])",
  "function owner() view returns (address)",
])

/**
 * A read-only client for one chain. `RPC_<chainId>` in .env overrides the public RPC;
 * `archive` picks an RPC that still serves old state, for reads at past blocks.
 */
export function chainClient(chainId: number, archive = false) {
  const chain = diamondChain(chainId)
  if (!chain) throw new Error(`chain ${chainId} is not configured in DIAMOND_CHAINS`)
  const url = archive
    ? process.env[`ARCHIVE_RPC_${chainId}`] || chain.archiveRpc
    : process.env[`RPC_${chainId}`] || chain.rpc
  return createPublicClient({
    transport: http(url, { timeout: 20_000, retryCount: 2, batch: !archive }),
  })
}

/** The last block at or before `days` ago, found by binary search on block timestamps. */
export async function blockDaysAgo(chainId: number, days: number): Promise<bigint> {
  const client = chainClient(chainId, true)
  const head = await client.getBlock()
  const target = head.timestamp - BigInt(Math.round(days * 86_400))
  let low = 1n
  let high = head.number
  while (low < high) {
    const mid = (low + high + 1n) / 2n
    const block = await client.getBlock({ blockNumber: mid })
    if (block.timestamp <= target) low = mid
    else high = mid - 1n
  }
  return low
}

/** Reads the diamond's facets (EIP-2535 loupe), owner (ERC-173) and each facet's code hash at one block. */
export async function readDiamond(chainId: number, address: Address, atBlock?: bigint): Promise<DiamondSnapshot> {
  const client = chainClient(chainId, atBlock !== undefined)
  const blockNumber = atBlock ?? (await client.getBlockNumber())
  const [facets, owner] = await Promise.all([
    client.readContract({ address, abi: loupeAbi, functionName: "facets", blockNumber }),
    client
      .readContract({ address, abi: loupeAbi, functionName: "owner", blockNumber })
      .catch(() => null),
  ])
  const snapshots = await Promise.all(
    facets.map(async (facet) => {
      const code = await client.getCode({ address: facet.facetAddress, blockNumber })
      return {
        address: getAddress(facet.facetAddress),
        codehash: keccak256(code ?? "0x"),
        selectors: [...facet.functionSelectors],
      }
    }),
  )
  return {
    owner: owner ? getAddress(owner) : null,
    block: blockNumber.toString(),
    facets: snapshots,
  }
}
