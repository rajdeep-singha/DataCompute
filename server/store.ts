import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Gated listing payloads, kept off Arkiv because anything written there is public.
 * A flat JSON file is enough for the demo; the key is the listing's Arkiv entity key.
 */
const FILE = join(dirname(fileURLToPath(import.meta.url)), "payloads.json")

type Store = Record<string, string>

async function read(): Promise<Store> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Store
  } catch {
    return {}
  }
}

async function write(store: Store): Promise<void> {
  await mkdir(dirname(FILE), { recursive: true })
  await writeFile(FILE, JSON.stringify(store, null, 2))
}

export async function savePayload(listingKey: string, payload: string): Promise<void> {
  const store = await read()
  store[listingKey] = payload
  await write(store)
}

export async function getPayload(listingKey: string): Promise<string | undefined> {
  const store = await read()
  return store[listingKey]
}
