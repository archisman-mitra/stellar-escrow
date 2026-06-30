import { rpc, scValToNative } from "@stellar/stellar-sdk";

// ── Types ──────────────────────────────────────────────────────────────

export type ContractEventType = "created" | "claimed" | "refunded";

export interface ContractEvent {
  /** Unique key for deduplication: `${type}-${escrowId}-${ledger}` */
  key: string;
  /** The kind of escrow action that was emitted. */
  type: ContractEventType;
  /** Which escrow this event pertains to. */
  escrowId: number;
  /** The ledger sequence in which the event was emitted. */
  ledger: number;
  /** ISO-8601 timestamp string of ledger close (from RPC). */
  ledgerClosedAt: string;
  /** Decoded value payload — shape depends on event type. */
  data: any;
}

// ── Known event topic symbols ──────────────────────────────────────────

const KNOWN_TOPICS = new Set<ContractEventType>(["created", "claimed", "refunded"]);

// ── Fetch recent contract events ───────────────────────────────────────

/**
 * Fetches recent events emitted by the escrow contract.
 *
 * @param server       An initialised `rpc.Server` instance.
 * @param contractId   The contract address to filter events for.
 * @param sinceLedger  If provided, fetch events starting from this ledger.
 *                     Otherwise falls back to `latestLedger - 1000`.
 * @returns            An array of decoded `ContractEvent` objects, newest-first.
 */
export async function fetchRecentEvents(
  server: rpc.Server,
  contractId: string,
  sinceLedger?: number,
): Promise<{ events: ContractEvent[]; latestLedger: number }> {
  // Determine starting ledger
  let startLedger = sinceLedger;
  if (!startLedger) {
    const ledgerInfo = await server.getLatestLedger();
    // Look back ~1000 ledgers (~83 min at ~5 s / ledger)
    startLedger = Math.max(ledgerInfo.sequence - 1000, 1);
  }

  const response = await server.getEvents({
    startLedger,
    filters: [
      {
        type: "contract",
        contractIds: [contractId],
      },
    ],
    limit: 50,
  });

  const events: ContractEvent[] = [];

  for (const raw of response.events) {
    try {
      // topic[0] is the symbol ("created" | "claimed" | "refunded")
      // topic[1] is the escrow id (u32)
      if (!raw.topic || raw.topic.length < 2) continue;

      const topicSymbol = scValToNative(raw.topic[0]) as string;
      if (!KNOWN_TOPICS.has(topicSymbol as ContractEventType)) continue;

      const escrowId = Number(scValToNative(raw.topic[1]));
      const data = scValToNative(raw.value);

      const eventType = topicSymbol as ContractEventType;
      const key = `${eventType}-${escrowId}-${raw.ledger}`;

      events.push({
        key,
        type: eventType,
        escrowId,
        ledger: raw.ledger,
        ledgerClosedAt: raw.ledgerClosedAt,
        data,
      });
    } catch (err) {
      // Skip events we can't decode — e.g. token transfer sub-events
      console.warn("Skipping undecoded event:", err);
    }
  }

  // Newest first
  events.sort((a, b) => b.ledger - a.ledger);

  return { events, latestLedger: response.latestLedger };
}
