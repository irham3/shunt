import { readFileSync, writeFileSync, existsSync } from "node:fs";

/**
 * Idempotency store: tx hashes already handled (prepared or distributed),
 * plus the last-seen paging token so reconnects resume where they left off.
 * Persisted to disk so a keeper restart can never double-split (PRD §12).
 */
export class KeeperState {
  private processed = new Set<string>();
  private cursor = "now";

  constructor(private file: string) {
    if (existsSync(file)) {
      const raw = JSON.parse(readFileSync(file, "utf-8"));
      this.processed = new Set(raw.processed ?? []);
      this.cursor = raw.cursor ?? "now";
    }
  }

  isProcessed(txHash: string): boolean {
    return this.processed.has(txHash);
  }

  markProcessed(txHash: string): void {
    this.processed.add(txHash);
    this.save();
  }

  getCursor(): string {
    return this.cursor;
  }

  setCursor(token: string): void {
    this.cursor = token;
    this.save();
  }

  private save(): void {
    writeFileSync(
      this.file,
      JSON.stringify({ processed: [...this.processed], cursor: this.cursor }),
    );
  }
}
