// Escrow Contract ABI and Factory ABI
// Extracted from Hardhat artifacts

export const ESCROW_ABI = [
  { inputs: [{ name: "_buyer", type: "address" }, { name: "_seller", type: "address" }, { name: "_arbiter", type: "address" }, { name: "_amount", type: "uint256" }, { name: "_deliveryDeadline", type: "uint256" }, { name: "_reviewPeriod", type: "uint256" }], stateMutability: "payable", type: "constructor" },
  { inputs: [], name: "DeliveryDeadlineNotPassed", type: "error" },
  { inputs: [], name: "DeliveryDeadlinePassed", type: "error" },
  { inputs: [], name: "FailedCall", type: "error" },
  { inputs: [{ name: "sent", type: "uint256" }, { name: "expected", type: "uint256" }], name: "IncorrectAmount", type: "error" },
  { inputs: [{ name: "current", type: "uint8" }, { name: "expected", type: "uint8" }], name: "InvalidState", type: "error" },
  { inputs: [], name: "InvalidWinner", type: "error" },
  { inputs: [], name: "NoArbiterSet", type: "error" },
  { inputs: [], name: "OnlyArbiter", type: "error" },
  { inputs: [], name: "OnlyBuyer", type: "error" },
  { inputs: [], name: "OnlyBuyerOrSeller", type: "error" },
  { inputs: [], name: "OnlySeller", type: "error" },
  { inputs: [], name: "ReentrancyGuardReentrantCall", type: "error" },
  { inputs: [], name: "ReviewPeriodEnded", type: "error" },
  { inputs: [], name: "ReviewPeriodNotEnded", type: "error" },
  { anonymous: false, inputs: [{ indexed: true, name: "caller", type: "address" }, { indexed: false, name: "amount", type: "uint256" }], name: "AutoRefunded", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "caller", type: "address" }, { indexed: false, name: "amount", type: "uint256" }], name: "AutoReleased", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "buyer", type: "address" }], name: "DeliveryConfirmed", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "seller", type: "address" }, { indexed: false, name: "timestamp", type: "uint256" }], name: "DeliveryMarked", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "buyer", type: "address" }, { indexed: false, name: "amount", type: "uint256" }], name: "Deposited", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "caller", type: "address" }], name: "DisputeOpened", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "arbiter", type: "address" }, { indexed: false, name: "winner", type: "address" }, { indexed: false, name: "amount", type: "uint256" }], name: "DisputeResolved", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "caller", type: "address" }, { indexed: false, name: "amount", type: "uint256" }], name: "Refunded", type: "event" },
  { inputs: [], name: "amount", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "arbiter", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "buyer", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "canClaimByTimeout", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "canClaimRefundByTimeout", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "claimByTimeout", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "claimRefundByTimeout", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "confirmDelivery", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "deliveredAt", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "deliveryDeadline", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "deposit", outputs: [], stateMutability: "payable", type: "function" },
  { inputs: [], name: "dispute", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "markDelivered", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "refund", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "winner", type: "address" }], name: "resolveDispute", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "reviewDeadline", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "reviewPeriod", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "seller", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "state", outputs: [{ name: "", type: "uint8" }], stateMutability: "view", type: "function" },
] as const;

export const FACTORY_ABI = [
  { anonymous: false, inputs: [{ indexed: true, name: "escrowAddress", type: "address" }, { indexed: true, name: "buyer", type: "address" }, { indexed: true, name: "seller", type: "address" }, { indexed: false, name: "arbiter", type: "address" }, { indexed: false, name: "amount", type: "uint256" }, { indexed: false, name: "deliveryDeadline", type: "uint256" }, { indexed: false, name: "reviewPeriod", type: "uint256" }], name: "EscrowCreated", type: "event" },
  { inputs: [{ name: "_seller", type: "address" }, { name: "_arbiter", type: "address" }, { name: "_deliveryDeadline", type: "uint256" }, { name: "_reviewPeriod", type: "uint256" }], name: "createEscrow", outputs: [{ name: "", type: "address" }], stateMutability: "payable", type: "function" },
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
