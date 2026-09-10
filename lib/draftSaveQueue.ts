// Serial writes prevent an older autosave from arriving after a newer one.
// flush() includes edits made during the request; a failed write stays pending.
export class DraftSaveQueue<T> {
  private latest: T
  private saved: T
  private running: Promise<boolean> | null = null
  private stopped = false

  constructor(initial: T, private readonly write: (value: T) => Promise<boolean>) {
    this.latest = initial
    this.saved = initial
  }

  update(value: T): void { this.latest = value }
  get pending(): boolean { return this.latest !== this.saved }
  stop(): void { this.stopped = true }

  flush(): Promise<boolean> {
    if (this.stopped) return Promise.resolve(false)
    if (this.running) return this.running
    this.running = this.drain().finally(() => { this.running = null })
    return this.running
  }

  private async drain(): Promise<boolean> {
    while (this.pending && !this.stopped) {
      const snapshot = this.latest
      let ok = false
      try { ok = await this.write(snapshot) } catch { ok = false }
      if (!ok || this.stopped) return false
      this.saved = snapshot
    }
    return !this.stopped
  }
}
