import type { Escrow } from "../types/escrow";

// ── Helpers ────────────────────────────────────────────────────────────
function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatDeadline(timestamp: number): string {
  if (!timestamp) return "No deadline";
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deadlinePassed(timestamp: number): boolean {
  if (!timestamp) return false;
  return Date.now() / 1000 > timestamp;
}

// ── Status Badge ───────────────────────────────────────────────────────
const STATUS_STYLES: Record<Escrow["status"], string> = {
  Locked: "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30",
  Claimed: "bg-accent-muted text-accent ring-1 ring-accent/30",
  Refunded: "bg-gray-500/15 text-gray-400 ring-1 ring-gray-500/30",
};

function StatusBadge({ status }: { status: Escrow["status"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

// ── EscrowCard ─────────────────────────────────────────────────────────
interface EscrowCardProps {
  escrow: Escrow;
  connectedAddress: string | null;
  onClaim: (id: number) => void;
  onRefund: (id: number) => void;
  pending?: boolean;
}

export function EscrowCard({
  escrow,
  connectedAddress,
  onClaim,
  onRefund,
  pending = false,
}: EscrowCardProps) {
  const isRecipient =
    connectedAddress?.toLowerCase() === escrow.recipient.toLowerCase();
  const isSender =
    connectedAddress?.toLowerCase() === escrow.sender.toLowerCase();
  const canClaim = isRecipient && escrow.status === "Locked";
  const canRefund =
    isSender && escrow.status === "Locked" && deadlinePassed(escrow.deadline);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-raised p-5 transition-shadow hover:shadow-lg hover:shadow-black/20">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-text-secondary">#{escrow.id}</span>
          <StatusBadge status={escrow.status} />
        </div>
        <p className="text-right text-lg font-bold text-text-primary">
          {escrow.amount}{" "}
          <span className="text-sm font-medium text-text-secondary">XLM</span>
        </p>
      </div>

      {/* Address rows */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-surface p-3 text-xs">
        <span className="text-text-secondary">From</span>
        <span className="truncate font-mono text-text-primary text-right">
          {truncate(escrow.sender)}
        </span>
        <span className="text-text-secondary">To</span>
        <span className="truncate font-mono text-text-primary text-right">
          {truncate(escrow.recipient)}
        </span>
      </div>

      {/* Deadline */}
      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 4.5V8l2.5 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span>{formatDeadline(escrow.deadline)}</span>
      </div>

      {/* Action button */}
      {canClaim && (
        <button
          onClick={() => onClaim(escrow.id)}
          disabled={pending}
          className="mt-1 cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface transition-all hover:bg-accent-hover active:scale-[0.97] disabled:opacity-60"
        >
          {pending ? "Processing…" : "Claim"}
        </button>
      )}
      {canRefund && (
        <button
          onClick={() => onRefund(escrow.id)}
          disabled={pending}
          className="mt-1 cursor-pointer rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-overlay disabled:opacity-60"
        >
          {pending ? "Processing…" : "Refund"}
        </button>
      )}
    </div>
  );
}
