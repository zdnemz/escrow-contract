import { createPublicClient, createWalletClient, http, parseEther, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import fs from "fs";
import path from "path";

const RPC_URL = "http://127.0.0.1:8545";

function getArtifact(contractName: string) {
    const artifactPath = path.join(process.cwd(), "artifacts", "contracts", `${contractName}.sol`, `${contractName}.json`);
    return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

/**
 * Advance blockchain time by specified seconds (Hardhat specific)
 */
async function advanceTime(seconds: number) {
    await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "evm_increaseTime", params: [seconds], id: 1 })
    });
    await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "evm_mine", params: [], id: 2 })
    });
}

/**
 * Get current blockchain timestamp
 */
async function getBlockTimestamp(publicClient: any): Promise<bigint> {
    const block = await publicClient.getBlock();
    return block.timestamp;
}

async function main() {
    console.log("=== Dispute-Minimized Escrow Interaction Script ===\n");

    // Setup accounts
    const account0 = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
    const account1 = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
    const account2 = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");

    const publicClient = createPublicClient({ chain: hardhat, transport: http(RPC_URL) });
    const buyer = createWalletClient({ account: account0, chain: hardhat, transport: http(RPC_URL) });
    const seller = createWalletClient({ account: account1, chain: hardhat, transport: http(RPC_URL) });
    const arbiter = createWalletClient({ account: account2, chain: hardhat, transport: http(RPC_URL) });

    console.log(`Buyer: ${buyer.account.address}`);
    console.log(`Seller: ${seller.account.address}`);
    console.log(`Arbiter: ${arbiter.account.address}`);

    // Deploy Factory
    console.log("\n--- Deploying Factory ---");
    const factoryArtifact = getArtifact("EscrowFactory");
    const hash = await buyer.deployContract({ abi: factoryArtifact.abi, bytecode: factoryArtifact.bytecode });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) throw new Error("Factory deployment failed");
    const factoryAddress = getAddress(receipt.contractAddress);
    console.log(`EscrowFactory deployed at: ${factoryAddress}`);

    // Run Scenarios
    await runHappyPath(factoryAddress, buyer, seller, arbiter, publicClient);
    await runAutoReleaseScenario(factoryAddress, buyer, seller, arbiter, publicClient);
    await runAutoRefundScenario(factoryAddress, buyer, seller, arbiter, publicClient);
    await runDisputeScenario(factoryAddress, buyer, seller, arbiter, publicClient);

    console.log("\n=== All Scenarios Complete ===");
}

async function createEscrowViaFactory(
    factoryAddress: any, buyer: any, seller: any, arbiter: any, publicClient: any,
    amount: bigint, deliveryDeadline: bigint, reviewPeriod: bigint
) {
    const factoryArtifact = getArtifact("EscrowFactory");
    const { request } = await publicClient.simulateContract({
        address: factoryAddress,
        abi: factoryArtifact.abi,
        functionName: "createEscrow",
        args: [seller.account.address, arbiter.account.address, deliveryDeadline, reviewPeriod],
        account: buyer.account,
        value: amount
    });
    const hash = await buyer.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    for (const log of receipt.logs) {
        if (log.address.toLowerCase() === factoryAddress.toLowerCase() && log.topics.length >= 4) {
            return getAddress("0x" + log.topics[1]?.slice(26));
        }
    }
    throw new Error("Escrow address not found in logs");
}

async function runHappyPath(factoryAddress: any, buyer: any, seller: any, arbiter: any, publicClient: any) {
    console.log("\n--- Scenario 1: Happy Path (Fund → Deliver → Confirm) ---");
    const amount = parseEther("1.0");
    const now = await getBlockTimestamp(publicClient);
    const deliveryDeadline = now + 3600n; // 1 hour
    const reviewPeriod = 600n; // 10 minutes

    const escrowAddress = await createEscrowViaFactory(
        factoryAddress, buyer, seller, arbiter, publicClient, amount, deliveryDeadline, reviewPeriod
    );
    console.log(`Escrow created at: ${escrowAddress}`);

    const escrowArtifact = getArtifact("Escrow");

    // Check state
    let state = await publicClient.readContract({ address: escrowAddress, abi: escrowArtifact.abi, functionName: "state" });
    console.log(`State: ${state} (Expected 1: FUNDED)`);

    // Seller marks delivery
    console.log("Seller marking delivery...");
    const { request: markReq } = await publicClient.simulateContract({
        address: escrowAddress, abi: escrowArtifact.abi, functionName: "markDelivered", account: seller.account
    });
    await seller.writeContract(markReq);

    state = await publicClient.readContract({ address: escrowAddress, abi: escrowArtifact.abi, functionName: "state" });
    console.log(`State: ${state} (Expected 2: DELIVERED)`);

    // Buyer confirms
    console.log("Buyer confirming delivery...");
    const { request: confirmReq } = await publicClient.simulateContract({
        address: escrowAddress, abi: escrowArtifact.abi, functionName: "confirmDelivery", account: buyer.account
    });
    await buyer.writeContract(confirmReq);

    state = await publicClient.readContract({ address: escrowAddress, abi: escrowArtifact.abi, functionName: "state" });
    console.log(`State: ${state} (Expected 3: COMPLETE)`);
}

