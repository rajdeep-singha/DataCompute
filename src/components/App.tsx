import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useState } from "react"
import { AlertsViewer } from "./alerts/AlertsViewer"
import { ChecksViewer } from "./checks/ChecksViewer"
import { DiamondViewer } from "./diamond/DiamondViewer"
import { Docs } from "./Docs"
import { Landing } from "./Landing"
import { Marketplace } from "./marketplace/Marketplace"
import { NotifyBell } from "./alerts/NotifyBell"

const TABS = [
  { id: "home", label: "Home" },
  { id: "alerts", label: "Upgrade alerts" },
  { id: "diamond", label: "Diamond check" },
  { id: "marketplace", label: "Marketplace" },
  { id: "checks", label: "Verified checks" },
  { id: "docs", label: "Docs" },
] as const

type Tab = (typeof TABS)[number]["id"]

export function App() {
  const [tab, setTab] = useState<Tab>("home")

  return (
    <main className="mx-auto w-[min(1180px,calc(100%-2rem))] py-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setTab("home")}
          className="font-serif text-2xl tracking-tight"
        >
          DataVerify
        </button>

        <nav className="order-last flex w-full flex-wrap gap-2 sm:order-0 sm:w-auto">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                tab === item.id
                  ? "border-accent bg-accent font-semibold text-ink"
                  : "border-line text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <NotifyBell />
          {tab === "marketplace" ? (
            <ConnectButton />
          ) : (
            <span className="hidden rounded-full border border-line px-3 py-1.5 font-mono text-[11px] text-zinc-500 sm:inline">
              Build on Arkiv · ETHweek
            </span>
          )}
        </div>
      </header>

      {tab === "home" ? (
        <Landing onNavigate={setTab} />
      ) : tab === "alerts" ? (
        <AlertsViewer />
      ) : tab === "diamond" ? (
        <DiamondViewer />
      ) : tab === "marketplace" ? (
        <Marketplace />
      ) : tab === "checks" ? (
        <ChecksViewer />
      ) : (
        <Docs />
      )}
    </main>
  )
}
