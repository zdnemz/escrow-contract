"use client";

import { useParams } from "next/navigation";
import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt, useSignTypedData } from "wagmi";
import { formatEther } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { StateMachine } from "@/components/StateMachine";
import { CountdownTimer } from "@/components/CountdownTimer";
import { EventTimeline } from "@/components/escrow/EventTimeline";
import { ESCROW_ABI, EscrowState, STATE_LABELS, STATE_COLORS, ActionType } from "@/lib/contracts";

export default function EscrowDetailPage() {
    const { address: escrowAddress } = useParams<{ address: string }>();
    const { address: userAddress } = useAccount();
    const { writeContract, data: hash, isPending } = useWriteContract();
    const { isLoading: isTxLoading, isSuccess } = useWaitForTransactionReceipt({ hash });
    const { signTypedDataAsync } = useSignTypedData();

    const [signedAction, setSignedAction] = useState<{
        actionType: number;
        signature: string;
        nonce: bigint;
        deadline: bigint;
    } | null>(null);
    const [isSigning, setIsSigning] = useState(false);

    const contractAddress = escrowAddress as `0x${string}`;

    // Contract reads
    const { data: state, refetch: refetchState } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "state" });
    const { data: escrowAmount } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "escrowAmount" });
    const { data: gasPoolBalance } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "gasPoolBalance" });
    const { data: arbiterFee } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "arbiterFee" });
    const { data: arbiterFeePaid } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "arbiterFeePaid" });
    const { data: buyer } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "buyer" });
    const { data: seller } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "seller" });
    const { data: arbiter } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "arbiter" });
    const { data: deliveryDeadline } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "deliveryDeadline" });
    const { data: reviewDeadline } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "reviewDeadline" });
    const { data: canClaimByTimeout } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "canClaimByTimeout" });
    const { data: canClaimRefundByTimeout } = useReadContract({ address: contractAddress, abi: ESCROW_ABI, functionName: "canClaimRefundByTimeout" });

    // Get nonce for current user's action
    const { data: sellerMarkDeliveredNonce } = useReadContract({
        address: contractAddress,
        abi: ESCROW_ABI,
        functionName: "getNonce",
        args: seller ? [seller, ActionType.MARK_DELIVERED] : undefined,
    });
    const { data: buyerConfirmNonce } = useReadContract({
        address: contractAddress,
        abi: ESCROW_ABI,
        functionName: "getNonce",
        args: buyer ? [buyer, ActionType.CONFIRM_DELIVERY] : undefined,
    });
    const { data: buyerDisputeNonce } = useReadContract({
        address: contractAddress,
        abi: ESCROW_ABI,
        functionName: "getNonce",
        args: buyer ? [buyer, ActionType.RAISE_DISPUTE] : undefined,
    });

    const escrowState = (state ?? 0) as EscrowState;
    const isBuyer = userAddress?.toLowerCase() === buyer?.toLowerCase();
    const isSeller = userAddress?.toLowerCase() === seller?.toLowerCase();
    const isArbiter = userAddress?.toLowerCase() === arbiter?.toLowerCase();
    const hasArbiter = arbiter && arbiter !== "0x0000000000000000000000000000000000000000";

    // Refetch on tx success
    useEffect(() => {
        if (isSuccess) {
            refetchState();
            setSignedAction(null);
        }
    }, [isSuccess, refetchState]);

    // Sign an action for meta-transaction
    const handleSignAction = async (actionType: ActionType, nonce: bigint) => {
        if (!userAddress) return;

        setIsSigning(true);
        try {
            const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

            const signature = await signTypedDataAsync({
                domain: {
                    name: "Escrow",
                    version: "1",
                    chainId: 31337, // Hardhat
                    verifyingContract: contractAddress,
                },
                types: {
                    EscrowAction: [
                        { name: "actionType", type: "uint8" },
                        { name: "nonce", type: "uint256" },
                        { name: "deadline", type: "uint256" },
                    ],
                },
                primaryType: "EscrowAction",
                message: {
                    actionType,
                    nonce,
                    deadline,
                },
            });

            setSignedAction({ actionType, signature, nonce, deadline });
        } catch (error) {
            console.error("Signing failed:", error);
        } finally {
            setIsSigning(false);
        }
    };

    // Arbiter submits meta-transaction
    const handleSubmitMetaTx = (functionName: "metaMarkDelivered" | "metaConfirmDelivery" | "metaDispute", signer?: `0x${string}`) => {
        if (!signedAction) return;

        if (functionName === "metaDispute" && signer) {
            writeContract({
                address: contractAddress,
                abi: ESCROW_ABI,
                functionName: "metaDispute",
                args: [signer, signedAction.signature as `0x${string}`, signedAction.nonce, signedAction.deadline],
            });
        } else {
            writeContract({
                address: contractAddress,
                abi: ESCROW_ABI,
                functionName,
                args: [signedAction.signature as `0x${string}`, signedAction.nonce, signedAction.deadline],
            });
        }
    };

    // Direct timeout claims (don't need meta-tx)
    const handleDirectAction = (functionName: "claimByTimeout" | "claimRefundByTimeout") => {
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
                                {escrowAmount ? formatEther(escrowAmount) : "0"} <span className="text-slate-500 text-xl">ETH</span>
                            </p>
                        </div>
                        <span className={`text-sm px-3 py-1.5 rounded-full bg-slate-800 ${STATE_COLORS[escrowState]}`}>
                            {STATE_LABELS[escrowState]}
                        </span>
                    </div>

                    {/* Gas Pool & Fee Info */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg">
                            <span className="text-xs text-slate-500">Gas Pool</span>
                            <p className="font-mono text-sm">{gasPoolBalance ? formatEther(gasPoolBalance) : "0"} ETH</p>
                        </div>
                        <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg">
                            <span className="text-xs text-slate-500">Arbiter Fee</span>
                            <p className="font-mono text-sm">{arbiterFee ? formatEther(arbiterFee) : "0"} ETH</p>
                        </div>
                        <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg">
                            <span className="text-xs text-slate-500">Fee Status</span>
                            <p className={`text-sm font-medium ${arbiterFeePaid ? "text-teal-400" : "text-slate-400"}`}>
                                {arbiterFeePaid ? "✓ Paid" : "Pending"}
                            </p>
                        </div>
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
                            <span className="text-xs text-slate-500">Arbiter/Relayer</span>
                            <p className="font-mono text-sm truncate">{arbiter}</p>
                            {isArbiter && <span className="text-xs text-amber-500">(You)</span>}
                        </div>
                    </div>

                    {/* Meta-Transaction Info Banner */}
                    {(isSeller || isBuyer) && !isArbiter && escrowState !== EscrowState.COMPLETE && escrowState !== EscrowState.REFUNDED && (
                        <div className="mb-6 p-4 bg-purple-900/20 border border-purple-800/50 rounded-xl">
                            <p className="text-sm text-purple-300">
                                ✨ <strong>Gasless Transactions:</strong> Sign the action, then the arbiter will submit it on-chain for you.
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="space-y-3">
                        {/* Seller: Sign Mark Delivered */}
                        {isSeller && escrowState === EscrowState.FUNDED && (
                            <div className="space-y-2">
                                <button
                                    onClick={() => handleSignAction(ActionType.MARK_DELIVERED, sellerMarkDeliveredNonce ?? BigInt(0))}
                                    disabled={isSigning || signedAction?.actionType === ActionType.MARK_DELIVERED}
                                    className="w-full px-6 py-4 bg-amber-600 hover:bg-amber-500 rounded-xl font-medium transition-colors disabled:opacity-50"
                                >
                                    {isSigning ? "Signing..." : signedAction?.actionType === ActionType.MARK_DELIVERED ? "✓ Signed - Awaiting Submission" : "Sign: Mark as Delivered"}
                                </button>
                                {signedAction?.actionType === ActionType.MARK_DELIVERED && (
                                    <p className="text-xs text-center text-slate-500">
                                        Signature ready! Ask the arbiter to submit it, or wait for automatic relay.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Buyer: Sign Confirm Delivery */}
                        {isBuyer && escrowState === EscrowState.DELIVERED && (
                            <button
                                onClick={() => handleSignAction(ActionType.CONFIRM_DELIVERY, buyerConfirmNonce ?? BigInt(0))}
                                disabled={isSigning || signedAction?.actionType === ActionType.CONFIRM_DELIVERY}
                                className="w-full px-6 py-4 bg-teal-600 hover:bg-teal-500 rounded-xl font-medium transition-colors disabled:opacity-50"
                            >
                                {isSigning ? "Signing..." : signedAction?.actionType === ActionType.CONFIRM_DELIVERY ? "✓ Signed - Awaiting Submission" : "Sign: Confirm Delivery"}
                            </button>
                        )}

                        {/* Buyer: Sign Dispute */}
                        {isBuyer && escrowState === EscrowState.DELIVERED && hasArbiter && (
                            <button
                                onClick={() => handleSignAction(ActionType.RAISE_DISPUTE, buyerDisputeNonce ?? BigInt(0))}
                                disabled={isSigning || signedAction?.actionType === ActionType.RAISE_DISPUTE}
                                className="w-full px-6 py-4 bg-rose-600/20 border border-rose-600/50 hover:bg-rose-600/30 rounded-xl font-medium text-rose-400 transition-colors disabled:opacity-50"
                            >
                                {isSigning ? "Signing..." : signedAction?.actionType === ActionType.RAISE_DISPUTE ? "✓ Signed - Awaiting Submission" : "Sign: Raise Dispute"}
                            </button>
                        )}

                        {/* Arbiter: Submit pending signatures */}
                        {isArbiter && signedAction && (
                            <div className="p-4 border border-amber-600/50 bg-amber-900/20 rounded-xl space-y-3">
                                <p className="text-sm text-amber-300">
                                    📝 Pending signature to submit:
                                </p>
                                <div className="text-xs bg-slate-900 p-3 rounded font-mono break-all">
                                    Action: {["Mark Delivered", "Confirm Delivery", "Request Refund", "Raise Dispute"][signedAction.actionType]}<br />
                                    Nonce: {signedAction.nonce.toString()}<br />
                                    Signature: {signedAction.signature.slice(0, 20)}...
                                </div>
                                <button
                                    onClick={() => {
                                        if (signedAction.actionType === ActionType.MARK_DELIVERED) handleSubmitMetaTx("metaMarkDelivered");
                                        else if (signedAction.actionType === ActionType.CONFIRM_DELIVERY) handleSubmitMetaTx("metaConfirmDelivery");
                                        else if (signedAction.actionType === ActionType.RAISE_DISPUTE) handleSubmitMetaTx("metaDispute", buyer);
                                    }}
                                    disabled={isPending || isTxLoading}
                                    className="w-full px-6 py-3 bg-amber-600 hover:bg-amber-500 rounded-lg font-medium transition-colors disabled:opacity-50"
                                >
                                    {isPending || isTxLoading ? "Submitting..." : "Submit Meta-Transaction"}
                                </button>
                            </div>
                        )}

                        {/* Auto-release (anyone can call) */}
                        {canClaimByTimeout && (
                            <button
                                onClick={() => handleDirectAction("claimByTimeout")}
                                disabled={isPending || isTxLoading}
                                className="w-full px-6 py-4 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors disabled:opacity-50"
                            >
                                Claim by Timeout (Release to Seller)
                            </button>
                        )}

                        {/* Auto-refund (buyer only) */}
                        {canClaimRefundByTimeout && isBuyer && (
                            <button
                                onClick={() => handleDirectAction("claimRefundByTimeout")}
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
