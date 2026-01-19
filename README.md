# Trustless Smart Contract Escrow

A production-grade, trustless Escrow system built on Ethereum using Solidity and Hardhat.

## Features

- **Trustless**: No centralized intermediary holding funds.
- **Roles**: Buyer, Seller, Arbiter.
- **Dispute Resolution**: Arbiter can resolve disputes if delivery is contested.
- **Security**: Reentrancy protection, State machine logic, Immutable participants.

## Contracts

- `Escrow.sol`: The core escrow logic.
- `EscrowFactory.sol`: Factory to easily deploy new Escrow instances.

## Prerequisites

- Node.js v18+
- Hardhat v3

## Installation

```bash
npm install
```

## Usage

### Compile

```bash
npx hardhat compile
```

### Interact

Run the interact script:

```bash
npx hardhat run scripts/interact.ts --network localhost
```

> **Note**: Ensure your environment is set up for ESM. You might need to adjust `package.json` dependencies if you encounter `ERR_PACKAGE_PATH_NOT_EXPORTED` (downgrade Chai or fix imports).

### Deployment

Deploy to a network (e.g. Sepolia):

```bash
npx hardhat ignition deploy ./ignition/modules/Escrow.ts --network localhost
```

## Architecture

### State Machine
```
AWAITING_PAYMENT → FUNDED → DELIVERED → COMPLETE | REFUNDED
                                       ↘ DISPUTED → COMPLETE | REFUNDED
```

### Lifecycle
1. **Initialization**: Buyer deploys via Factory with `deliveryDeadline` and `reviewPeriod`.
2. **Funded**: Funds locked in `FUNDED` state.
3. **Delivery**: Seller calls `markDelivered()` before deadline.
4. **Review**: Buyer has `reviewPeriod` to approve, dispute, or timeout.
5. **Outcomes**:
   - `confirmDelivery()` → Seller paid
   - `claimByTimeout()` → Seller paid (buyer silent)
   - `dispute()` → Arbiter decides
   - `claimRefundByTimeout()` → Buyer refunded (seller silent)
