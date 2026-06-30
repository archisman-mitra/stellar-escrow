import {
  rpc,
  TransactionBuilder,
  BASE_FEE,
  Contract,
  nativeToScVal,
  scValToNative,
  Address,
  Account,
} from "@stellar/stellar-sdk";
import type { Escrow, EscrowStatus } from "../types/escrow";

// ── Constants ──────────────────────────────────────────────────────────

export const CONTRACT_ID = "CAGZXNUYHPIB7FRQQNMDMKR4XF5W7JAY6WBCWFSSWHYMRGYURDCUF4N6";
export const XLM_TOKEN_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const RPC_URL = "https://soroban-testnet.stellar.org";

export const rpcServer = new rpc.Server(RPC_URL);

// ── Error Mapping & Parsing ─────────────────────────────────────────────

const ERROR_MAP: Record<number, string> = {
  1: "NotFound",
  2: "NotAuthorized",
  3: "AlreadySettled",
  4: "DeadlineNotReached",
  5: "NoDeadlineSet",
  6: "InvalidAmount",
};

export function parseAndThrowError(err: any): never {
  const errMsg = String(err?.message || err || "");
  console.error("Soroban error:", err);

  // Match contract error code e.g. "Error(Contract, 3)" or "ContractError: 3"
  const match = errMsg.match(/(?:Contract|error)\b\D*(\d+)/i) || errMsg.match(/Code\s*:\s*(\d+)/i) || errMsg.match(/(\d+)/);
  if (match) {
    const code = parseInt(match[1], 10);
    if (ERROR_MAP[code]) {
      throw new Error(ERROR_MAP[code]);
    }
  }

  throw new Error(errMsg || "Transaction failed");
}

function parseStatus(statusVal: any): EscrowStatus {
  if (typeof statusVal === "string") {
    return statusVal as EscrowStatus;
  }
  if (typeof statusVal === "number") {
    if (statusVal === 0) return "Locked";
    if (statusVal === 1) return "Claimed";
    if (statusVal === 2) return "Refunded";
  }
  if (statusVal && typeof statusVal === "object") {
    if ("name" in statusVal) return statusVal.name as EscrowStatus;
    const keys = Object.keys(statusVal);
    if (keys.length > 0) return keys[0] as EscrowStatus;
  }
  return "Locked";
}

// ── Helpers ────────────────────────────────────────────────────────────

async function pollTransaction(hash: string): Promise<any> {
  const start = Date.now();
  const timeoutMs = 30000;
  const intervalMs = 1500;

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await rpcServer.getTransaction(hash);
      if (response.status === "SUCCESS") {
        return response;
      }
      if (response.status === "FAILED") {
        throw new Error(response.resultXdr?.toString() || "Transaction failed");
      }
    } catch (e: any) {
      if (e.message && (e.message.includes("failed") || e.message.includes("Failed"))) {
        throw e;
      }
      // NOT_FOUND or temporary network issue
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Transaction polling timed out after 30 seconds");
}

// ── Service Functions ──────────────────────────────────────────────────

