"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, isAddress } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import { FACTORY_ABI, FACTORY_ADDRESS } from "@/lib/contracts";
import { useBlockTimestamp } from "@/hooks/useBlockTimestamp";

export function CreateEscrowForm() {
  const blockTime = useBlockTimestamp();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    seller: "",
    arbiter: "",
    amount: "",
    deliveryDeadline: "",
    reviewPeriod: "3600", // Default 1 hour
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isTxLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

  const validateStep1 = () => {
    return isAddress(formData.seller) && 
           (!formData.arbiter || isAddress(formData.arbiter)) &&
           Number(formData.amount) > 0;
  };

  const validateStep2 = () => {
    const deadline = new Date(formData.deliveryDeadline).getTime();
    return deadline > Number(blockTime) * 1000;
  };

  const handleCreate = () => {
    const deadlineTimestamp = BigInt(Math.floor(new Date(formData.deliveryDeadline).getTime() / 1000));
    const reviewDuration = BigInt(formData.reviewPeriod);
    const amountWei = parseEther(formData.amount);
    
    // Default arbiter to zero address if empty
    const arbiterAddr = formData.arbiter ? formData.arbiter : "0x0000000000000000000000000000000000000000";

    writeContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: "createEscrow",
      args: [formData.seller as `0x${string}`, arbiterAddr as `0x${string}`, deadlineTimestamp, reviewDuration],
      value: amountWei,
    });
  };

  if (isSuccess) {
    return (
      <div className="p-8 text-center border border-teal-800 bg-teal-900/20 rounded-xl">
        <h2 className="text-2xl font-bold text-teal-400 mb-2">Escrow Created!</h2>
        <p className="text-slate-400 mb-6">Your transaction has been confirmed.</p>
        <div className="p-4 bg-slate-900 rounded-lg font-mono text-xs break-all mb-6">
          Tx: {hash}
        </div>
        <a href="/" className="px-6 py-3 bg-teal-600 hover:bg-teal-500 rounded-lg font-medium transition-colors">
          Return Home
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              s <= step ? "bg-amber-500" : "bg-slate-800"
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Seller Address</label>
              <input
                type="text"
                placeholder="0x..."
                value={formData.seller}
                onChange={(e) => setFormData({ ...formData, seller: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-amber-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Arbiter Address (Optional)</label>
              <input
                type="text"
                placeholder="0x... (Leave empty for no dispute resolution)"
                value={formData.arbiter}
                onChange={(e) => setFormData({ ...formData, arbiter: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-amber-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Amount (ETH)</label>
              <input
                type="number"
                placeholder="0.0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-amber-500 outline-none font-mono"
              />
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={!validateStep1()}
              className="w-full py-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
            >
              Next: Set Deadlines
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Delivery Deadline</label>
              <input
                type="datetime-local"
                value={formData.deliveryDeadline}
                onChange={(e) => setFormData({ ...formData, deliveryDeadline: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-amber-500 outline-none text-slate-200"
              />
              <p className="text-xs text-slate-500 mt-2">
                If seller fails to deliver by this time, you can claim an auto-refund.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Review Period</label>
              <select
                value={formData.reviewPeriod}
                onChange={(e) => setFormData({ ...formData, reviewPeriod: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-amber-500 outline-none"
              >
                <option value="300">5 Minutes (Test)</option>
                <option value="3600">1 Hour</option>
                <option value="86400">24 Hours</option>
                <option value="604800">7 Days</option>
              </select>
              <p className="text-xs text-slate-500 mt-2">
                Time you have to inspect the work after delivery. If you don't act, funds auto-release.
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!validateStep2()}
                className="flex-1 py-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
              >
                Next: Review
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl space-y-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Amount</span>
                <span className="font-mono text-amber-400">{formData.amount} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Seller</span>
                <span className="font-mono text-xs">{formData.seller}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Arbiter</span>
                <span className="font-mono text-xs">{formData.arbiter || "None (Trustless)"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Delivery By</span>
                <span className="text-sm">{new Date(formData.deliveryDeadline).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Review Period</span>
                <span className="text-sm">{Number(formData.reviewPeriod) / 3600} Hours</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(2)}
                disabled={isPending || isTxLoading}
                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={isPending || isTxLoading}
                className="flex-[2] py-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
              >
                {isPending ? "Confirming..." : isTxLoading ? "Deploying..." : "Create Escrow"}
              </button>
            </div>
            
            {(isPending || isTxLoading) && (
              <p className="text-center text-sm text-amber-400 animate-pulse">
                Please confirm the transaction in your wallet...
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
