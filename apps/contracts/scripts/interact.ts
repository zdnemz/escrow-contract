import { createPublicClient, createWalletClient, http, parseEther, getAddress, type Hex } from "viem";
import { privateKeyToAccount, signTypedData } from "viem/accounts";
import { hardhat } from "viem/chains";
import fs from "fs";
import path from "path";

const RPC_URL = "http://127.0.0.1:8545";

// Hardhat default account private keys
const BUYER_PRIVATE_KEY: Hex = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const SELLER_PRIVATE_KEY: Hex = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const ARBITER_PRIVATE_KEY: Hex = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

// Action types matching the contract enum
const ActionType = {
    MARK_DELIVERED: 0,
    CONFIRM_DELIVERY: 1,
    REQUEST_REFUND: 2,
    RAISE_DISPUTE: 3,
} as const;

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

/**
 * Sign an EIP-712 escrow action
 */
async function signEscrowAction(
    privateKey: Hex,
    escrowAddress: `0x${string}`,
    actionType: number,
    nonce: bigint,
    deadline: bigint
): Promise<Hex> {
    const domain = {
        name: "Escrow",
        version: "1",
        chainId: 31337,
        verifyingContract: escrowAddress,
    };

    const types = {
        EscrowAction: [
            { name: "actionType", type: "uint8" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
        ],
    };

    const message = {
        actionType,
        nonce,
        deadline,
    };

    return await signTypedData({
        privateKey,
        domain,
        types,
        primaryType: "EscrowAction",
        message,
    });
}

async function main() {
    console.log("=== Gas Abstracted Escrow with Arbiter Fee - Interaction Script ===\n");

    // Setup accounts
    const account0 = privateKeyToAccount(BUYER_PRIVATE_KEY);
    const account1 = privateKeyToAccount(SELLER_PRIVATE_KEY);
    const account2 = privateKeyToAccount(ARBITER_PRIVATE_KEY);

    const publicClient = createPublicClient({ chain: hardhat, transport: http(RPC_URL) });
    const buyer = createWalletClient({ account: account0, chain: hardhat, transport: http(RPC_URL) });
    const seller = createWalletClient({ account: account1, chain: hardhat, transport: http(RPC_URL) });
    const arbiter = createWalletClient({ account: account2, chain: hardhat, transport: http(RPC_URL) });

    console.log(`Buyer: ${buyer.account.address}`);
    console.log(`Seller: ${seller.account.address}`);
    console.log(`Arbiter/Relayer: ${arbiter.account.address}`);

    // Deploy Factory
    console.log("\n--- Deploying Factory ---");
    const factoryArtifact = getArtifact("EscrowFactory");
    const hash = await buyer.deployContract({ abi: factoryArtifact.abi, bytecode: factoryArtifact.bytecode });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) throw new Error("Factory deployment failed");
    const factoryAddress = getAddress(receipt.contractAddress);
    console.log(`EscrowFactory deployed at: ${factoryAddress}`);

    // Run Scenarios
    await runMetaTxHappyPath(factoryAddress, buyer, seller, arbiter, publicClient);
    await runAutoReleaseScenario(factoryAddress, buyer, seller, arbiter, publicClient);
    await runAutoRefundScenario(factoryAddress, buyer, seller, arbiter, publicClient);
    await runDisputeScenario(factoryAddress, buyer, seller, arbiter, publicClient);

    console.log("\n=== All Scenarios Complete ===");
}