export async function createEscrow(
  sender: string,
  recipient: string,
  amountXlm: number,
  deadline: number,
  kit: any
): Promise<number> {
  try {
    const amountStroops = BigInt(Math.round(amountXlm * 10000000));
    const contract = new Contract(CONTRACT_ID);
    const op = contract.call(
      "create_escrow",
      Address.fromString(sender).toScVal(),
      Address.fromString(recipient).toScVal(),
      Address.fromString(XLM_TOKEN_ID).toScVal(),
      nativeToScVal(amountStroops, { type: "i128" }),
      nativeToScVal(BigInt(deadline), { type: "u64" })
    );

    const sourceAccount = await rpcServer.getAccount(sender);
    const tx = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    const preparedTx = await rpcServer.prepareTransaction(tx);
    const { signedTxXdr } = await kit.signTransaction(preparedTx.toXDR(), {
      address: sender,
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    const submittedTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
    const submission = await rpcServer.sendTransaction(submittedTx);
    if (submission.status === "ERROR") {
      throw new Error(JSON.stringify(submission.errorResult) || "Failed to submit transaction");
    }

    const txResponse = await pollTransaction(submission.hash);
    if (!txResponse.returnValue) {
      throw new Error("No return value in transaction result");
    }
    return Number(scValToNative(txResponse.returnValue));
  } catch (error) {
    parseAndThrowError(error);
  }
}

export async function claimEscrow(
  recipient: string,
  id: number,
  kit: any
): Promise<void> {
  try {
    const contract = new Contract(CONTRACT_ID);
    const op = contract.call(
      "claim",
      Address.fromString(recipient).toScVal(),
      nativeToScVal(id, { type: "u32" })
    );

    const sourceAccount = await rpcServer.getAccount(recipient);
    const tx = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    const preparedTx = await rpcServer.prepareTransaction(tx);
    const { signedTxXdr } = await kit.signTransaction(preparedTx.toXDR(), {
      address: recipient,
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    const submittedTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
    const submission = await rpcServer.sendTransaction(submittedTx);
    if (submission.status === "ERROR") {
      throw new Error(JSON.stringify(submission.errorResult) || "Failed to submit transaction");
    }

    await pollTransaction(submission.hash);
  } catch (error) {
    parseAndThrowError(error);
  }
}

export async function refundEscrow(
  sender: string,
  id: number,
  kit: any
): Promise<void> {
  try {
    const contract = new Contract(CONTRACT_ID);
    const op = contract.call(
      "refund",
      Address.fromString(sender).toScVal(),
      nativeToScVal(id, { type: "u32" })
    );

    const sourceAccount = await rpcServer.getAccount(sender);
    const tx = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    const preparedTx = await rpcServer.prepareTransaction(tx);
    const { signedTxXdr } = await kit.signTransaction(preparedTx.toXDR(), {
      address: sender,
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    const submittedTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
    const submission = await rpcServer.sendTransaction(submittedTx);
    if (submission.status === "ERROR") {
      throw new Error(JSON.stringify(submission.errorResult) || "Failed to submit transaction");
    }

    await pollTransaction(submission.hash);
  } catch (error) {
    parseAndThrowError(error);
  }
}

export const DEFAULT_SUBMITTER = "GAUNKJKGR62PSBPMNJD572O5Q6RJPFZABCRMFNDNCXH2HKQGNW4SSHVT";

export async function getEscrow(id: number, sourceAddress?: string): Promise<Escrow | null> {
  try {
    const contract = new Contract(CONTRACT_ID);
    const op = contract.call("get_escrow", nativeToScVal(id, { type: "u32" }));
    const activeAddress = sourceAddress || DEFAULT_SUBMITTER;
    const dummyAccount = new Account(activeAddress, "0");
    const tx = new TransactionBuilder(dummyAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    const sim = await rpcServer.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim)) {
      return null;
    }
    if (!sim.result?.retval) {
      return null;
    }
    const nativeValue = scValToNative(sim.result.retval);
    if (!nativeValue) {
      return null;
    }
    return {
      id: Number(nativeValue.id),
      sender: nativeValue.sender,
      recipient: nativeValue.recipient,
      token: nativeValue.token,
      amount: (Number(nativeValue.amount) / 10000000).toString(),
      deadline: Number(nativeValue.deadline),
      status: parseStatus(nativeValue.status),
    };
  } catch (error) {
    console.error(`Error in getEscrow(${id}):`, error);
    return null;
  }
}

export async function getEscrowCount(sourceAddress?: string): Promise<number> {
  try {
    const contract = new Contract(CONTRACT_ID);
    const op = contract.call("get_count");
    const activeAddress = sourceAddress || DEFAULT_SUBMITTER;
    const dummyAccount = new Account(activeAddress, "0");
    const tx = new TransactionBuilder(dummyAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    const sim = await rpcServer.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim)) {
      throw new Error((sim as any).error || "Simulation failed");
    }
    if (!sim.result?.retval) {
      return 0;
    }
    return Number(scValToNative(sim.result.retval));
  } catch (error) {
    console.error("Error in getEscrowCount:", error);
    return 0;
  }
}

export async function listEscrows(sourceAddress?: string): Promise<Escrow[]> {
  try {
    const count = await getEscrowCount(sourceAddress);
    const escrows: Escrow[] = [];
    for (let i = 1; i <= count; i++) {
      const escrow = await getEscrow(i, sourceAddress);
      if (escrow) {
        escrows.push(escrow);
      }
    }
    return escrows.sort((a, b) => b.id - a.id);
  } catch (error) {
    console.error("Error in listEscrows:", error);
    return [];
  }
}
