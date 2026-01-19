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

### Test

Run the unit tests:

```bash
npx hardhat test
```

> **Note**: Ensure your environment is set up for ESM. You might need to adjust `package.json` dependencies if you encounter `ERR_PACKAGE_PATH_NOT_EXPORTED` (downgrade Chai or fix imports).

### Deployment

Deploy to a network (e.g. Sepolia):

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

## Architecture

1. **Initialization**: Buyer (or Factory) deploys contract with `value` (ETH).
2. **Locked**: Funds are held in `AWAITING_DELIVERY`.
3. **Release**: Buyer calls `confirmDelivery()` -> Seller gets paid.
4. **Refund**: Seller calls `refund()` -> Buyer gets paid.
5. **Dispute**: Buyer or Seller calls `dispute()` -> Funds locked for Arbiter.
6. **Resolution**: Arbiter calls `resolveDispute(winner)`.
