import { useEffect, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { Sidebar } from "./dashboard/Sidebar"
import { DashboardHeader } from "./dashboard/DashboardHeader"
import "../dashboard.css"

export function Layout() {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => { setMenuOpen(false); window.scrollTo(0, 0) }, [pathname])
  useEffect(() => {
    if (!menuOpen) return
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false) }
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", close)
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close) }
  }, [menuOpen])
  return <div className="shell dashboard-shell"><a className="skip-to-content" href="#dashboard-content">Skip to content</a><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><div className="dashboard-body"><DashboardHeader pathname={pathname} menuOpen={menuOpen} onMenuToggle={() => setMenuOpen(value => !value)} /><main className="shell-main dashboard-main" id="dashboard-content"><Outlet /></main><footer className="dashboard-footer"><span>Tracer · Public verification workspace</span><span>Evidence on Arkiv ↗</span></footer></div></div>
}