async function runAutoReleaseScenario(factoryAddress: any, buyer: any, seller: any, arbiter: any, publicClient: any) {
    console.log("\n--- Scenario 2: Auto-Release (Silent Buyer) ---");
    const amount = parseEther("0.5");
    const now = await getBlockTimestamp(publicClient);
    const deliveryDeadline = now + 3600n;
    const reviewPeriod = 2n; // 2 seconds for testing

    const escrowAddress = await createEscrowViaFactory(
        factoryAddress, buyer, seller, arbiter, publicClient, amount, deliveryDeadline, reviewPeriod
    );
    console.log(`Escrow created at: ${escrowAddress}`);

    const escrowArtifact = getArtifact("Escrow");

    // Seller marks delivery
    const { request: markReq } = await publicClient.simulateContract({
        address: escrowAddress, abi: escrowArtifact.abi, functionName: "markDelivered", account: seller.account
    });
    await seller.writeContract(markReq);
    console.log("Seller marked delivery. Advancing time past review period...");

    // Advance blockchain time past review period
    await advanceTime(5);

    // Anyone can claim by timeout
    console.log("Claiming by timeout...");
    const { request: claimReq } = await publicClient.simulateContract({
        address: escrowAddress, abi: escrowArtifact.abi, functionName: "claimByTimeout", account: seller.account
    });
    await seller.writeContract(claimReq);

    const state = await publicClient.readContract({ address: escrowAddress, abi: escrowArtifact.abi, functionName: "state" });
    console.log(`State: ${state} (Expected 3: COMPLETE - Auto-released to seller)`);
}

async function runAutoRefundScenario(factoryAddress: any, buyer: any, seller: any, arbiter: any, publicClient: any) {
    console.log("\n--- Scenario 3: Auto-Refund (Silent Seller) ---");
    const amount = parseEther("0.3");
    const now = await getBlockTimestamp(publicClient);
    const deliveryDeadline = now + 5n; // 5 seconds for testing
    const reviewPeriod = 600n;

    const escrowAddress = await createEscrowViaFactory(
        factoryAddress, buyer, seller, arbiter, publicClient, amount, deliveryDeadline, reviewPeriod
    );
    console.log(`Escrow created at: ${escrowAddress}`);

    const escrowArtifact = getArtifact("Escrow");

    console.log("Advancing time past delivery deadline...");
    await advanceTime(5);

    // Buyer claims refund
    console.log("Buyer claiming refund by timeout...");
    const { request: claimReq } = await publicClient.simulateContract({
        address: escrowAddress, abi: escrowArtifact.abi, functionName: "claimRefundByTimeout", account: buyer.account
    });
    await buyer.writeContract(claimReq);

    const state = await publicClient.readContract({ address: escrowAddress, abi: escrowArtifact.abi, functionName: "state" });
    console.log(`State: ${state} (Expected 4: REFUNDED - Auto-refunded to buyer)`);
}

async function runDisputeScenario(factoryAddress: any, buyer: any, seller: any, arbiter: any, publicClient: any) {
    console.log("\n--- Scenario 4: Dispute Path ---");
    const amount = parseEther("0.2");
    const now = await getBlockTimestamp(publicClient);
    const deliveryDeadline = now + 3600n;
    const reviewPeriod = 600n;

    const escrowAddress = await createEscrowViaFactory(
        factoryAddress, buyer, seller, arbiter, publicClient, amount, deliveryDeadline, reviewPeriod
    );
    console.log(`Escrow created at: ${escrowAddress}`);

    const escrowArtifact = getArtifact("Escrow");

    // Seller marks delivery
    const { request: markReq } = await publicClient.simulateContract({
        address: escrowAddress, abi: escrowArtifact.abi, functionName: "markDelivered", account: seller.account
    });
    await seller.writeContract(markReq);

    // Buyer disputes
    console.log("Buyer raising dispute...");
    const { request: disputeReq } = await publicClient.simulateContract({
        address: escrowAddress, abi: escrowArtifact.abi, functionName: "dispute", account: buyer.account
    });
    await buyer.writeContract(disputeReq);

    let state = await publicClient.readContract({ address: escrowAddress, abi: escrowArtifact.abi, functionName: "state" });
    console.log(`State: ${state} (Expected 5: DISPUTED)`);

    // Arbiter resolves in favor of buyer
    console.log("Arbiter resolving dispute (refund to buyer)...");
    const { request: resolveReq } = await publicClient.simulateContract({
        address: escrowAddress, abi: escrowArtifact.abi, functionName: "resolveDispute",
        args: [buyer.account.address], account: arbiter.account
    });
    await arbiter.writeContract(resolveReq);

    state = await publicClient.readContract({ address: escrowAddress, abi: escrowArtifact.abi, functionName: "state" });
    console.log(`State: ${state} (Expected 4: REFUNDED)`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
