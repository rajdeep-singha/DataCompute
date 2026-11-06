import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { WagmiProvider } from "wagmi"
import { App } from "./components/App"
import { wagmiConfig } from "./lib/wagmi"
import "@rainbow-me/rainbowkit/styles.css"
import "./index.css"

const root = document.getElementById("root")
if (!root) throw new Error("Missing #root")

const queryClient = new QueryClient()

createRoot(root).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={lightTheme({
            accentColor: "#111111",
            accentColorForeground: "#fffdf7",
            borderRadius: "large",
          })}
        >
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
