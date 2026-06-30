import { useState } from "react";
import { toast } from "sonner";
import { useWallet } from "../lib/wallet";
import { createEscrow } from "../lib/soroban";

// ── Form field error type ──────────────────────────────────────────────
interface FormErrors {
  recipient?: string;
  amount?: string;
  deadline?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────
function isValidStellarAddress(addr: string) {
  return /^G[A-Z2-7]{55}$/.test(addr.trim());
}

interface CreateEscrowFormProps {
  onCreated: () => void;
  onClose: () => void;
}

// ── Create Escrow Form ─────────────────────────────────────────────────
export function CreateEscrowForm({ onCreated, onClose }: CreateEscrowFormProps) {
  const { address, kit } = useWallet();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [noDeadline, setNoDeadline] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const next: FormErrors = {};

    if (!isValidStellarAddress(recipient)) {
      next.recipient = "Enter a valid Stellar address (starts with G, 56 chars).";
    }

    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      next.amount = "Enter an amount greater than 0.";
    }

    if (!noDeadline) {
      if (!deadlineInput) {
        next.deadline = "Choose a deadline, or tick 'No deadline'.";
      } else if (new Date(deadlineInput).getTime() <= Date.now()) {
        next.deadline = "Deadline must be in the future.";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (!address) {
      toast.error("Wallet not connected");
      return;
    }

    setSubmitting(true);
    try {
      const deadline = noDeadline ? 0 : Math.floor(new Date(deadlineInput).getTime() / 1000);
      const newId = await createEscrow(address, recipient.trim(), parseFloat(amount), deadline, kit);
      toast.success(`Escrow #${newId} created!`);
      onCreated();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to create escrow");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
      noValidate
    >
      {/* Recipient */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-primary" htmlFor="recipient">
          Recipient Address
        </label>
        <input
          id="recipient"
          type="text"
          placeholder="GABC…XYZ"
          value={recipient}
          onChange={(e) => {
            setRecipient(e.target.value);
            if (errors.recipient) setErrors((p) => ({ ...p, recipient: undefined }));
          }}
          className={`w-full rounded-lg border px-3 py-2.5 font-mono text-sm text-text-primary bg-surface placeholder-text-secondary/50 outline-none transition focus:ring-2 focus:ring-accent/50 ${
            errors.recipient ? "border-red-500" : "border-border"
          }`}
        />
        {errors.recipient && (
          <p className="text-xs text-red-400">{errors.recipient}</p>
        )}
      </div>

      {/* Amount */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-primary" htmlFor="amount">
          Amount (XLM)
        </label>
        <div className="relative">
          <input
            id="amount"
            type="number"
            min="0"
            step="any"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (errors.amount) setErrors((p) => ({ ...p, amount: undefined }));
            }}
            className={`w-full rounded-lg border px-3 py-2.5 pr-14 text-sm text-text-primary bg-surface placeholder-text-secondary/50 outline-none transition focus:ring-2 focus:ring-accent/50 ${
              errors.amount ? "border-red-500" : "border-border"
            }`}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-text-secondary">
            XLM
          </span>
        </div>
        {errors.amount && (
          <p className="text-xs text-red-400">{errors.amount}</p>
        )}
      </div>

      {/* Deadline */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-text-primary">Deadline</label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={noDeadline}
            onChange={(e) => {
              setNoDeadline(e.target.checked);
              if (errors.deadline) setErrors((p) => ({ ...p, deadline: undefined }));
            }}
            className="h-4 w-4 accent-accent cursor-pointer"
          />
          <span className="text-sm text-text-secondary">No deadline (one-way payment)</span>
        </label>
        {!noDeadline && (
          <input
            type="datetime-local"
            value={deadlineInput}
            onChange={(e) => {
              setDeadlineInput(e.target.value);
              if (errors.deadline) setErrors((p) => ({ ...p, deadline: undefined }));
            }}
            className={`w-full rounded-lg border px-3 py-2.5 text-sm text-text-primary bg-surface outline-none transition focus:ring-2 focus:ring-accent/50 ${
              errors.deadline ? "border-red-500" : "border-border"
            }`}
          />
        )}
        {errors.deadline && (
          <p className="text-xs text-red-400">{errors.deadline}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 cursor-pointer rounded-lg border border-border bg-surface py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-overlay"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 cursor-pointer rounded-lg bg-accent py-2.5 text-sm font-semibold text-surface transition-all hover:bg-accent-hover active:scale-[0.97] disabled:opacity-60"
        >
          {submitting ? "Processing…" : "Create Escrow"}
        </button>
      </div>
    </form>
  );
}

// ── Create Escrow Modal ────────────────────────────────────────────────
interface CreateEscrowModalProps {
  onCreated: () => void;
}

export function CreateEscrowModal({ onCreated }: CreateEscrowModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-accent/40 bg-accent-muted py-4 text-sm font-semibold text-accent transition-all hover:border-accent/70 hover:bg-accent-muted/80 active:scale-[0.99]"
      >
        <span className="text-lg leading-none">+</span>
        Create Escrow
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          {/* Dialog */}
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface-raised p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">New Escrow</h2>
              <button
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-md p-1 text-text-secondary hover:bg-surface-overlay transition-colors"
              >
                ✕
              </button>
            </div>
            <CreateEscrowForm
              onCreated={onCreated}
              onClose={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
