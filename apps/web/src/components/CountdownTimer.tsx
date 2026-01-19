"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CountdownTimerProps {
  deadline: bigint;
  label: string;
  onExpire?: () => void;
}

export function CountdownTimer({ deadline, label, onExpire }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = Number(deadline) - now;
      if (diff <= 0) {
        setRemaining(0);
        setIsExpired(true);
        onExpire?.();
      } else {
        setRemaining(diff);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline, onExpire]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
      <AnimatePresence mode="wait">
        {isExpired ? (
          <motion.span
            key="expired"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-lg font-medium text-rose-500"
          >
            Expired
          </motion.span>
        ) : (
          <motion.span
            key="countdown"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.8, 1, 0.8] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-lg font-mono font-medium text-amber-400"
          >
            {formatTime(remaining)}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
