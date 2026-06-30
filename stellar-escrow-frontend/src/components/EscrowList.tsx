// ── Loading Skeleton ───────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-raised p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-8 animate-pulse rounded bg-surface-overlay" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-surface-overlay" />
        </div>
        <div className="h-6 w-24 animate-pulse rounded bg-surface-overlay" />
      </div>
      <div className="rounded-xl bg-surface p-3 space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-surface-overlay" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-surface-overlay" />
      </div>
      <div className="h-3 w-32 animate-pulse rounded bg-surface-overlay" />
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
      <span className="text-3xl text-text-secondary opacity-40">◈</span>
      <p className="font-medium text-text-secondary">No escrows yet</p>
      <p className="text-sm text-text-secondary opacity-60">
        Create one above to get started.
      </p>
    </div>
  );
}

// ── Escrow List ────────────────────────────────────────────────────────
import { EscrowCard } from "./EscrowCard";
import type { Escrow } from "../types/escrow";

interface EscrowListProps {
  escrows: Escrow[];
  loading: boolean;
  connectedAddress: string | null;
  onClaim: (id: number) => void;
  onRefund: (id: number) => void;
  pendingIds: Set<number>;
}

export function EscrowList({
  escrows,
  loading,
  connectedAddress,
  onClaim,
  onRefund,
  pendingIds,
}: EscrowListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {escrows.length === 0 ? (
        <EmptyState />
      ) : (
        escrows.map((e) => (
          <EscrowCard
            key={e.id}
            escrow={e}
            connectedAddress={connectedAddress}
            onClaim={onClaim}
            onRefund={onRefund}
            pending={pendingIds.has(e.id)}
          />
        ))
      )}
    </div>
  );
}
