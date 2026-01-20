// Escrow Contract ABI and Factory ABI
// Updated for gas abstraction + arbiter fee

export const ESCROW_ABI = [
  // Constructor
  { inputs: [{ name: "_buyer", type: "address" }, { name: "_seller", type: "address" }, { name: "_arbiter", type: "address" }, { name: "_escrowAmount", type: "uint256" }, { name: "_deliveryDeadline", type: "uint256" }, { name: "_reviewPeriod", type: "uint256" }, { name: "_maxGasPrice", type: "uint256" }, { name: "_maxGasPerAction", type: "uint256" }, { name: "_arbiterFee", type: "uint256" }], stateMutability: "payable", type: "constructor" },

  // Errors
  { inputs: [], name: "ArbiterFeeAlreadyPaid", type: "error" },
  { inputs: [], name: "DeliveryDeadlineNotPassed", type: "error" },
  { inputs: [], name: "DeliveryDeadlinePassed", type: "error" },
  { inputs: [], name: "FailedCall", type: "error" },
  { inputs: [{ name: "sent", type: "uint256" }, { name: "expected", type: "uint256" }], name: "IncorrectAmount", type: "error" },
  { inputs: [], name: "InsufficientGasPool", type: "error" },
  { inputs: [], name: "InvalidNonce", type: "error" },
  { inputs: [], name: "InvalidSignature", type: "error" },
  { inputs: [], name: "InvalidSigner", type: "error" },
  { inputs: [{ name: "current", type: "uint8" }, { name: "expected", type: "uint8" }], name: "InvalidState", type: "error" },
  { inputs: [], name: "InvalidWinner", type: "error" },
  { inputs: [], name: "NoArbiterSet", type: "error" },
  { inputs: [], name: "OnlyArbiter", type: "error" },
  { inputs: [], name: "OnlyBuyer", type: "error" },
  { inputs: [], name: "OnlyBuyerOrSeller", type: "error" },
  { inputs: [], name: "OnlyRelayer", type: "error" },
  { inputs: [], name: "OnlySeller", type: "error" },
  { inputs: [], name: "ReentrancyGuardReentrantCall", type: "error" },
  { inputs: [], name: "ReviewPeriodEnded", type: "error" },
  { inputs: [], name: "ReviewPeriodNotEnded", type: "error" },
  { inputs: [], name: "SignatureExpired", type: "error" },

  // Events
  { anonymous: false, inputs: [{ indexed: true, name: "arbiter", type: "address" }, { indexed: false, name: "amount", type: "uint256" }], name: "ArbiterFeePaid", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "caller", type: "address" }, { indexed: false, name: "amount", type: "uint256" }], name: "AutoRefunded", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "caller", type: "address" }, { indexed: false, name: "amount", type: "uint256" }], name: "AutoReleased", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "buyer", type: "address" }], name: "DeliveryConfirmed", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "seller", type: "address" }, { indexed: false, name: "timestamp", type: "uint256" }], name: "DeliveryMarked", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "buyer", type: "address" }, { indexed: false, name: "escrowAmount", type: "uint256" }, { indexed: false, name: "gasPool", type: "uint256" }], name: "Deposited", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "initiator", type: "address" }], name: "DisputeOpened", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "arbiter", type: "address" }, { indexed: false, name: "winner", type: "address" }, { indexed: false, name: "amount", type: "uint256" }], name: "DisputeResolved", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "buyer", type: "address" }, { indexed: false, name: "amount", type: "uint256" }], name: "GasPoolRefunded", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "relayer", type: "address" }, { indexed: false, name: "amount", type: "uint256" }], name: "GasReimbursed", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "signer", type: "address" }, { indexed: false, name: "actionType", type: "uint8" }, { indexed: false, name: "nonce", type: "uint256" }], name: "MetaActionExecuted", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "initiator", type: "address" }, { indexed: false, name: "amount", type: "uint256" }], name: "Refunded", type: "event" },

  // View Functions
  { inputs: [], name: "arbiter", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "arbiterFee", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "arbiterFeePaid", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "buyer", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "canClaimByTimeout", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "canClaimRefundByTimeout", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "deliveredAt", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "deliveryDeadline", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "escrowAmount", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "gasPoolBalance", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "actionType", type: "uint8" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }], name: "getActionDigest", outputs: [{ name: "", type: "bytes32" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "getDomainSeparator", outputs: [{ name: "", type: "bytes32" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "signer", type: "address" }, { name: "actionType", type: "uint8" }], name: "getNonce", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "maxGasPerAction", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "maxGasPrice", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "", type: "address" }, { name: "", type: "uint8" }], name: "nonces", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "reviewDeadline", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "reviewPeriod", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "seller", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "state", outputs: [{ name: "", type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "ESCROW_ACTION_TYPEHASH", outputs: [{ name: "", type: "bytes32" }], stateMutability: "view", type: "function" },

  // Direct Write Functions (Timeout claims still work without meta-tx)
  { inputs: [], name: "claimByTimeout", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "claimRefundByTimeout", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "_gasPool", type: "uint256" }], name: "deposit", outputs: [], stateMutability: "payable", type: "function" },
  { inputs: [{ name: "winner", type: "address" }], name: "resolveDispute", outputs: [], stateMutability: "nonpayable", type: "function" },

  // Meta-Transaction Functions (called by relayer/arbiter)
  { inputs: [{ name: "signature", type: "bytes" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }], name: "metaMarkDelivered", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "signature", type: "bytes" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }], name: "metaConfirmDelivery", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "signature", type: "bytes" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }], name: "metaRefund", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "signer", type: "address" }, { name: "signature", type: "bytes" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }], name: "metaDispute", outputs: [], stateMutability: "nonpayable", type: "function" },
] as const;

