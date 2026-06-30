# Stellar Escrow

Trustless peer-to-peer token escrow on Stellar, powered by a Soroban smart contract. A sender locks XLM for a specific recipient, optionally with a deadline. The recipient can claim the funds at any time; if a deadline is set and passes unclaimed, the sender can reclaim the funds via refund.

**Live demo:** https://stellar-escrow-indol.vercel.app/
**Repository:** https://github.com/archisman-mitra/stellar-escrow

Built for Level 3 of the Stellar Monthly Builder Challenge (GDG Stellar Workshop).

---

## Why escrow

Most token transfers on a blockchain are irreversible the instant they're sent — there's no built-in way to say "send this, but let the recipient confirm before it's final, and let me take it back if they never do." This contract solves that with on-chain logic instead of trust: funds are held by the contract itself, not by either party, until one of two clearly defined conditions is met.

## How it works

1. **Sender creates an escrow** — specifies a recipient address, an amount in XLM, and an optional deadline. The contract immediately locks the funds by pulling them from the sender's account.
2. **Recipient claims** — at any time while the escrow is `Locked`, the recipient can claim, and the contract releases the full amount to them.
3. **Sender refunds** — only possible if a deadline was set *and* has passed *and* the recipient hasn't claimed yet. The sender reclaims their funds.

Each escrow is a fully independent on-chain record with its own status (`Locked` → `Claimed` or `Refunded`), so anyone can audit the full lifecycle of any escrow at any time.

---

## Architecture

```
┌─────────────────┐      ┌──────────────────────┐      ┌────────────────────┐
│   React/Vite     │      │   Escrow Contract     │      │  Native XLM Token   │
│   Frontend        │─────▶│   (Soroban, Rust)     │─────▶│  Contract (SAC)     │
│   + Wallet Kit     │      │                       │      │                     │
└─────────────────┘      └──────────────────────┘      └────────────────────┘
        │                            │
        │  polls getEvents()         │ emits events
        ▼                            ▼
┌──────────────────────────────────────────┐
│        Live Activity Feed (real-time)      │
└──────────────────────────────────────────┘
```

The frontend never moves funds directly — every transfer goes through the escrow contract, which in turn calls the Stellar Asset Contract (the native XLM token contract) to actually move balances. This is genuine **inter-contract communication**: two separate contract addresses, two separate `Success` events per transaction, visible on-chain in every transaction below.

---

## Smart contract

**Language:** Rust (Soroban SDK 22)
**Contract address (testnet):** `CAGZXNUYHPIB7FRQQNMDMKR4XF5W7JAY6WBCWFSSWHYMRGYURDCUF4N6`

### Functions

| Function | Caller | Description |
|---|---|---|
| `create_escrow(sender, recipient, token, amount, deadline)` | sender | Locks funds via a cross-contract call to the token contract. `deadline = 0` means no refund is ever possible. |
| `claim(recipient, id)` | recipient only | Releases locked funds to the recipient. |
| `refund(sender, id)` | sender only | Releases funds back to the sender, only after `deadline` has passed. |
| `get_escrow(id)` | anyone | Read-only lookup of an escrow's full state. |
| `get_count()` | anyone | Read-only total number of escrows created. |

### Inter-contract communication

`create_escrow`, `claim`, and `refund` all invoke `token::Client::transfer(...)` against the native XLM Stellar Asset Contract (`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` on testnet) to actually move balances. This means every fund movement is two contract invocations deep — the escrow contract orchestrates, the token contract executes the transfer. You can see this directly in any transaction on Stellar Expert: two separate `Success` lines from two separate contract addresses.

### Events

The contract emits four event types, used by the frontend's live Activity Feed:

- `created` — `(escrow_id)` with `(sender, recipient, amount)`
- `funded` — implicit in `created`, since locking happens atomically at creation
- `claimed` — `(escrow_id)` with `(recipient)`
- `refunded` — `(escrow_id)` with `(sender)`

### Error handling

| Code | Meaning |
|---|---|
| 1 | NotFound |
| 2 | NotAuthorized |
| 3 | AlreadySettled |
| 4 | DeadlineNotReached |
| 5 | NoDeadlineSet |
| 6 | InvalidAmount |

---

## On-chain proof

| Action | Hash / Address |
|---|---|
| Contract deploy (upload) | `e692f2779025af186251c10e4388fe095c48263e86a1190854d250b955565850` |
| Contract deploy (instantiate) | `388d0e5fe30dfefa0d456a094d7b6ba07ab4d862727c9b8aee1ca5db4db24a48` |
| CLI `create_escrow` interaction | `2c64f963f0df14671e6c4338d7b35408c39ef43208586ac3ede0b2579627644a` |
| UI `claim` interaction (real Freighter signature) | `5a7e99c3255a23d747500298c2d66945b5dcf5f7af89ead80d53baa5c4ac231f` |

All transactions are viewable on [Stellar Expert (testnet)](https://stellar.expert/explorer/testnet).

---

## Frontend

**Stack:** React + TypeScript + Vite, Tailwind CSS, `@stellar/stellar-sdk`, `@creit-tech/stellar-wallets-kit`, `sonner` for toasts.

**Features:**
- Multi-wallet connect (Freighter, Albedo, xBull, Rabet, Lobstr) via Stellar Wallets Kit
- Create / claim / refund flows, fully wired to the live contract — every transaction is built, simulated, signed by the connected wallet, submitted, and polled for confirmation
- Live Activity Feed — polls `getEvents()` against the deployed contract every 5 seconds and decodes real on-chain events into a human-readable, deduplicated, auto-updating feed
- Loading skeletons during initial data fetch, per-action "Processing…" states during transactions, toast notifications for success/failure with decoded contract error messages
- Mobile-responsive layout (single column on small screens, multi-column grid + sidebar on desktop)

---

## Testing

**Contract (Rust, Soroban testutils):** 6 tests in `contracts/escrow/src/test.rs`
- `test_create_locks_funds` — funds correctly locked via the cross-contract token call
- `test_recipient_can_claim` — full claim happy path
- `test_refund_after_deadline` — refund succeeds once the simulated ledger time passes the deadline
- `test_refund_fails_before_deadline` — refund correctly rejected before deadline
- `test_wrong_recipient_cannot_claim` — access control enforced
- `test_cannot_double_claim` — state transitions enforced, no double-spend

Run with:
```bash
cd contracts/escrow
cargo test
```

**Frontend (Vitest + Testing Library):** 7 tests across 3 files
- Contract service: event decoding and error-code mapping
- Component: form validation prevents invalid submissions
- Component: conditional action-button rendering based on wallet/status

Run with:
```bash
cd frontend
npm run test -- --run
```

---

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push to `main`: builds and tests the Rust contract (`cargo test`, `cargo build --target wasm32v1-none --release`), and lints/tests/builds the frontend.

---

## Running locally

### Contract
```bash
cd contracts/escrow
cargo test
cargo build --target wasm32v1-none --release
stellar contract deploy --wasm target/wasm32v1-none/release/escrow_contract.wasm --source <your-key> --network testnet
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Tech stack summary

- **Smart contract:** Rust, Soroban SDK 22, deployed to Stellar Testnet
- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Wallet integration:** Stellar Wallets Kit (multi-wallet support)
- **Deployment:** Vercel (frontend), Stellar CLI (contract)
- **CI/CD:** GitHub Actions
- **Testing:** Rust testutils (contract), Vitest + Testing Library (frontend)

---

## Author

Archisman Mitra — [GitHub](https://github.com/archisman-mitra)
