import { createPublicClient, createWalletClient, http, parseEther, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import fs from "fs";
import path from "path";

// Helper to read artifacts
function getArtifact(contractName: string) {
    const artifactPath = path.join(process.cwd(), "artifacts", "contracts", `${contractName}.sol`, `${contractName}.json`);
    return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

const RPC_URL = "http://127.0.0.1:8545";

async function main() {
    console.log("--- Starting Escrow Interaction Script (Standalone) ---");

    // 1. Setup Clients
    // Hardhat Node Accounts (Default #0, #1, #2)
    const account0 = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"); // Buyer
    const account1 = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"); // Seller
    const account2 = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"); // Arbiter

    const publicClient = createPublicClient({
        chain: hardhat,
        transport: http(RPC_URL)
    });

    const buyer = createWalletClient({ account: account0, chain: hardhat, transport: http(RPC_URL) });
    const seller = createWalletClient({ account: account1, chain: hardhat, transport: http(RPC_URL) });
    const arbiter = createWalletClient({ account: account2, chain: hardhat, transport: http(RPC_URL) });

    console.log(`Buyer: ${buyer.account.address}`);
    console.log(`Seller: ${seller.account.address}`);
    console.log(`Arbiter: ${arbiter.account.address}`);

    // 2. Deploy Factory
    console.log("\n--- Deploying Factory ---");
    const factoryArtifact = getArtifact("EscrowFactory");

    const hash = await buyer.deployContract({
        abi: factoryArtifact.abi,
        bytecode: factoryArtifact.bytecode,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (!receipt.contractAddress) throw new Error("Factory deployment failed");
    const factoryAddress = getAddress(receipt.contractAddress);
    console.log(`EscrowFactory deployed at: ${factoryAddress}`);

    // 3. Run Scenarios
    await runScenario1(factoryAddress, buyer, seller, arbiter, publicClient);
    await runScenario2(factoryAddress, buyer, seller, arbiter, publicClient);

    console.log("\n--- All Scenarios Finished Successfully ---");
}

async function runScenario1(factoryAddress: any, buyer: any, seller: any, arbiter: any, publicClient: any) {
    console.log("\n--- Scenario 1: Happy Path (Deposit -> Release) ---");
    const amount1 = parseEther("1.0");
    const factoryArtifact = getArtifact("EscrowFactory");

    // Call createEscrow
    const { request } = await publicClient.simulateContract({
        address: factoryAddress,
        abi: factoryArtifact.abi,
        functionName: "createEscrow",
        args: [seller.account.address, arbiter.account.address],
        account: buyer.account,
        value: amount1
    });
    const hash1 = await buyer.writeContract(request);
    const receipt1 = await publicClient.waitForTransactionReceipt({ hash: hash1 });

    // Find Escrow Created address from logs
    // EscrowCreated event from Factory has 3 indexed args (Escrow, Buyer, Seller) -> 4 topics including signature
    let escrowAddress;
    for (const log of receipt1.logs) {
        if (log.address.toLowerCase() === factoryAddress.toLowerCase() && log.topics.length >= 4) {
            escrowAddress = getAddress("0x" + log.topics[1]?.slice(26));
            console.log(`Escrow 1 created at: ${escrowAddress}`);
            break;
        }
    }

    if (!escrowAddress) {
        // Fallback: check other logs if filtering failed logic
        console.log("Logs found:", receipt1.logs);
        throw new Error("Escrow 1 address not found");
    }

    const escrowArtifact = getArtifact("Escrow");

    // Check State
    let state = await publicClient.readContract({
        address: escrowAddress,
        abi: escrowArtifact.abi,
        functionName: "state"
    });
    console.log(`State: ${state} (Expected 1)`);

    // Buyer confirms delivery
    console.log("Buyer confirming delivery...");
    const { request: req2 } = await publicClient.simulateContract({
        address: escrowAddress,
        abi: escrowArtifact.abi,
        functionName: "confirmDelivery",
        account: buyer.account
    });
    await buyer.writeContract(req2);

    // Check State
    state = await publicClient.readContract({
        address: escrowAddress,
        abi: escrowArtifact.abi,
        functionName: "state"
    });
    console.log(`State: ${state} (Expected 2)`);
}

async function runScenario2(factoryAddress: any, buyer: any, seller: any, arbiter: any, publicClient: any) {
    console.log("\n--- Scenario 2: Dispute Path ---");
    const amount2 = parseEther("0.5");
    const factoryArtifact = getArtifact("EscrowFactory");

    const { request } = await publicClient.simulateContract({
        address: factoryAddress,
        abi: factoryArtifact.abi,
        functionName: "createEscrow",
        args: [seller.account.address, arbiter.account.address],
        account: buyer.account,
        value: amount2
    });
    const hash2 = await buyer.writeContract(request);
    const receipt2 = await publicClient.waitForTransactionReceipt({ hash: hash2 });

    let escrowAddress;
    for (const log of receipt2.logs) {
        if (log.address.toLowerCase() === factoryAddress.toLowerCase() && log.topics.length >= 4) {
            escrowAddress = getAddress("0x" + log.topics[1]?.slice(26));
            console.log(`Escrow 2 created at: ${escrowAddress}`);
            break;
        }
    }
    if (!escrowAddress) throw new Error("Escrow 2 address not found");

    const escrowArtifact = getArtifact("Escrow");

    // Dispute
    console.log("Buyer raising dispute...");
    const { request: reqD } = await publicClient.simulateContract({
        address: escrowAddress,
        abi: escrowArtifact.abi,
        functionName: "dispute",
        account: buyer.account
    });
    await buyer.writeContract(reqD);

    // Check State
    let state = await publicClient.readContract({
        address: escrowAddress,
        abi: escrowArtifact.abi,
        functionName: "state"
    });
    console.log(`State: ${state} (Expected 4: DISPUTED)`);

    // Arbiter Resolves
    console.log("Arbiter resolving...");
    const { request: reqR } = await publicClient.simulateContract({
        address: escrowAddress,
        abi: escrowArtifact.abi,
        functionName: "resolveDispute",
        args: [buyer.account.address],
        account: arbiter.account
    });
    await arbiter.writeContract(reqR);

    state = await publicClient.readContract({
        address: escrowAddress,
        abi: escrowArtifact.abi,
        functionName: "state"
    });
    console.log(`State: ${state} (Expected 3: REFUNDED)`);
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
