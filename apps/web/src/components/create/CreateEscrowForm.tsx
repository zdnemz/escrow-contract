"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, isAddress, formatEther } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import { FACTORY_ABI, FACTORY_ADDRESS, DEFAULT_MAX_GAS_PRICE, DEFAULT_MAX_GAS_PER_ACTION } from "@/lib/contracts";
import { useBlockTimestamp } from "@/hooks/useBlockTimestamp";

export function CreateEscrowForm() {
  const blockTime = useBlockTimestamp();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    seller: "",
    arbiter: "",
    escrowAmount: "",
    gasPool: "0.01", // Default 0.01 ETH for gas pool
    arbiterFee: "0.005", // Default 0.005 ETH arbiter fee
    deliveryDeadline: "",
    reviewPeriod: "3600", // Default 1 hour
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isTxLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

  const validateStep1 = () => {
    return isAddress(formData.seller) && 
      isAddress(formData.arbiter) && // Arbiter is required for gas abstraction
      Number(formData.escrowAmount) > 0;
  };

  const validateStep2 = () => {
    const deadline = new Date(formData.deliveryDeadline).getTime();
    return deadline > Number(blockTime) * 1000 &&
      Number(formData.gasPool) >= 0 &&
      Number(formData.arbiterFee) >= 0;
  };

  const totalDeposit = () => {
    const escrow = Number(formData.escrowAmount) || 0;
    const gas = Number(formData.gasPool) || 0;
    const fee = Number(formData.arbiterFee) || 0;
    return escrow + gas + fee;
  };

  const handleCreate = () => {
    const deadlineTimestamp = BigInt(Math.floor(new Date(formData.deliveryDeadline).getTime() / 1000));
    const reviewDuration = BigInt(formData.reviewPeriod);
    const escrowAmountWei = parseEther(formData.escrowAmount);
    const gasPoolWei = parseEther(formData.gasPool);
    const arbiterFeeWei = parseEther(formData.arbiterFee);
    const totalValue = escrowAmountWei + gasPoolWei + arbiterFeeWei;

    writeContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: "createEscrow",
      args: [
        formData.seller as `0x${string}`,
        formData.arbiter as `0x${string}`,
        escrowAmountWei,
        gasPoolWei,
        arbiterFeeWei,
        DEFAULT_MAX_GAS_PRICE,
        DEFAULT_MAX_GAS_PER_ACTION,
        deadlineTimestamp,
        reviewDuration
      ],
      value: totalValue,
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
              <label className="block text-sm font-medium text-slate-400 mb-2">Arbiter/Relayer Address</label>
              <input
                type="text"
                placeholder="0x..."
                value={formData.arbiter}
                onChange={(e) => setFormData({ ...formData, arbiter: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-amber-500 outline-none font-mono"
              />
              <p className="text-xs text-slate-500 mt-2">
                The arbiter executes meta-transactions for gasless UX and resolves disputes.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Escrow Amount (ETH)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.0"
                value={formData.escrowAmount}
                onChange={(e) => setFormData({ ...formData, escrowAmount: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:border-amber-500 outline-none font-mono"
              />
              <p className="text-xs text-slate-500 mt-2">
                Protected principal amount that goes to seller on completion.
              </p>
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={!validateStep1()}
              className="w-full py-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
            >
              Next: Gas & Fees
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
            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Gas Abstraction Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2">Gas Pool (ETH)</label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="0.01"
                    value={formData.gasPool}
                    onChange={(e) => setFormData({ ...formData, gasPool: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:border-amber-500 outline-none font-mono text-sm"
                  />
                  <p className="text-xs text-slate-600 mt-1">
                    Funds meta-transaction gas costs. Remainder refunded on completion.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2">Arbiter Fee (ETH)</label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="0.005"
                    value={formData.arbiterFee}
                    onChange={(e) => setFormData({ ...formData, arbiterFee: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:border-amber-500 outline-none font-mono text-sm"
                  />
                  <p className="text-xs text-slate-600 mt-1">
                    Flat fee paid to arbiter at escrow completion.
                  </p>
                </div>
              </div>
            </div>

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
                <span className="text-slate-500">Escrow Amount</span>
                <span className="font-mono text-amber-400">{formData.escrowAmount} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Gas Pool</span>
                <span className="font-mono text-slate-300">{formData.gasPool} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Arbiter Fee</span>
                <span className="font-mono text-slate-300">{formData.arbiterFee} ETH</span>
              </div>
              <div className="border-t border-slate-700 pt-4 flex justify-between">
                <span className="text-slate-400 font-medium">Total Deposit</span>
                <span className="font-mono text-lg text-amber-500">{totalDeposit().toFixed(4)} ETH</span>
              </div>
              <div className="border-t border-slate-800 pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Seller</span>
                  <span className="font-mono text-xs">{formData.seller.slice(0, 10)}...{formData.seller.slice(-8)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Arbiter</span>
                  <span className="font-mono text-xs">{formData.arbiter.slice(0, 10)}...{formData.arbiter.slice(-8)}</span>
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
            </div>

            <div className="p-4 bg-teal-900/20 border border-teal-800 rounded-xl">
              <p className="text-sm text-teal-300">
                ✓ Seller pays no gas fees – all actions via meta-transactions<br />
                ✓ Arbiter fee paid once at escrow completion<br />
                ✓ Unused gas pool refunded to you
              </p>
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
