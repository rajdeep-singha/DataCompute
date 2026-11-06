import { randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"

export type Delivery = { ok: true } | { ok: false; retryAfterMs?: number; permanent?: boolean; code: string }
type Job = { id: string; text: string; attempts: number }

/** Local durable queue. SQLite transactions coordinate web/CLI workers on one host. */
export class Outbox {
  private db: DatabaseSync
  constructor(path: string, private destination: string, private send: (text: string) => Promise<Delivery>, private now = Date.now) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    this.db = new DatabaseSync(path)
    this.db.exec(`
      PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS observations (destination TEXT, scope TEXT, fingerprint TEXT, PRIMARY KEY(destination, scope));
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, destination TEXT, text TEXT, attempts INTEGER DEFAULT 0,
        due INTEGER, claim TEXT, status TEXT DEFAULT 'pending', error TEXT);
      CREATE TABLE IF NOT EXISTS throttle (destination TEXT PRIMARY KEY, until_ms INTEGER);
    `)
  }
  private transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE")
    try { const result = fn(); this.db.exec("COMMIT"); return result }
    catch (error) { this.db.exec("ROLLBACK"); throw error }
  }
  enqueue(text: string) {
    this.db.prepare("INSERT INTO jobs (id, destination, text, due) VALUES (?, ?, ?, ?)")
      .run(randomUUID(), this.destination, text, this.now())
  }
  /** A null fingerprint means healthy; never announces an initial healthy baseline. */
  observe(scope: string, fingerprint: string | null, text?: string, recovery?: string) {
    this.transaction(() => {
      const previous = this.db.prepare("SELECT fingerprint FROM observations WHERE destination = ? AND scope = ?")
        .get(this.destination, scope)
      if (previous?.fingerprint === fingerprint) return
      const message = fingerprint === null ? (previous?.fingerprint ? recovery : undefined) : text
      if (message) this.enqueue(message)
      this.db.prepare("INSERT OR REPLACE INTO observations VALUES (?, ?, ?)").run(this.destination, scope, fingerprint)
    })
  }
  async tick(): Promise<boolean> {
    const claim = randomUUID()
    const job = this.transaction(() => {
      const throttle = this.db.prepare("SELECT until_ms FROM throttle WHERE destination = ?").get(this.destination)
      if (Number(throttle?.until_ms ?? 0) > this.now()) return undefined
      const found = this.db.prepare("SELECT id, text, attempts FROM jobs WHERE destination = ? AND status = 'pending' AND due <= ? ORDER BY due, rowid LIMIT 1")
        .get(this.destination, this.now()) as Job | undefined
      if (!found) return undefined
      // Lease expires after a crash. The HTTP timeout is shorter than this lease.
      this.db.prepare("UPDATE jobs SET claim = ?, due = ? WHERE id = ?").run(claim, this.now() + 30_000, found.id)
      this.db.prepare("INSERT OR REPLACE INTO throttle VALUES (?, ?)").run(this.destination, this.now() + 30_000)
      return found
    })
    if (!job) return false
    let result: Delivery
    try { result = await this.send(job.text) }
    catch { result = { ok: false, code: "network" } }
    this.transaction(() => {
      const active = this.db.prepare("SELECT claim FROM jobs WHERE id = ?").get(job.id)
      if (active?.claim !== claim) return
      const retryMs = result.ok ? 0 : result.retryAfterMs ?? Math.min(300_000, 2000 * 2 ** Math.min(job.attempts, 8))
      if (result.ok) this.db.prepare("DELETE FROM jobs WHERE id = ?").run(job.id)
      else this.db.prepare("UPDATE jobs SET attempts = attempts + 1, due = ?, status = ?, error = ?, claim = NULL WHERE id = ?")
        .run(this.now() + retryMs, result.permanent ? "failed" : "pending", result.code, job.id)
      // 3.1s also fits the default group limit of 20 messages/minute.
      this.db.prepare("INSERT OR REPLACE INTO throttle VALUES (?, ?)")
        .run(this.destination, this.now() + Math.max(3100, result.ok ? 0 : result.retryAfterMs ?? 0))
    })
    return true
  }
  status() {
    return this.db.prepare("SELECT status, COUNT(*) AS count FROM jobs WHERE destination = ? GROUP BY status").all(this.destination)
  }
  retryFailed() {
    this.db.prepare("UPDATE jobs SET status = 'pending', due = ?, claim = NULL WHERE destination = ? AND status = 'failed'")
      .run(this.now(), this.destination)
  }
  close() { this.db.close() }
}
