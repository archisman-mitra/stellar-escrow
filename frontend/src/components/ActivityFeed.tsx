import { useState, useEffect, useRef, useCallback } from "react";
import { fetchRecentEvents, type ContractEvent } from "../lib/events";
import { rpcServer, CONTRACT_ID } from "../lib/soroban";

// ── Helpers ────────────────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function describeEvent(event: ContractEvent): string {
  switch (event.type) {
    case "created": {
      // data is [sender, recipient, amount] tuple from the contract
      let amountStr = "";
      if (Array.isArray(event.data) && event.data.length >= 3) {
        const raw = Number(event.data[2]);
        if (!isNaN(raw) && raw > 0) {
          amountStr = ` — ${(raw / 10_000_000).toFixed(2)} XLM locked`;
        }
      }
      return `Escrow #${event.escrowId} created${amountStr}`;
    }
    case "claimed":
      return `Escrow #${event.escrowId} claimed`;
    case "refunded":
      return `Escrow #${event.escrowId} refunded`;
    default:
      return `Escrow #${event.escrowId} — ${event.type}`;
  }
}

const TYPE_ICONS: Record<string, string> = {
  created: "🔒",
  claimed: "✅",
  refunded: "↩️",
};

// ── Component ──────────────────────────────────────────────────────────

export function ActivityFeed() {
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [polling, setPolling] = useState(true);
  const lastLedgerRef = useRef<number | undefined>(undefined);
  const seenKeysRef = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    try {
      const { events: newEvents, latestLedger } = await fetchRecentEvents(
        rpcServer,
        CONTRACT_ID,
        lastLedgerRef.current,
      );

      // Update cursor for next incremental fetch (+1 so we don't re-fetch the same ledger)
      lastLedgerRef.current = latestLedger > 0 ? latestLedger : undefined;

      if (newEvents.length === 0) return;

      setEvents((prev) => {
        const merged = [...prev];
        for (const evt of newEvents) {
          if (!seenKeysRef.current.has(evt.key)) {
            seenKeysRef.current.add(evt.key);
            merged.push(evt);
          }
        }
        // Keep newest-first, cap at 100
        merged.sort((a, b) => b.ledger - a.ledger);
        return merged.slice(0, 100);
      });
    } catch (err) {
      console.warn("Activity feed poll error:", err);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    poll();

    // Poll every 5 seconds
    const interval = setInterval(poll, 5_000);
    setPolling(true);

    return () => {
      clearInterval(interval);
      setPolling(false);
    };
  }, [poll]);

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface-raised overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">Activity Feed</h3>
        {polling && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
        )}
        <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-text-secondary opacity-60">
          Live
        </span>
      </div>

      {/* Event list */}
      <div className="overflow-y-auto" style={{ maxHeight: 300 }}>
        {events.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm text-text-secondary">
            No recent activity
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((evt) => (
              <li
                key={evt.key}
                className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-surface-overlay/40"
              >
                <span className="mt-0.5 text-base leading-none shrink-0">
                  {TYPE_ICONS[evt.type] ?? "📋"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary leading-snug">
                    {describeEvent(evt)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-secondary">
                    Ledger {evt.ledger.toLocaleString()} · {relativeTime(evt.ledgerClosedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
