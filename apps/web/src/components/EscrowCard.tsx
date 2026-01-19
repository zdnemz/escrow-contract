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

  const { data: amount } = useReadContract({
    address,
    abi: ESCROW_ABI,
    functionName: "amount",
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
              {amount ? formatEther(amount) : "0"} <span className="text-slate-500 text-base">ETH</span>
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
      </motion.div>
    </Link>
  );
}