async function createEscrowViaFactory(
    factoryAddress: any, buyer: any, seller: any, arbiter: any, publicClient: any,
    escrowAmount: bigint, gasPool: bigint, arbiterFee: bigint,
    maxGasPrice: bigint, maxGasPerAction: bigint,
    deliveryDeadline: bigint, reviewPeriod: bigint
) {
    const factoryArtifact = getArtifact("EscrowFactory");
    const totalValue = escrowAmount + gasPool + arbiterFee;

    const { request } = await publicClient.simulateContract({
        address: factoryAddress,
        abi: factoryArtifact.abi,
        functionName: "createEscrow",
        args: [
            seller.account.address,
            arbiter.account.address,
            escrowAmount,
            gasPool,
            arbiterFee,
            maxGasPrice,
            maxGasPerAction,
            deliveryDeadline,
            reviewPeriod
        ],
        account: buyer.account,
        value: totalValue
    });
    const hash = await buyer.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    for (const log of receipt.logs) {
        if (log.address.toLowerCase() === factoryAddress.toLowerCase() && log.topics.length >= 4) {
            return getAddress("0x" + log.topics[1]?.slice(26)) as `0x${string}`;
        }
    }
    throw new Error("Escrow address not found in logs");
}

async function runMetaTxHappyPath(factoryAddress: any, buyer: any, seller: any, arbiter: any, publicClient: any) {
    console.log("\n--- Scenario 1: Meta-Tx Happy Path (Fund → metaMarkDelivered → metaConfirmDelivery) ---");

    const escrowAmount = parseEther("1.0");
    const gasPool = parseEther("0.05");
    const arbiterFee = parseEther("0.01");
    const maxGasPrice = parseEther("0.0000001"); // 100 gwei
    const maxGasPerAction = 500000n;

    const now = await getBlockTimestamp(publicClient);
    const deliveryDeadline = now + 3600n; // 1 hour
    const reviewPeriod = 600n; // 10 minutes

    const escrowAddress = await createEscrowViaFactory(
        factoryAddress, buyer, seller, arbiter, publicClient,
        escrowAmount, gasPool, arbiterFee, maxGasPrice, maxGasPerAction,
        deliveryDeadline, reviewPeriod
    );
    console.log(`Escrow created at: ${escrowAddress}`);
    console.log(`  - Escrow Amount: ${escrowAmount} wei`);
    console.log(`  - Gas Pool: ${gasPool} wei`);
    console.log(`  - Arbiter Fee: ${arbiterFee} wei`);

    const escrowArtifact = getArtifact("Escrow");

    // Check state
    let state = await publicClient.readContract({ address: escrowAddress, abi: escrowArtifact.abi, functionName: "state" });
    console.log(`State: ${state} (Expected 1: FUNDED)`);

    // Seller signs markDelivered off-chain
    console.log("Seller signing markDelivered off-chain...");
    const sellerNonce = await publicClient.readContract({
        address: escrowAddress, abi: escrowArtifact.abi,
        functionName: "getNonce", args: [seller.account.address, ActionType.MARK_DELIVERED]
    });
    const signatureDeadline = now + 3600n;
    const markDeliveredSig = await signEscrowAction(
        SELLER_PRIVATE_KEY, escrowAddress, ActionType.MARK_DELIVERED, sellerNonce as bigint, signatureDeadline
    );

    // Arbiter (relayer) submits metaMarkDelivered
    console.log("Arbiter submitting metaMarkDelivered...");
    const { request: markReq } = await publicClient.simulateContract({
        address: escrowAddress, abi: escrowArtifact.abi,
        functionName: "metaMarkDelivered",
        args: [markDeliveredSig, sellerNonce, signatureDeadline],
        account: arbiter.account
    });
    await arbiter.writeContract(markReq);

    state = await publicClient.readContract({ address: escrowAddress, abi: escrowArtifact.abi, functionName: "state" });
    console.log(`State: ${state} (Expected 2: DELIVERED)`);

    // Buyer signs confirmDelivery off-chain
    console.log("Buyer signing confirmDelivery off-chain...");
    const buyerNonce = await publicClient.readContract({
        address: escrowAddress, abi: escrowArtifact.abi,
        functionName: "getNonce", args: [buyer.account.address, ActionType.CONFIRM_DELIVERY]
    });
    const confirmSig = await signEscrowAction(
        BUYER_PRIVATE_KEY, escrowAddress, ActionType.CONFIRM_DELIVERY, buyerNonce as bigint, signatureDeadline
    );

    // Arbiter (relayer) submits metaConfirmDelivery
    console.log("Arbiter submitting metaConfirmDelivery...");
    const { request: confirmReq } = await publicClient.simulateContract({
        address: escrowAddress, abi: escrowArtifact.abi,
        functionName: "metaConfirmDelivery",
        args: [confirmSig, buyerNonce, signatureDeadline],
        account: arbiter.account
    });
    await arbiter.writeContract(confirmReq);

    state = await publicClient.readContract({ address: escrowAddress, abi: escrowArtifact.abi, functionName: "state" });
    console.log(`State: ${state} (Expected 3: COMPLETE)`);

    // Check arbiter fee was paid
    const arbiterFeePaid = await publicClient.readContract({ address: escrowAddress, abi: escrowArtifact.abi, functionName: "arbiterFeePaid" });
    console.log(`Arbiter fee paid: ${arbiterFeePaid} (Expected: true)`);
}

