"use client";

import Link from "next/link";
import { formatEther } from "viem";
import { motion } from "framer-motion";
import type { DisputedEscrow } from "@/hooks/useArbiterDisputes";

interface DisputesListProps {
    disputes: DisputedEscrow[];
}

export function DisputesList({ disputes }: DisputesListProps) {
    if (disputes.length === 0) {
        return (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
                <p className="text-slate-500 mb-2">No active disputes</p>
                <p className="text-sm text-slate-600">Disputed escrows will appear here</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
                Pending Disputes ({disputes.length})
            </h2>
            <div className="grid gap-4">
                {disputes.map((dispute, idx) => (
                    <motion.div
                        key={dispute.address}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="border border-slate-800 bg-slate-900/50 rounded-xl p-6 hover:border-slate-700 transition-colors"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs px-2 py-1 bg-rose-600/20 border border-rose-600/50 rounded text-rose-400 font-medium">
                                        DISPUTED
                                    </span>
                                    <span className="text-lg font-mono font-bold text-slate-200">
                                        {formatEther(dispute.amount)} ETH
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 font-mono">
                                    {dispute.address}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Buyer:</span>
                                <span className="font-mono text-xs text-slate-300">
                                    {dispute.buyer.slice(0, 10)}...{dispute.buyer.slice(-8)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Seller:</span>
                                <span className="font-mono text-xs text-slate-300">
                                    {dispute.seller.slice(0, 10)}...{dispute.seller.slice(-8)}
                                </span>
                            </div>
                        </div>

                        <Link
                            href={`/escrow/${dispute.address}`}
                            className="block w-full text-center px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
                        >
                            View & Resolve
                        </Link>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
