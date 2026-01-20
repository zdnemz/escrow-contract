import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const EscrowModule = buildModule("EscrowModule", (m) => {
    // Deploy the Factory
    const escrowFactory = m.contract("EscrowFactory");

  // The factory is the main deployment artifact.
  // Individual escrows are created via the factory's createEscrow() function.
  //
  // Parameters for createEscrow():
  // - _seller: address
  // - _arbiter: address (also acts as relayer)
  // - _escrowAmount: uint256
  // - _gasPool: uint256
  // - _arbiterFee: uint256
  // - _maxGasPrice: uint256
  // - _maxGasPerAction: uint256
  // - _deliveryDeadline: uint256
  // - _reviewPeriod: uint256
  //
  // msg.value must equal: _escrowAmount + _gasPool + _arbiterFee

    return { escrowFactory };
});

export default EscrowModule;
