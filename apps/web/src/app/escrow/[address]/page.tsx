"use client";

import { useParams } from "next/navigation";
import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt } from "wagmi";
import { formatEther } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { StateMachine } from "@/components/StateMachine";
import { CountdownTimer } from "@/components/CountdownTimer";
import { EventTimeline } from "@/components/escrow/EventTimeline";
import { ESCROW_ABI, EscrowState, STATE_LABELS, STATE_COLORS } from "@/lib/contracts";

export default function EscrowDetailPage() {
    const { address: escrowAddress } = useParams<{ address: string }>();
    const { address: userAddress } = useAccount();
    const { writeContract, data: hash, isPending } = useWriteContract();
    const { isLoading: isTxLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

    const contractAddress = escrowAddress as `0x${string}`;

    // Contract reads
    const { data: state, refetch: refetchState } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "state" });
    const { data: amount } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "amount" });
    const { data: buyer } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "buyer" });
    const { data: seller } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "seller" });
    const { data: arbiter } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "arbiter" });
    const { data: deliveryDeadline } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "deliveryDeadline" });
    const { data: reviewDeadline } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "reviewDeadline" });
    const { data: canClaimByTimeout } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "canClaimByTimeout" });
    const { data: canClaimRefundByTimeout } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "canClaimRefundByTimeout" });

    const escrowState = (state ?? 0) as EscrowState;
    const isBuyer = userAddress?.toLowerCase() === buyer?.toLowerCase();
    const isSeller = userAddress?.toLowerCase() === seller?.toLowerCase();
    const isArbiter = userAddress?.toLowerCase() === arbiter?.toLowerCase();
    const hasArbiter = arbiter && arbiter !== "0x0000000000000000000000000000000000000000";

    // Refetch on tx success
    if (isSuccess) {
        refetchState();
    }

    const handleAction = (functionName: "markDelivered" | "confirmDelivery" | "dispute" | "claimByTimeout" | "claimRefundByTimeout") => {
        writeContract({
            address: contractAddress,
            abi: ESCROW_ABI,
            functionName,
        });
    };

    const handleResolveDispute = (winner: `0x${string}`) => {
        writeContract({
            address: contractAddress,
            abi: ESCROW_ABI,
            functionName: "resolveDispute",
            args: [winner],
        });
    };

    return (
        <div className="min-h-screen">
            <Header />
            <main className="pt-24 pb-16 px-6 max-w-4xl mx-auto">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                    {/* Header */}
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <p className="text-xs text-slate-500 font-mono mb-1">{escrowAddress}</p>
                            <p className="text-4xl font-bold">
                                {amount ? formatEther(amount) : "0"} <span className="text-slate-500 text-xl">ETH</span>
                            </p>
                        </div>
                        <span className={`text-sm px-3 py-1.5 rounded-full bg-slate-800 ${STATE_COLORS[escrowState]}`}>
                            {STATE_LABELS[escrowState]}
                        </span>
                    </div>

                    {/* State Machine */}
                    <div className="mb-8 p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                        <StateMachine currentState={escrowState} />
                    </div>

                    {/* Timers */}
                    <AnimatePresence>
                        {escrowState === EscrowState.FUNDED && deliveryDeadline && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-6 p-4 bg-amber-900/20 border border-amber-800/50 rounded-xl"
                            >
                                <CountdownTimer deadline={deliveryDeadline} label="Delivery Deadline" />
                                <p className="text-xs text-slate-500 mt-2">
                                    Seller must mark delivery before deadline or buyer can claim refund.
                                </p>
                            </motion.div>
                        )}

                        {escrowState === EscrowState.DELIVERED && reviewDeadline && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-6 p-4 bg-blue-900/20 border border-blue-800/50 rounded-xl"
                            >
                                <CountdownTimer deadline={reviewDeadline} label="Review Period" />
                                <p className="text-xs text-slate-500 mt-2">
                                    If buyer doesn't respond, funds will auto-release to seller.
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Participants */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                            <span className="text-xs text-slate-500">Buyer</span>
                            <p className="font-mono text-sm truncate">{buyer}</p>
                            {isBuyer && <span className="text-xs text-amber-500">(You)</span>}
                        </div>
                        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                            <span className="text-xs text-slate-500">Seller</span>
                            <p className="font-mono text-sm truncate">{seller}</p>
                            {isSeller && <span className="text-xs text-amber-500">(You)</span>}
                        </div>
                        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                            <span className="text-xs text-slate-500">Arbiter</span>
                            <p className="font-mono text-sm truncate">{arbiter}</p>
                            {isArbiter && <span className="text-xs text-amber-500">(You)</span>}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        {/* Seller: Mark Delivered */}
                        {isSeller && escrowState === EscrowState.FUNDED && (
                            <button
                                onClick={() => handleAction("markDelivered")}
                                disabled={isPending || isTxLoading}
                                className="w-full px-6 py-4 bg-amber-600 hover:bg-amber-500 rounded-xl font-medium transition-colors disabled:opacity-50"
                            >
                                {isPending || isTxLoading ? "Processing..." : "Mark as Delivered"}
                            </button>
                        )}

                        {/* Buyer: Confirm Delivery */}
                        {isBuyer && escrowState === EscrowState.DELIVERED && (
                            <button
                                onClick={() => handleAction("confirmDelivery")}
                                disabled={isPending || isTxLoading}
                                className="w-full px-6 py-4 bg-teal-600 hover:bg-teal-500 rounded-xl font-medium transition-colors disabled:opacity-50"
                            >
                                {isPending || isTxLoading ? "Processing..." : "Confirm Delivery"}
                            </button>
                        )}

                        {/* Buyer: Dispute - only if arbiter is set */}
                        {isBuyer && escrowState === EscrowState.DELIVERED && hasArbiter && (
                            <button
                                onClick={() => handleAction("dispute")}
                                disabled={isPending || isTxLoading}
                                className="w-full px-6 py-4 bg-rose-600/20 border border-rose-600/50 hover:bg-rose-600/30 rounded-xl font-medium text-rose-400 transition-colors disabled:opacity-50"
                            >
                                {isPending || isTxLoading ? "Processing..." : "Raise Dispute"}
                            </button>
                        )}

                        {/* No arbiter warning */}
                        {isBuyer && escrowState === EscrowState.DELIVERED && !hasArbiter && (
                            <div className="px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-sm text-slate-500">
                                No arbiter assigned — disputes are not available for this escrow
                            </div>
                        )}

                        {/* Auto-release */}
                        {canClaimByTimeout && (
                            <button
                                onClick={() => handleAction("claimByTimeout")}
                                disabled={isPending || isTxLoading}
                                className="w-full px-6 py-4 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors disabled:opacity-50"
                            >
                                Claim by Timeout (Release to Seller)
                            </button>
                        )}

                        {/* Auto-refund */}
                        {canClaimRefundByTimeout && isBuyer && (
                            <button
                                onClick={() => handleAction("claimRefundByTimeout")}
                                disabled={isPending || isTxLoading}
                                className="w-full px-6 py-4 bg-rose-600 hover:bg-rose-500 rounded-xl font-medium transition-colors disabled:opacity-50 text-white shadow-lg shadow-rose-900/20"
                            >
                                Claim Refund (Seller Missed Deadline)
                            </button>
                        )}

                        {/* Arbiter: Resolve Dispute */}
                        {isArbiter && escrowState === EscrowState.DISPUTED && (
                            <div className="border border-slate-700 bg-slate-900/50 rounded-xl p-6 space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs px-2 py-1 bg-rose-600/20 border border-rose-600/50 rounded text-rose-400 font-medium">DISPUTED</span>
                                    <h3 className="text-lg font-semibold text-slate-200">Resolve Dispute</h3>
                                </div>
                                <p className="text-sm text-slate-400">
                                    As the arbiter, decide who receives the escrowed funds:
                                </p>
                                <div className="space-y-2 text-xs font-mono">
                                    <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg">
                                        <span className="text-slate-500">Buyer</span>
                                        <span className="text-slate-300">{buyer?.slice(0, 10)}...{buyer?.slice(-8)}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg">
                                        <span className="text-slate-500">Seller</span>
                                        <span className="text-slate-300">{seller?.slice(0, 10)}...{seller?.slice(-8)}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <button
                                        onClick={() => handleResolveDispute(buyer!)}
                                        disabled={isPending || isTxLoading}
                                        className="px-6 py-4 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-xl font-medium transition-colors disabled:opacity-50"
                                    >
                                        Award to Buyer
                                    </button>
                                    <button
                                        onClick={() => handleResolveDispute(seller!)}
                                        disabled={isPending || isTxLoading}
                                        className="px-6 py-4 bg-amber-600 hover:bg-amber-500 rounded-xl font-medium transition-colors disabled:opacity-50 text-white"
                                    >
                                        Award to Seller
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Tx Status */}
                    <AnimatePresence>
                        {hash && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="mt-6 p-4 bg-slate-800 rounded-xl text-sm"
                            >
                                <p className="text-slate-400">
                                    Tx: <span className="font-mono text-xs">{hash.slice(0, 20)}...</span>
                                </p>
                                {isTxLoading && <p className="text-amber-400">Confirming...</p>}
                                {isSuccess && <p className="text-teal-400">Confirmed!</p>}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <EventTimeline address={contractAddress} />
                </motion.div>
            </main>
        </div>
    );
}
