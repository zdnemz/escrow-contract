"use client";

import { useMyEscrows } from "@/hooks/useMyEscrows";
import { EscrowCard } from "@/components/EscrowCard";
import { motion } from "framer-motion";

export function EscrowList() {
  const { escrows, isLoading } = useMyEscrows();

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500">Scanning blockchain events...</p>
      </div>
    );
  }

  if (escrows.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
        <p className="text-slate-500 mb-2">No escrows found</p>
        <p className="text-sm text-slate-600">Create one to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Your Escrows</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {escrows.map((escrow) => (
            <div key={escrow.address} className="relative group">
              <div className="absolute -top-2 -right-2 z-10">
                <span className={`
                  px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border shadow-sm
                  ${escrow.role === 'buyer' ? 'bg-indigo-900 border-indigo-700 text-indigo-200' : 'bg-emerald-900 border-emerald-700 text-emerald-200'}
                `}>
                  {escrow.role}
                </span>
              </div>
              <EscrowCard address={escrow.address} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
