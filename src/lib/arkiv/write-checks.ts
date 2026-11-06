import {
  createPublicClient,
  createWalletClient,
  ExpirationTime,
  InvalidExpiryError,
} from "@arkiv-network/sdk"
import { rabdi } from "@arkiv-network/sdk/chains"
import { asc, eq, gt } from "@arkiv-network/sdk/query"
import { addr, key, u64 } from "@arkiv-network/sdk/schema"
import { http, type Address, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { CHECK_LIFETIME_DAYS } from "../../config"
import { fitStr } from "../util/fit-str"
import { Checks } from "../../schema"
import type { CheckDraft } from "../../types/check"

/** The testnet RPC stalls for several seconds at a time; back off instead of failing a write. */
function arkivTransport() {
  return http(undefined, { timeout: 20_000, retryCount: 5, retryDelay: 1_000 })
}

export function arkivPublic() {
  return createPublicClient({
    chain: rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" }),
    transport: arkivTransport(),
  })
}

export function arkivClients() {
  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey || privateKey === "0x" || !privateKey.startsWith("0x")) {
    throw new Error(
      "Set PRIVATE_KEY in .env, then fund that address at https://hub.arkiv.network/faucet",
    )
  }
  const account = privateKeyToAccount(privateKey as Hex)
  const chain = rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" })
  const transport = arkivTransport()
  return {
    account,
    publicClient: createPublicClient({ chain, transport }),
    walletClient: createWalletClient({ chain, transport, account }),
  }
}

export function columnValues(chainId: bigint, subject: Address, block: bigint, draft: CheckDraft) {
  return {
    chainId: u64(chainId),
    subject: addr(subject),
    check: draft.check,
    status: draft.status,
    block: u64(block),
    implementation: addr(draft.implementation),
    symbol: fitStr(draft.symbol),
    name: fitStr(draft.name),
    decimals: draft.decimals,
    detail: fitStr(draft.detail),
  }
}

export async function loadOwned(client: ReturnType<typeof arkivClients>["publicClient"], owner: Address) {
  const found = new Map<string, { entityKey: Hex; expiresAt: bigint }>()
  let lastKey: Hex | undefined
  for (;;) {
    let query = client
      .select({ $key: true, $expiresAt: true, subject: true, check: true })
      .from(Checks)
      .ownedBy(owner)
      .orderBy(asc("$key"))
      .limit(100)
    if (lastKey) query = query.where(gt("$key", key(lastKey)))
    const page = await query.fetch()
    for (const row of page.entities) {
      found.set(`${row.subject.value.toLowerCase()}:${row.check.value}`, {
        entityKey: row.$key,
        expiresAt: row.$expiresAt,
      })
    }
    if (page.entities.length < 100) break
    lastKey = page.entities.at(-1)?.$key
  }
  return found
}

const BATCH = 8

export async function writeChecks(
  clients: ReturnType<typeof arkivClients>,
  rows: Array<{ subject: Address; draft: CheckDraft; chainId: bigint; block: bigint }>,
) {
  const existing = await loadOwned(clients.publicClient, clients.account.address)
  const expiration = ExpirationTime.fromDays(CHECK_LIFETIME_DAYS)
  const creates: Array<{
    schema: typeof Checks
    values: ReturnType<typeof columnValues>
    expiration: ReturnType<typeof ExpirationTime.fromDays>
  }> = []
  const patches: Array<{
    schema: typeof Checks
    entityKey: Hex
    set: ReturnType<typeof columnValues>
  }> = []
  const extendKeys: Hex[] = []

  for (const row of rows) {
    const values = columnValues(row.chainId, row.subject, row.block, row.draft)
    const id = `${row.subject.toLowerCase()}:${row.draft.check}`
    const prior = existing.get(id)
    if (!prior) {
      creates.push({ schema: Checks, values, expiration })
      continue
    }
    patches.push({ schema: Checks, entityKey: prior.entityKey, set: values })
    extendKeys.push(prior.entityKey)
  }

  for (let index = 0; index < creates.length; index += BATCH) {
    const slice = creates.slice(index, index + BATCH)
    const result = await clients.walletClient.executeBatch({ creates: slice })
    console.log(`created ${slice.length} checks in ${result.txHash}`)
  }
  for (let index = 0; index < patches.length; index += BATCH) {
    const slice = patches.slice(index, index + BATCH)
    const result = await clients.walletClient.executeBatch({ patches: slice })
    console.log(`patched ${slice.length} checks in ${result.txHash}`)
  }
  for (const entityKey of extendKeys) {
    try {
      await clients.walletClient.extendEntity({ entityKey, expiration })
    } catch (error) {
      if (error instanceof InvalidExpiryError) continue
      throw error
    }
  }
}

export async function readMismatchSample(client: ReturnType<typeof arkivClients>["publicClient"], owner: Address) {
  const page = await client
    .select({
      $key: true,
      subject: true,
      symbol: true,
      status: true,
      check: true,
      detail: true,
      block: true,
    })
    .from(Checks)
    .ownedBy(owner)
    .where(eq("status", "mismatch"))
    .limit(20)
    .fetch()
  return page
}
