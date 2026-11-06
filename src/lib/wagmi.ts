import { rabdi } from "@arkiv-network/sdk/chains"
import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { http } from "wagmi"

/**
 * Rabdi, the chain everything lives on: Arkiv entities, and the tGLM payments
 * buyers send. The SDK's `rabdi()` already returns a viem chain with the access
 * key baked into its RPC URL, so wagmi and the connected wallet reuse it as-is.
 */
export const rabdiChain = rabdi({ accessKey: import.meta.env.VITE_ARKIV_ACCESS_KEY ?? "" })

/** WalletConnect needs a project id; MetaMask/injected works without a real one. */
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "dataverify-local"

export const wagmiConfig = getDefaultConfig({
  appName: "DataVerify",
  projectId,
  chains: [rabdiChain],
  transports: { [rabdiChain.id]: http() },
  ssr: false,
})
