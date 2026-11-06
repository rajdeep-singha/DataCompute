import { ConnectButton } from "@rainbow-me/rainbowkit"
import { NotifyBell } from "../alerts/NotifyBell"
import { DashboardIcon } from "./DashboardIcon"
import { DASHBOARD_NAV } from "./navigation"

export function DashboardHeader({ pathname, menuOpen, onMenuToggle }: { pathname: string; menuOpen: boolean; onMenuToggle: () => void }) {
  const current = DASHBOARD_NAV.find(item => item.to === pathname) ?? DASHBOARD_NAV[0]
  return <header className="dashboard-header"><div className="dashboard-breadcrumb"><button className="dashboard-menu" aria-label="Toggle sidebar" aria-controls="dashboard-sidebar" aria-expanded={menuOpen} onClick={onMenuToggle}><DashboardIcon name="menu" /></button><span className="breadcrumb-workspace">Workspace <span>/</span></span><span>{current.label}</span></div><div className="dashboard-header-actions"><span className="network-badge"><i />Ethereum</span><NotifyBell />{pathname === "/marketplace" && <ConnectButton accountStatus={{ smallScreen: "avatar", largeScreen: "full" }} chainStatus="icon" showBalance={false} />}</div></header>
}
