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
                // Fetch where user is buyer
                const buyerLogs = await publicClient.getLogs({
                    address: FACTORY_ADDRESS,
                    event: parseAbiItem(EVENT_SIGNATURE),
                    args: { buyer: address },
                    fromBlock: "earliest"
                });

                // Fetch where user is seller
                const sellerLogs = await publicClient.getLogs({
                    address: FACTORY_ADDRESS,
                    event: parseAbiItem(EVENT_SIGNATURE),
                    args: { seller: address },
                    fromBlock: "earliest"
                });

                const newEscrows: DashboardEscrow[] = [];

                for (const log of buyerLogs) {
                    // args is typed loosely by viem by default when using parseAbiItem, but we know the structure
                    const args = (log as any).args;
                    newEscrows.push({
                        address: args.escrowAddress,
                        role: "buyer",
                        amount: args.amount,
                        deliveryDeadline: args.deliveryDeadline,
                        timestamp: BigInt(0), // Placeholder
                    });
                }

                for (const log of sellerLogs) {
                    const args = (log as any).args;
                    // Deduplicate if user is both buyer and seller (unlikely but possible in testing)
                    if (!newEscrows.find(e => e.address === args.escrowAddress)) {
                        newEscrows.push({
                            address: args.escrowAddress,
                            role: "seller",
                            amount: args.amount,
                            deliveryDeadline: args.deliveryDeadline,
                            timestamp: BigInt(0),
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
