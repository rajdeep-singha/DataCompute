import { getAddress, isAddress } from "viem"
import { ZERO_ADDRESS } from "../../config"

/** The wallet whose entities the pages trust; reads are scoped to it with `ownedBy`. */
export function watcherAddress(): string {
  const raw = import.meta.env.VITE_WATCHER_ADDRESS ?? import.meta.env.VITE_VERIFIER_ADDRESS ?? ""
  return isAddress(raw) ? getAddress(raw) : ZERO_ADDRESS
}
