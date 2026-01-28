/**
 * TypeScript interfaces and types for DomeFeeEscrow
 */

/** Parameters required to generate a deterministic order identifier */
export interface OrderParams {
  chainId: number;
  userAddress: string;
  marketId: string;
  side: 'buy' | 'sell';
  size: bigint;
  price: number;
  timestamp: number;
}

/** Fee authorization data structure for EIP-712 signing */
export interface FeeAuth {
  orderId: string;
  payer: string;
  amount: bigint;
  deadline: bigint;
}

/** Signed fee authorization with signature */
export interface SignedFeeAuth extends FeeAuth {
  signature: string;
}

/** Parameters for contract's pullFee function */
export interface PullFeeParams {
  orderId: string;
  payer: string;
  orderSize: bigint;
  clientFeeBps: bigint;
  deadline: bigint;
  signature: string;
  client: string;
}

/** State values representing the escrow lifecycle */
export enum HoldState {
  EMPTY = 0,
  HELD = 1,
  SENT = 2,
  REFUNDED = 3,
}

/** Core escrow information returned by contract queries */
export interface EscrowData {
  payer: string;
  client: string;
  domeFee: bigint;
  clientFee: bigint;
  domeDistributed: bigint;
  clientDistributed: bigint;
  timestamp: bigint;
}

/** Extended escrow data including computed remaining balances */
export interface EscrowStatus extends EscrowData {
  domeRemaining: bigint;
  clientRemaining: bigint;
  state: HoldState;
}

/** Breakdown of fees computed for an order */
export interface FeeCalculation {
  domeFee: bigint;
  clientFee: bigint;
  totalFee: bigint;
}

/** Arguments for distributing fees to a single order */
export interface DistributeParams {
  orderId: string;
  domeAmount: bigint;
  clientAmount: bigint;
}

/** Arguments for distributing fees to multiple orders */
export interface DistributeBatchParams {
  orderIds: string[];
  domeAmounts: bigint[];
  clientAmounts: bigint[];
}
