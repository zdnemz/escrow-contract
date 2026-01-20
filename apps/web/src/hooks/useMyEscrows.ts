"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { decodeEventLog, parseAbiItem } from "viem";
import { FACTORY_ADDRESS, FACTORY_ABI } from "@/lib/contracts";

export interface DashboardEscrow {
    address: `0x${string}`;
    role: "buyer" | "seller";
    escrowAmount: bigint;
    gasPool: bigint;
    arbiterFee: bigint;
    deliveryDeadline: bigint;
    timestamp: bigint;
}

export function useMyEscrows() {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const [escrows, setEscrows] = useState<DashboardEscrow[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        async function fetchEscrows() {
            if (!address || !publicClient) {
                console.log("[useMyEscrows] No address or publicClient");
                return;
            }

            if (!FACTORY_ADDRESS) {
                console.error("[useMyEscrows] FACTORY_ADDRESS not set");
                return;
            }

            console.log("[useMyEscrows] Fetching for address:", address);
            console.log("[useMyEscrows] Factory address:", FACTORY_ADDRESS);

            setIsLoading(true);
            try {
                // Get current block for bounded range
                const currentBlock = await publicClient.getBlockNumber();
                const fromBlock = currentBlock > BigInt(10000) ? currentBlock - BigInt(10000) : BigInt(0);

                console.log("[useMyEscrows] Scanning from block:", fromBlock.toString(), "to:", currentBlock.toString());

                // Fetch ALL EscrowCreated events from factory, then filter client-side
                const logs = await publicClient.getLogs({
                    address: FACTORY_ADDRESS,
                    event: {
                        type: 'event',
                        name: 'EscrowCreated',
                        inputs: [
                            { type: 'address', name: 'escrowAddress', indexed: true },
                            { type: 'address', name: 'buyer', indexed: true },
                            { type: 'address', name: 'seller', indexed: true },
                            { type: 'address', name: 'arbiter', indexed: false },
                            { type: 'uint256', name: 'escrowAmount', indexed: false },
                            { type: 'uint256', name: 'gasPool', indexed: false },
                            { type: 'uint256', name: 'arbiterFee', indexed: false },
                            { type: 'uint256', name: 'maxGasPrice', indexed: false },
                            { type: 'uint256', name: 'maxGasPerAction', indexed: false },
                            { type: 'uint256', name: 'deliveryDeadline', indexed: false },
                            { type: 'uint256', name: 'reviewPeriod', indexed: false },
                        ],
                    },
                    fromBlock
                });

                console.log("[useMyEscrows] Found", logs.length, "EscrowCreated events");

                const newEscrows: DashboardEscrow[] = [];
                const userAddressLower = address.toLowerCase();

                for (const log of logs) {
                    const args = (log as any).args;
                    if (!args) {
                        console.log("[useMyEscrows] Log missing args:", log);
                        continue;
                    }

                    const buyerAddr = (args.buyer as string)?.toLowerCase();
                    const sellerAddr = (args.seller as string)?.toLowerCase();

                    console.log("[useMyEscrows] Event - Escrow:", args.escrowAddress, "Buyer:", buyerAddr, "Seller:", sellerAddr);

                    // Check if user is buyer or seller
                    let role: "buyer" | "seller" | null = null;
                    if (buyerAddr === userAddressLower) {
                        role = "buyer";
                    } else if (sellerAddr === userAddressLower) {
                        role = "seller";
                    }

                    if (role) {
                        let ts = BigInt(0);
                        if (log.blockNumber) {
                            try {
                                const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
                                ts = block.timestamp;
                            } catch (e) {
                                console.warn("Failed to get block timestamp");
                            }
                        }

                        newEscrows.push({
                            address: args.escrowAddress as `0x${string}`,
                            role,
                            escrowAmount: args.escrowAmount ?? BigInt(0),
                            gasPool: args.gasPool ?? BigInt(0),
                            arbiterFee: args.arbiterFee ?? BigInt(0),
                            deliveryDeadline: args.deliveryDeadline ?? BigInt(0),
                            timestamp: ts,
                        });
                    }
                }

                console.log("[useMyEscrows] User escrows found:", newEscrows.length);

                // Sort by timestamp descending (newest first)
                newEscrows.sort((a, b) => Number(b.timestamp - a.timestamp));
                setEscrows(newEscrows);

            } catch (error) {
                console.error("[useMyEscrows] Failed to fetch escrows:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchEscrows();
    }, [address, publicClient]);

    return { escrows, isLoading };
}
