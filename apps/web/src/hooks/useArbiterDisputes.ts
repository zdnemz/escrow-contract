"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { FACTORY_ADDRESS, ESCROW_ABI, EscrowState } from "@/lib/contracts";

export interface DisputedEscrow {
    address: `0x${string}`;
    buyer: `0x${string}`;
    seller: `0x${string}`;
    amount: bigint;
    timestamp: bigint;
}

const EVENT_SIGNATURE = "event EscrowCreated(address indexed escrowAddress, address indexed buyer, address indexed seller, address arbiter, uint256 amount, uint256 deliveryDeadline, uint256 reviewPeriod)";

export function useArbiterDisputes() {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const [disputes, setDisputes] = useState<DisputedEscrow[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        async function fetchDisputes() {
            if (!address || !publicClient) return;

            setIsLoading(true);
            try {
                // Get current block for bounded range (public RPCs limit to ~1000 blocks)
                const currentBlock = await publicClient.getBlockNumber();
                const fromBlock = currentBlock > BigInt(1000) ? currentBlock - BigInt(1000) : BigInt(0);

                // Fetch escrows where user is arbiter
                const logs = await publicClient.getLogs({
                    address: FACTORY_ADDRESS,
                    event: parseAbiItem(EVENT_SIGNATURE) as any,
                    args: { arbiter: address },
                    fromBlock
                });

                const disputedEscrows: DisputedEscrow[] = [];

                // Check state of each escrow
                for (const log of logs) {
                    const args = (log as any).args;
                    const escrowAddress = args.escrowAddress as `0x${string}`;

                    // Read current state
                    const state = await publicClient.readContract({
                        address: escrowAddress,
                        abi: ESCROW_ABI,
                        functionName: "state"
                    }) as number;

                    // Only include if disputed
                    if (state === EscrowState.DISPUTED) {
                        let ts = BigInt(0);
                        if (log.blockNumber) {
                            const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
                            ts = block.timestamp;
                        }

                        disputedEscrows.push({
                            address: escrowAddress,
                            buyer: args.buyer,
                            seller: args.seller,
                            amount: args.amount,
                            timestamp: ts,
                        });
                    }
                }

                setDisputes(disputedEscrows.reverse()); // Newest first

            } catch (error) {
                console.error("Failed to fetch disputes:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchDisputes();
    }, [address, publicClient]);

    return { disputes, isLoading };
}
