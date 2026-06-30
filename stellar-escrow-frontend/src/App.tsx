import { useState, useEffect, useCallback } from "react";
import { Toaster, toast } from "sonner";
import { WalletProvider, useWallet } from "./lib/wallet";
import { EscrowList } from "./components/EscrowList";
import { CreateEscrowModal } from "./components/CreateEscrowModal";
import type { Escrow } from "./types/escrow";
import { listEscrows, claimEscrow, refundEscrow } from "./lib/soroban";

// ── Wallet Dropdown Menu ───────────────────────────────────────────────
function WalletMenu({
  address,
  disconnect,
}: {
  address: string;
  disconnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 cursor-pointer rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-overlay"
      >
        {address.slice(0, 4)}…{address.slice(-4)}
        <span className="text-xs text-text-secondary opacity-70">▼</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-40 z-50 rounded-lg border border-border bg-surface shadow-xl py-1">
            <button
              onClick={() => {
                setOpen(false);
                disconnect();
              }}
              className="w-full text-left cursor-pointer px-4 py-2 text-sm text-red-400 hover:bg-surface-raised transition-colors"
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────
function Navbar() {
  const { address, connecting, connect, disconnect } = useWallet();
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-surface/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="text-accent text-xl leading-none">◈</span>
          <h1 className="text-lg font-semibold tracking-tight text-text-primary sm:text-xl">
            Stellar Escrow
          </h1>
        </div>
        {address ? (
          <WalletMenu address={address} disconnect={disconnect} />
        ) : (
          <button
            onClick={connect}
            disabled={connecting}
            className="cursor-pointer rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-surface transition-all hover:bg-accent-hover active:scale-[0.97] disabled:opacity-60"
          >
            {connecting ? "Connecting…" : "Connect Wallet"}
          </button>
        )}
      </div>
    </header>
  );
}

// ── Hero (disconnected state) ──────────────────────────────────────────
function Hero() {
  const { connect, connecting } = useWallet();
  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-border bg-surface-raised p-10 text-center sm:p-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-muted text-3xl text-accent">
        ◈
      </div>
      <div>
        <h2 className="text-2xl font-bold text-text-primary sm:text-3xl">
          Trustless Escrow on Stellar
        </h2>
        <p className="mt-2 max-w-md text-text-secondary">
          Lock tokens in a Soroban smart contract, set a deadline, and let the
          recipient claim — or get an automatic refund.
        </p>
      </div>
      <button
        onClick={connect}
        disabled={connecting}
        className="cursor-pointer rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-surface transition-all hover:bg-accent-hover active:scale-[0.97] disabled:opacity-60"
      >
        {connecting ? "Connecting…" : "Connect Wallet to Start"}
      </button>
    </div>
  );
}

// ── Escrow Board (connected state) ─────────────────────────────────────
function EscrowBoard({ address }: { address: string }) {
  const { kit } = useWallet();
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());

  const addPendingId = (id: number) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const removePendingId = (id: number) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const fetchEscrows = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listEscrows(address || undefined);
      setEscrows(list);
    } catch (error) {
      console.error("Failed to load escrows:", error);
      toast.error("Failed to load escrows from contract");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchEscrows();
  }, [fetchEscrows]);

  async function handleClaim(id: number) {
    if (!address) return;
    addPendingId(id);
    try {
      await claimEscrow(address, id, kit);
      toast.success(`Escrow #${id} claimed successfully!`);
      await fetchEscrows();
    } catch (error: any) {
      toast.error(error.message || `Failed to claim escrow #${id}`);
    } finally {
      removePendingId(id);
    }
  }

  async function handleRefund(id: number) {
    if (!address) return;
    addPendingId(id);
    try {
      await refundEscrow(address, id, kit);
      toast.success(`Escrow #${id} refunded successfully!`);
      await fetchEscrows();
    } catch (error: any) {
      toast.error(error.message || `Failed to refund escrow #${id}`);
    } finally {
      removePendingId(id);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-text-primary">Escrows</h2>
        <span className="rounded-full bg-surface-raised px-2.5 py-0.5 text-xs font-medium text-text-secondary">
          {loading ? "…" : escrows.length}
        </span>
      </div>

      {/* Create button */}
      <CreateEscrowModal onCreated={fetchEscrows} />

      {/* List */}
      <EscrowList
        escrows={escrows}
        loading={loading}
        connectedAddress={address}
        onClaim={handleClaim}
        onRefund={handleRefund}
        pendingIds={pendingIds}
      />
    </div>
  );
}

// ── Main Content ───────────────────────────────────────────────────────
function MainContent() {
  const { address, isConnected } = useWallet();
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      {isConnected && address ? (
        <EscrowBoard address={address} />
      ) : (
        <Hero />
      )}
    </main>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-border py-6 text-center text-xs text-text-secondary">
      Built on{" "}
      <span className="font-medium text-accent">Stellar&nbsp;Soroban</span>{" "}
      &middot; Testnet
    </footer>
  );
}

// ── App ────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <WalletProvider>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <MainContent />
        <Footer />
      </div>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-primary)",
          },
        }}
      />
    </WalletProvider>
  );
}
