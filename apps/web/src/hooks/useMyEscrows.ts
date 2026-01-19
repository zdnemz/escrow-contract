"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { FACTORY_ADDRESS } from "@/lib/contracts";

export interface DashboardEscrow {
    address: `0x${string}`;
    role: "buyer" | "seller";
    amount: bigint;
    deliveryDeadline: bigint; // Added for sorting/info
    timestamp: bigint; // Added if we can get block timestamp, otherwise just event block number
}

const EVENT_SIGNATURE = "event EscrowCreated(address indexed escrowAddress, address indexed buyer, address indexed seller, address arbiter, uint256 amount, uint256 deliveryDeadline, uint256 reviewPeriod)";

export function useMyEscrows() {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const [escrows, setEscrows] = useState<DashboardEscrow[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        async function fetchEscrows() {
            if (!address || !publicClient) return;

            setIsLoading(true);
            try {
                // Get current block for bounded range (public RPCs limit to ~1000 blocks)
                const currentBlock = await publicClient.getBlockNumber();
                const fromBlock = currentBlock > BigInt(1000) ? currentBlock - BigInt(1000) : BigInt(0);

                // Fetch where user is buyer
                const buyerLogs = await publicClient.getLogs({
                    address: FACTORY_ADDRESS,
                    event: parseAbiItem(EVENT_SIGNATURE),
                    args: { buyer: address },
                    fromBlock
                });

                // Fetch where user is seller
                const sellerLogs = await publicClient.getLogs({
                    address: FACTORY_ADDRESS,
                    event: parseAbiItem(EVENT_SIGNATURE),
                    args: { seller: address },
                    fromBlock
                });

                const newEscrows: DashboardEscrow[] = [];

                for (const log of buyerLogs) {
                    const args = (log as any).args;
                    let ts = BigInt(0);
                    if (log.blockNumber) {
                        const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
                        ts = block.timestamp;
                    }

                    newEscrows.push({
                        address: args.escrowAddress,
                        role: "buyer",
                        amount: args.amount,
                        deliveryDeadline: args.deliveryDeadline,
                        timestamp: ts,
                    });
                }

                for (const log of sellerLogs) {
                    const args = (log as any).args;
                    if (!newEscrows.find(e => e.address === args.escrowAddress)) {
                        let ts = BigInt(0);
                        if (log.blockNumber) {
                            const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
                            ts = block.timestamp;
                        }

                        newEscrows.push({
                            address: args.escrowAddress,
                            role: "seller",
                            amount: args.amount,
                            deliveryDeadline: args.deliveryDeadline,
                            timestamp: ts,
                        });
                    }
                }

                // Reverse to show newest first (based on order in logs array generally, or block number)
                setEscrows(newEscrows.reverse());

            } catch (error) {
                console.error("Failed to fetch escrows:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchEscrows();
    }, [address, publicClient]);

    return { escrows, isLoading };
}