async function runAutoReleaseScenario(factoryAddress: any, buyer: any, seller: any, arbiter: any, publicClient: any) {
    console.log("\n--- Scenario 2: Auto-Release (Silent Buyer) ---");

    const escrowAmount = parseEther("0.5");
    const gasPool = parseEther("0.02");
    const arbiterFee = parseEther("0.005");
    const maxGasPrice = parseEther("0.0000001");
    const maxGasPerAction = 500000n;

    const now = await getBlockTimestamp(publicClient);
    const deliveryDeadline = now + 3600n;
    const reviewPeriod = 2n; // 2 seconds for testing

    const escrowAddress = await createEscrowViaFactory(
        factoryAddress, buyer, seller, arbiter, publicClient,
        escrowAmount, gasPool, arbiterFee, maxGasPrice, maxGasPerAction,
        deliveryDeadline, reviewPeriod
    );
    console.log(`Escrow created at: ${escrowAddress}`);

    const escrowArtifact = getArtifact("Escrow");

    // Seller signs and arbiter submits markDelivered
    const sellerNonce = await publicClient.readContract({
        address: escrowAddress, abi: escrowArtifact.abi,
        functionName: "getNonce", args: [seller.account.address, ActionType.MARK_DELIVERED]
    });
    const signatureDeadline = now + 3600n;
    const markDeliveredSig = await signEscrowAction(
        SELLER_PRIVATE_KEY, escrowAddress, ActionType.MARK_DELIVERED, sellerNonce as bigint, signatureDeadline
    );

    const { request: markReq } = await publicClient.simulateContract({
        address: escrowAddress, abi: escrowArtifact.abi,
        functionName: "metaMarkDelivered",
        args: [markDeliveredSig, sellerNonce, signatureDeadline],
        account: arbiter.account
    });
    await arbiter.writeContract(markReq);
    console.log("Seller marked delivery via meta-tx. Advancing time past review period...");

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

    const arbiterFeePaid = await publicClient.readContract({ address: escrowAddress, abi: escrowArtifact.abi, functionName: "arbiterFeePaid" });
    console.log(`Arbiter fee paid: ${arbiterFeePaid}`);
}

