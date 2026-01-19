"use client";

import { Header } from "@/components/Header";
import { EscrowList } from "@/components/dashboard/EscrowList";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-16 px-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-end justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2">Escrow Protocol</h1>
              <p className="text-slate-400 max-w-xl">
                Dispute-minimized, trustless escrow with deadline-based auto-resolution.
              </p>
            </div>
          </div>

          {!isConnected ? (
            <div className="p-12 border border-dashed border-slate-700 bg-slate-900/30 rounded-xl text-center">
              <h3 className="text-lg font-medium text-slate-300 mb-2">Connect Wallet</h3>
              <p className="text-slate-500 mb-6">Connect your wallet to view your active escrows.</p>
            </div>
          ) : (
            <EscrowList />
          )}
        </motion.div>
      </main>
    </div>
  );
}
