import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  StellarWalletsKit,
  Networks,
} from "@creit.tech/stellar-wallets-kit";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { RabetModule } from "@creit.tech/stellar-wallets-kit/modules/rabet";
import { LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr";

// ── Types ──────────────────────────────────────────────────────────────
interface WalletState {
  /** The connected Stellar public key, or null when disconnected. */
  address: string | null;
  /** True while the wallet-connect flow is in progress. */
  connecting: boolean;
  /** Whether a wallet is currently connected. */
  isConnected: boolean;
}

interface WalletContextValue extends WalletState {
  /** Initiate a wallet connection. */
  connect: () => Promise<void>;
  /** Disconnect the active wallet. */
  disconnect: () => void;
  /** The initialized kit instance (as a class since v2.5.0 it's static, so we can just expose the class) */
  kit: typeof StellarWalletsKit;
}

// ── Context ────────────────────────────────────────────────────────────
const WalletContext = createContext<WalletContextValue | undefined>(undefined);

// ── Provider ───────────────────────────────────────────────────────────
export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    address: null,
    connecting: false,
    isConnected: false,
  });

  // Initialize the kit once
  useEffect(() => {
    StellarWalletsKit.init({
      selectedWalletId: "freighter",
      network: Networks.TESTNET, 
      modules: [
        new FreighterModule(),
        new AlbedoModule(),
        new xBullModule(),
        new RabetModule(),
        new LobstrModule(),
      ],
    });

    // Check if we have a persisted session
    StellarWalletsKit.getAddress().then(({ address }) => {
      if (address) {
        setState((s) => ({ ...s, address, isConnected: true }));
      }
    }).catch(() => {
      // ignore, not connected yet
    });
  }, []);

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, connecting: true }));

    try {
      const { address } = await StellarWalletsKit.authModal();
      setState((s) => ({ ...s, address, isConnected: true, connecting: false }));
      toast.success("Wallet connected successfully!");
    } catch (error) {
      console.error("[WalletProvider] Connection failed:", error);
      toast.error("Wallet connection failed");
      setState((s) => ({ ...s, connecting: false }));
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await StellarWalletsKit.disconnect();
    } catch (e) {
      console.error("Disconnect error", e);
    }
    setState({ address: null, connecting: false, isConnected: false });
    toast.info("Wallet disconnected");
  }, []);

  return (
    <WalletContext.Provider value={{ ...state, connect, disconnect, kit: StellarWalletsKit }}>
      {children}
    </WalletContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────
export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within a <WalletProvider>");
  }
  return ctx;
}