async function runAutoRefundScenario(factoryAddress: any, buyer: any, seller: any, arbiter: any, publicClient: any) {
    console.log("\n--- Scenario 3: Auto-Refund (Silent Seller) ---");

    const escrowAmount = parseEther("0.3");
    const gasPool = parseEther("0.01");
    const arbiterFee = parseEther("0.003");
    const maxGasPrice = parseEther("0.0000001");
    const maxGasPerAction = 500000n;

    const now = await getBlockTimestamp(publicClient);
    const deliveryDeadline = now + 5n; // 5 seconds for testing
    const reviewPeriod = 600n;

    const escrowAddress = await createEscrowViaFactory(
        factoryAddress, buyer, seller, arbiter, publicClient,
        escrowAmount, gasPool, arbiterFee, maxGasPrice, maxGasPerAction,
        deliveryDeadline, reviewPeriod
    );
    console.log(`Escrow created at: ${escrowAddress}`);

    const escrowArtifact = getArtifact("Escrow");

    console.log("Advancing time past delivery deadline...");
    await advanceTime(10);

    // Buyer claims refund
    console.log("Buyer claiming refund by timeout...");
    const { request: claimReq } = await publicClient.simulateContract({
        address: escrowAddress, abi: escrowArtifact.abi, functionName: "claimRefundByTimeout", account: buyer.account
    });
    await buyer.writeContract(claimReq);

    const state = await publicClient.readContract({ address: escrowAddress, abi: escrowArtifact.abi, functionName: "state" });
    console.log(`State: ${state} (Expected 4: REFUNDED - Auto-refunded to buyer)`);

    const arbiterFeePaid = await publicClient.readContract({ address: escrowAddress, abi: escrowArtifact.abi, functionName: "arbiterFeePaid" });
    console.log(`Arbiter fee paid: ${arbiterFeePaid}`);
}

async function runDisputeScenario(factoryAddress: any, buyer: any, seller: any, arbiter: any, publicClient: any) {
    console.log("\n--- Scenario 4: Dispute Path (Meta-Tx) ---");

    const escrowAmount = parseEther("0.2");
    const gasPool = parseEther("0.01");
    const arbiterFee = parseEther("0.002");
    const maxGasPrice = parseEther("0.0000001");
    const maxGasPerAction = 500000n;

    const now = await getBlockTimestamp(publicClient);
    const deliveryDeadline = now + 3600n;
    const reviewPeriod = 600n;

    const escrowAddress = await createEscrowViaFactory(
        factoryAddress, buyer, seller, arbiter, publicClient,
        escrowAmount, gasPool, arbiterFee, maxGasPrice, maxGasPerAction,
        deliveryDeadline, reviewPeriod
    );
    console.log(`Escrow created at: ${escrowAddress}`);

    const escrowArtifact = getArtifact("Escrow");
    const signatureDeadline = now + 3600n;

    // Seller marks delivery via meta-tx
    const sellerNonce = await publicClient.readContract({
        address: escrowAddress, abi: escrowArtifact.abi,
        functionName: "getNonce", args: [seller.account.address, ActionType.MARK_DELIVERED]
    });
    const markDeliveredSig = await signEscrowAction(
        SELLER_PRIVATE_KEY, escrowAddress, ActionType.MARK_DELIVERED, sellerNonce as bigint, signatureDeadline
    );
    const { request: markReq } = await publicClient.simulateContract({
        address: escrowAddress, abi: escrowArtifact.abi,
        functionName: "metaMarkDelivered",
        args: [markDeliveredSig, sellerNonce, signatureDeadline],
        account: arbiter.account
    });
    await arbiter.writeContract(markReq);

    // Buyer raises dispute via meta-tx
    console.log("Buyer signing dispute off-chain...");
    const buyerNonce = await publicClient.readContract({
        address: escrowAddress, abi: escrowArtifact.abi,
        functionName: "getNonce", args: [buyer.account.address, ActionType.RAISE_DISPUTE]
    });
    const disputeSig = await signEscrowAction(
        BUYER_PRIVATE_KEY, escrowAddress, ActionType.RAISE_DISPUTE, buyerNonce as bigint, signatureDeadline
    );

    console.log("Arbiter submitting metaDispute...");
    const { request: disputeReq } = await publicClient.simulateContract({
        address: escrowAddress, abi: escrowArtifact.abi,
        functionName: "metaDispute",
        args: [buyer.account.address, disputeSig, buyerNonce, signatureDeadline],
        account: arbiter.account
    });
    await arbiter.writeContract(disputeReq);

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

    const arbiterFeePaid = await publicClient.readContract({ address: escrowAddress, abi: escrowArtifact.abi, functionName: "arbiterFeePaid" });
    console.log(`Arbiter fee paid: ${arbiterFeePaid}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
