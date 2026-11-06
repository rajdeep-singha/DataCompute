import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import type { TelegramStatus } from "../../types/telegram"
import { DashboardIcon } from "../dashboard/DashboardIcon"
import "./telegram.css"

async function readStatus(): Promise<TelegramStatus> {
  const response = await fetch("/api/telegram/status", { signal: AbortSignal.timeout(7000) })
  if (!response.ok) throw new Error("Could not reach the notification server.")
  return response.json() as Promise<TelegramStatus>
}

export function TelegramSettings() {
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["telegram-status"], queryFn: readStatus, refetchInterval: 30_000, retry: false,
  })
  const ready = data?.botVerified && data.destinationConfigured
  const label = isError ? "Server unavailable" : isPending ? "Checking connection…" : ready ? "Ready to test" : data?.tokenConfigured && !data.botVerified ? "Bot not verified" : "Setup needed"

  return <div className="telegram-page">
    <section className="overview-heading">
      <div><p className="dashboard-eyebrow">STAY INFORMED</p><h1>Your alerts, in Telegram.</h1><p>Follow contract changes and flagged findings, even after you close this tab.</p></div>
    </section>
    <div className="telegram-columns">
      <section className="telegram-card" aria-labelledby="telegram-connection-title">
        <div className="telegram-card-heading"><span className="telegram-icon"><DashboardIcon name="telegram" /></span><span className={`telegram-status ${ready && !isError ? "is-ready" : ""}`} role="status">{label}</span></div>
        <h2 id="telegram-connection-title">{data?.botName || "Workspace alert bot"}</h2>
        <p>One bot delivers alerts to this workspace’s configured Telegram chat. Opening the bot does not subscribe your personal account.</p>
        {isError ? <div className="telegram-notice" role="alert">Connection status is unavailable. Start or reconnect the backend, then refresh.</div> : null}
        {data?.tokenConfigured && !data.botVerified && !isError ? <div className="telegram-notice">Telegram could not verify the bot. Check its token or the server’s network connection.</div> : null}
        <dl className="telegram-checklist">
          <div><dt>Bot account</dt><dd>{isError || !data ? "Unknown" : data.botVerified ? "Verified with Telegram" : data.tokenConfigured ? "Needs verification" : "Not configured"}</dd></div>
          <div><dt>Alert destination</dt><dd>{isError || !data ? "Unknown" : data.destinationConfigured ? "Configured" : "Not configured"}</dd></div>
          <div><dt>Automatic checks</dt><dd>{isError || !data ? "Unknown" : data.monitoringEnabled ? `${data.intervalSeconds}s between cycles` : "Manual checks only"}</dd></div>
        </dl>
        <div className="telegram-actions">
          {data?.botUrl && !isError ? <a className="overview-primary" href={data.botUrl} target="_blank" rel="noreferrer">Open bot in Telegram <span aria-hidden="true">↗</span></a> : <a className="overview-primary" href="https://t.me/BotFather" target="_blank" rel="noreferrer">Set up a bot <span aria-hidden="true">↗</span></a>}
          <button className="telegram-secondary" type="button" disabled={isFetching} onClick={() => void refetch()}>{isFetching ? "Checking…" : "Refresh status"}</button>
        </div>
        <p className="telegram-caption">{ready ? "Configuration is present. Run a simulation to confirm that messages reach the intended chat." : "A workspace operator completes the setup below. Your wallet is not needed."}</p>
      </section>
      <aside className="telegram-preview" aria-labelledby="telegram-preview-title">
        <p className="dashboard-eyebrow" id="telegram-preview-title">EXAMPLE NOTIFICATION</p>
        <div className="telegram-message">
          <span className="telegram-message-name">DataVerify</span>
          <strong>🧪 SIMULATION — Diamond finding</strong>
          <p>LI.FI Diamond · Polygon<br /><b>CRITICAL</b></p>
          <p>Unexpected function added:<br /><code>emergencyWithdraw(address,uint256)</code></p>
          <p>New facet is unverified on Sourcify.</p>
          <span className="telegram-message-link">Contract details · Dashboard ↗</span>
        </div>
        <p className="telegram-caption">Illustrative preview. Simulated findings are labeled; verification status is a risk signal, not proof of an attack.</p>
      </aside>
    </div>
    <section className="telegram-card telegram-setup" aria-labelledby="telegram-setup-title">
      <div className="section-heading"><h2 id="telegram-setup-title">Connect your workspace</h2><span>ONE-TIME SETUP</span></div>
      <ol className="telegram-steps">
        <li><span>01</span><div><h3>Create your bot</h3><p>Open <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather ↗</a> in Telegram and send <code>/newbot</code>. Keep the token private.</p></div></li>
        <li><span>02</span><div><h3>Choose the destination</h3><p>Send <code>/start</code> to your new bot. The workspace operator then configures the bot token and the intended chat on the server.</p></div></li>
        <li><span>03</span><div><h3>Confirm your first alert</h3><p>Refresh the status above, then run a labeled simulation. Confirm the message arrives in the intended Telegram chat.</p><Link to="/diamond" className="telegram-inline-link">Open attack simulation →</Link><Link to="/alerts" className="telegram-inline-link">Open proxy upgrades →</Link></div></li>
      </ol>
      <details className="telegram-operator"><summary>Setup instructions for the workspace operator</summary>
        <div><p>Add the bot token to the server’s <code>.env</code>. After sending <code>/start</code> to the bot, run <code>npm run telegram -- chats</code> to find the destination chat ID.</p>
          <pre><code>{"TELEGRAM_BOT_TOKEN=your_bot_token\nTELEGRAM_CHAT_ID=your_destination_chat_id\nPUBLIC_APP_URL=https://your-dashboard.example"}</code></pre>
          <p>Restart the backend with <code>npm run server</code> for manual checks, or <code>npm run monitor</code> for continuous checks. Run only one backend process. Keep the token on the server; never add it to frontend variables.</p>
          <p>For a group destination, add the bot and allow it to post. This page verifies the bot account; successful delivery must be confirmed in the destination chat.</p>
        </div>
      </details>
    </section>
    <p className="telegram-footnote">Messages cover proxy upgrades and diamond findings, with retries and duplicate suppression. Delivery time depends on the monitoring cadence, checks, and Telegram.</p>
  </div>
}
