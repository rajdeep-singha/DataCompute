import { Link } from "react-router-dom"
import { WATCHLIST } from "../config"
import { DashboardIcon } from "./dashboard/DashboardIcon"
import { StatCard } from "./dashboard/StatCard"
import { DASHBOARD_NAV } from "./dashboard/navigation"
import { AsciiArtwork } from "./ui/AsciiArtwork"

export function Landing() {
  return <div className="dashboard-overview"><section className="overview-heading"><div><p className="dashboard-eyebrow">YOUR VERIFICATION WORKSPACE</p><h1>A clearer view of trust.</h1><p>Watch the changes. Check the code. Follow the evidence.</p></div><Link to="/alerts" className="overview-primary">View upgrade alerts <span>↗</span></Link></section>
    <section className="dashboard-stats" aria-label="Workspace scope"><StatCard label="Watched proxies" value={WATCHLIST.length} detail="Configured Ethereum watchlist" icon={<DashboardIcon name="alerts" />} /><StatCard label="Verification source" value="Sourcify" detail="Source code verification" icon={<DashboardIcon name="checks" />} /><StatCard label="Record lifetime" value={<>30 <small>days</small></>} detail="Expiring public alert records" icon={<DashboardIcon name="docs" />} /></section>
    <section className="overview-tools"><div className="section-heading"><h2>Make your next check.</h2><span>THE TOOLKIT</span></div><div className="tool-grid">{DASHBOARD_NAV.slice(1, 5).map(item => <Link to={item.to} className="tool-card" key={item.to}><span className={`tool-icon icon-${item.icon}`}><DashboardIcon name={item.icon} /></span><span className="tool-arrow">↗</span><h3>{item.label}</h3><p>{item.description}.</p><span className="tool-open">Open workspace →</span></Link>)}</div></section>
    <section className="overview-bottom"><article className="watchlist-card"><div className="section-heading"><h2>On the watchlist</h2><span>ETHEREUM</span></div><p>Contracts configured for implementation monitoring.</p><div className="watchlist-items">{WATCHLIST.map(item => <a href={`https://etherscan.io/address/${item.address}`} target="_blank" rel="noreferrer" key={item.address}><span className="contract-avatar">{item.name.slice(0, 1)}</span><div><strong>{item.name}</strong><small>{item.address.slice(0, 8)}…{item.address.slice(-6)}</small></div><span>↗</span></a>)}</div></article><article className="trust-note"><AsciiArtwork type="record" className="trust-artwork" /><p className="dashboard-eyebrow">THE PUBLIC RECORD</p><h2>Don’t just take<br />our word for it.</h2><p>Alerts are signed and stored on Arkiv, with supporting evidence pinned to Swarm. You can inspect the record yourself.</p><Link to="/docs">Understand the trust layer ↗</Link></article></section>
  </div>
}
