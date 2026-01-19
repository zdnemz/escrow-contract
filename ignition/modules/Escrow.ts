import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "viem";

const EscrowModule = buildModule("EscrowModule", (m) => {
    // Deploy the Factory
    const escrowFactory = m.contract("EscrowFactory");

    // Optional: Deploy a single Escrow instance for testing/demo
    // Parameters can be passed via --parameters or default values used here
    // To deploy a specific Escrow, we need addresses.
    // For local dev, we can access accounts via parameter or hardcode for testing.

    // Example of deploying a specific Escrow (commented out by default to prefer Factory usage):
    /*
    const buyer = m.getAccount(0);
    const seller = m.getAccount(1);
    const arbiter = m.getAccount(2);
    const amount = m.getParameter("amount", parseEther("1"));
  
    const escrow = m.contract("Escrow", [buyer, seller, arbiter, amount], {
      value: amount,
    });
    */

    return { escrowFactory };
});

export default EscrowModule;
