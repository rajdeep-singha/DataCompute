import { mkdir, readFile, writeFile } from "node:fs/promises"
import type { DiamondManifest } from "../../types/diamond"

const DIR = new URL("./manifests/", import.meta.url)

/** The pinned manifest is a reviewed file in the repo, never written by the web server. */
export async function readManifest(diamondId: string): Promise<DiamondManifest | null> {
  try {
    return JSON.parse(await readFile(new URL(`${diamondId}.json`, DIR), "utf8")) as DiamondManifest
  } catch {
    return null
  }
}

export async function writeManifest(diamondId: string, manifest: DiamondManifest): Promise<string> {
  await mkdir(DIR, { recursive: true })
  const file = new URL(`${diamondId}.json`, DIR)
  await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`)
  return file.pathname
}
