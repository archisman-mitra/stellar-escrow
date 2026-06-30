/**
 * Represents the current status of an escrow.
 */
export type EscrowStatus = 'Locked' | 'Claimed' | 'Refunded';

/**
 * The on-chain Escrow data model.
 */
export interface Escrow {
  /** Unique numeric identifier for the escrow. */
  id: number;
  /** Stellar address of the sender who funded the escrow. */
  sender: string;
  /** Stellar address of the intended recipient. */
  recipient: string;
  /** Stellar asset / token contract address held in escrow. */
  token: string;
  /** Amount of the token locked (as a string to preserve precision). */
  amount: string;
  /** Unix timestamp after which the escrow can be refunded. */
  deadline: number;
  /** Current lifecycle status of the escrow. */
  status: EscrowStatus;
}
