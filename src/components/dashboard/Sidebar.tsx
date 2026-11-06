import { Link, NavLink } from "react-router-dom"
import { Brand } from "../ui/Brand"
import { DashboardIcon } from "./DashboardIcon"
import { DASHBOARD_NAV } from "./navigation"

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <>
    {open && <button className="sidebar-backdrop" aria-label="Close sidebar" onClick={onClose} />}
    <aside className={`dashboard-sidebar ${open ? "is-open" : ""}`} id="dashboard-sidebar" aria-label="Dashboard sidebar">
      <div className="sidebar-brand"><Brand /><button className="sidebar-close" onClick={onClose} aria-label="Close sidebar">×</button></div>
      <div className="workspace-label"><span className="workspace-avatar">D</span><div>DataVerify workspace<small>Public explorer</small></div><span className="workspace-status" title="Ethereum" /></div>
      <p className="sidebar-section-label">WORKSPACE</p>
      <nav aria-label="Dashboard navigation">{DASHBOARD_NAV.slice(0, 5).map(item => <NavLink key={item.to} to={item.to} onClick={onClose}><DashboardIcon name={item.icon} /><span>{item.label}</span>{item.to === "/alerts" && <span className="nav-dot" />}</NavLink>)}</nav>
      <div className="sidebar-bottom"><Link to="/docs" onClick={onClose}><DashboardIcon name="docs" />Documentation <span className="sidebar-arrow">↗</span></Link><div className="sidebar-note"><span>Proof, over promises.</span><p>Public records and verifiable evidence. Powered by Arkiv.</p><a href="https://rabdi.explorer.arkiv.network" target="_blank" rel="noreferrer">Open explorer ↗</a></div><Link to="/" className="back-to-site">← Back to website</Link></div>
    </aside>
  </>
}
