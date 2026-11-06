import { Link } from "react-router-dom"
import { useState } from "react"
import { Brand, BrandMark } from "./ui/Brand"
import { AsciiArtwork } from "./ui/AsciiArtwork"
import "../intro.css"

const FEATURES = [
  { n: "01", title: "Catch the change.", text: "Watch Ethereum proxy implementation slots. Know when the code behind a contract changes.", to: "/alerts", label: "Explore alerts", artwork: "shield" as const },
  { n: "02", title: "Check every facet.", text: "Compare diamond contracts against a pinned manifest. Find changed facets, new code, and ownership changes.", to: "/diamond", label: "Inspect diamonds", artwork: "blocks" as const },
  { n: "03", title: "Follow the proof.", text: "Query signed, expiring records on Arkiv. Trace the evidence, or discover attested real-world data in the marketplace.", to: "/checks", label: "Explore checks", artwork: "record" as const },
]
const FAQ = [
  ["What does DataVerify watch?", "Ethereum proxy upgrades, diamond contract changes, and token verification checks. Open the dashboard to explore each tool."],
  ["How is an upgrade verified?", "The watcher reads the implementation slot and checks the new implementation with Sourcify. A change to unverified code is flagged as critical."],
  ["Where does the evidence live?", "Alerts are signed, public Arkiv entities that expire in 30 days. Supporting evidence is pinned to Swarm."],
  ["Do I need to connect a wallet?", "You can browse alerts and checks without a wallet. Connect your wallet in the marketplace when you want to interact with data listings."],
]

export function Intro() {
  const [menuOpen, setMenuOpen] = useState(false)
  return <div className="dv-landing">
    <section className="landing-hero">
      <div className="ascii-crowd" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <AsciiArtwork key={i} type={i % 3 === 0 ? "shield" : i % 3 === 1 ? "blocks" : "network"} />)}</div>
      <header className="landing-nav"><Brand /><nav aria-label="Main navigation"><a href="#story">How it works</a><Link to="/marketplace">Marketplace</Link><Link to="/docs">Docs</Link></nav><Link className="dv-button small" to="/home">Open dashboard <span aria-hidden="true">↗</span></Link><button className="landing-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation" aria-expanded={menuOpen}>☰</button></header>
      {menuOpen && <nav className="landing-mobile-nav" aria-label="Mobile navigation"><a href="#story" onClick={() => setMenuOpen(false)}>How it works</a><Link to="/marketplace">Marketplace</Link><Link to="/docs">Documentation</Link></nav>}
      <div className="landing-hero-card"><BrandMark className="hero-mark" /><p className="eyebrow">A LITTLE TRUST. A LOT OF PROOF.</p><h1>The contracts you trust.<br />The proof you deserve.</h1><p className="hero-description">Code changes. Trust shouldn’t be a guessing game.<br className="desktop-break" /> Watch upgrades, verify the source, and follow the evidence.<br className="desktop-break" /> All in one place. All on the record.</p><div className="hero-buttons"><Link to="/home" className="dv-button">Open dashboard <span aria-hidden="true">↗</span></Link><a href="#story" className="dv-button outline"><span aria-hidden="true">↓</span> See how it works</a></div><p className="hero-note">Public records. Verifiable evidence. Powered by <a href="https://arkiv.network" target="_blank" rel="noreferrer">Arkiv</a>.</p></div>
      <a href="#story" className="learn-more">A closer look <span aria-hidden="true">↓</span></a>
    </section>
    <main id="story" className="landing-story"><section className="story-intro"><p className="eyebrow">MEET DATAVERIFY</p><h2>Trust the contract.<br />Verify the <span className="serif-emphasis">change.</span><span className="inline-check" aria-hidden="true">✓</span></h2><p>Behind every upgrade is a new piece of code.<br />We make sure it doesn’t go unnoticed.</p><AsciiArtwork type="network" className="story-artwork" /></section>
      <section className="landing-features" aria-label="How it works">{FEATURES.map(feature => <article className="landing-feature" key={feature.n}><div><p className="eyebrow">{feature.n} / THE TRUST LAYER</p><h3>{feature.title}</h3><p>{feature.text}</p><Link to={feature.to} className="text-link">{feature.label} <span aria-hidden="true">↗</span></Link></div><div className={`feature-visual visual-${feature.n}`}><AsciiArtwork type={feature.artwork} /><div className="proof-slip"><span className="proof-dot" />{feature.n === "01" ? "Implementation changed" : feature.n === "02" ? "Manifest comparison" : "Evidence on the record"}<small>{feature.n === "01" ? "Ethereum → Sourcify → Arkiv" : feature.n === "02" ? "Every chain. Every facet." : "Signed. Public. Queryable."}</small><span className="slip-check">✓</span></div></div></article>)}</section>
      <section className="watch-band"><p className="eyebrow">BUILT FOR THE CONTRACTS YOU KNOW</p><div><span>Ethereum</span><span>USDC</span><span>Aave V3</span><span>LI.FI</span><span>Arkiv</span><span>Swarm</span></div></section>
      <section className="landing-faq"><div><p className="eyebrow">QUESTIONS</p><h2>Fair questions.</h2><p>Let’s clear a few things up.</p></div><div>{FAQ.map(([question, answer], i) => <details key={question}><summary><span>0{i + 1}</span>{question}<b aria-hidden="true">+</b></summary><p>{answer}</p></details>)}</div></section>
      <section className="landing-cta"><BrandMark /><h2>A little less blind trust.<br />A little more certainty.</h2><p>Your next contract check starts here.</p><Link className="dv-button" to="/home">Explore the dashboard <span aria-hidden="true">↗</span></Link></section>
    </main><footer className="landing-footer"><div><Brand /><p>Trust, with a public record.</p></div><nav aria-label="Footer"><Link to="/alerts">Live alerts</Link><Link to="/marketplace">Marketplace</Link><Link to="/docs">Documentation</Link></nav><small>© {new Date().getFullYear()} DataVerify · Built at ETHweek</small></footer>
  </div>
}
