"use client";

import { useReadContract } from "wagmi";
import { formatEther } from "viem";
import { motion } from "framer-motion";
import Link from "next/link";
import { ESCROW_ABI, EscrowState, STATE_LABELS, STATE_COLORS } from "@/lib/contracts";
import { StateMachine } from "./StateMachine";

interface EscrowCardProps {
  address: `0x${string}`;
}

export function EscrowCard({ address }: EscrowCardProps) {
  const { data: state } = useReadContract({
    address,
    abi: ESCROW_ABI,
    functionName: "state",
  });

  const { data: escrowAmount } = useReadContract({
    address,
    abi: ESCROW_ABI,
    functionName: "escrowAmount",
  });

  const { data: gasPoolBalance } = useReadContract({
    address,
    abi: ESCROW_ABI,
    functionName: "gasPoolBalance",
  });

  const { data: arbiterFee } = useReadContract({
    address,
    abi: ESCROW_ABI,
    functionName: "arbiterFee",
  });

  const { data: arbiterFeePaid } = useReadContract({
    address,
    abi: ESCROW_ABI,
    functionName: "arbiterFeePaid",
  });

  const { data: buyer } = useReadContract({
    address,
    abi: ESCROW_ABI,
    functionName: "buyer",
  });

  const { data: seller } = useReadContract({
    address,
    abi: ESCROW_ABI,
    functionName: "seller",
  });

  const escrowState = (state ?? 0) as EscrowState;

  return (
    <Link href={`/escrow/${address}`}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        className="p-5 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors cursor-pointer"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-slate-500 font-mono mb-1">
              {address.slice(0, 10)}...{address.slice(-8)}
            </p>
            <p className="text-2xl font-semibold">
              {escrowAmount ? formatEther(escrowAmount) : "0"} <span className="text-slate-500 text-base">ETH</span>
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full bg-slate-800 ${STATE_COLORS[escrowState]}`}>
            {STATE_LABELS[escrowState]}
          </span>
        </div>

        <StateMachine currentState={escrowState} />

        <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-500">Buyer</span>
            <p className="font-mono text-slate-400 truncate">{buyer}</p>
          </div>
          <div>
            <span className="text-slate-500">Seller</span>
            <p className="font-mono text-slate-400 truncate">{seller}</p>
          </div>
        </div>

        {/* Gas Abstraction Info */}
        <div className="mt-3 pt-3 border-t border-slate-800/50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-600">Gas Pool:</span>
            <span className="font-mono text-slate-400">
              {gasPoolBalance ? formatEther(gasPoolBalance) : "0"} ETH
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-600">Fee:</span>
            {arbiterFeePaid ? (
              <span className="text-teal-500">✓ Paid</span>
            ) : (
              <span className="font-mono text-slate-400">
                {arbiterFee ? formatEther(arbiterFee) : "0"} ETH
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
