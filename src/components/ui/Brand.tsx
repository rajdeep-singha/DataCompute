import { Link } from "react-router-dom"

export function BrandMark({ className = "" }: { className?: string }) {
  return <svg className={className} width="36" height="40" viewBox="0 0 48 52" fill="none" aria-hidden="true"><path d="M24 3 43 10v15c0 12-19 24-19 24S5 37 5 25V10L24 3Z" fill="#c9daaf" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/><path d="m15 25 6 6 12-14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

export function Brand() {
  return <Link to="/" className="dv-brand"><BrandMark /><span>Tracer<span className="brand-dot">.</span></span></Link>
}