export const FACTORY_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "escrowAddress", type: "address" },
      { indexed: true, name: "buyer", type: "address" },
      { indexed: true, name: "seller", type: "address" },
      { indexed: false, name: "arbiter", type: "address" },
      { indexed: false, name: "escrowAmount", type: "uint256" },
      { indexed: false, name: "gasPool", type: "uint256" },
      { indexed: false, name: "arbiterFee", type: "uint256" },
      { indexed: false, name: "maxGasPrice", type: "uint256" },
      { indexed: false, name: "maxGasPerAction", type: "uint256" },
      { indexed: false, name: "deliveryDeadline", type: "uint256" },
      { indexed: false, name: "reviewPeriod", type: "uint256" }
    ],
    name: "EscrowCreated",
    type: "event"
  },
  {
    inputs: [
      { name: "_seller", type: "address" },
      { name: "_arbiter", type: "address" },
      { name: "_escrowAmount", type: "uint256" },
      { name: "_gasPool", type: "uint256" },
      { name: "_arbiterFee", type: "uint256" },
      { name: "_maxGasPrice", type: "uint256" },
      { name: "_maxGasPerAction", type: "uint256" },
      { name: "_deliveryDeadline", type: "uint256" },
      { name: "_reviewPeriod", type: "uint256" }
    ],
    name: "createEscrow",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "payable",
    type: "function"
  },
] as const;

export const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}`;

// State enum matching Solidity
export enum EscrowState {
  AWAITING_PAYMENT = 0,
  FUNDED = 1,
  DELIVERED = 2,
  COMPLETE = 3,
  REFUNDED = 4,
  DISPUTED = 5,
}

// Action types for meta-transactions
export enum ActionType {
  MARK_DELIVERED = 0,
  CONFIRM_DELIVERY = 1,
  REQUEST_REFUND = 2,
  RAISE_DISPUTE = 3,
}

export const STATE_LABELS: Record<EscrowState, string> = {
  [EscrowState.AWAITING_PAYMENT]: "Awaiting Payment",
  [EscrowState.FUNDED]: "Funded",
  [EscrowState.DELIVERED]: "Delivered",
  [EscrowState.COMPLETE]: "Complete",
  [EscrowState.REFUNDED]: "Refunded",
  [EscrowState.DISPUTED]: "Disputed",
};

export const STATE_COLORS: Record<EscrowState, string> = {
  [EscrowState.AWAITING_PAYMENT]: "text-slate-400",
  [EscrowState.FUNDED]: "text-amber-500",
  [EscrowState.DELIVERED]: "text-blue-400",
  [EscrowState.COMPLETE]: "text-teal-500",
  [EscrowState.REFUNDED]: "text-slate-400",
  [EscrowState.DISPUTED]: "text-rose-500",
};

// Default gas configuration
export const DEFAULT_MAX_GAS_PRICE = 100000000000n; // 100 gwei
export const DEFAULT_MAX_GAS_PER_ACTION = 500000n;
