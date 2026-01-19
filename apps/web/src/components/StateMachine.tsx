"use client";

import { motion } from "framer-motion";
import { EscrowState, STATE_LABELS, STATE_COLORS } from "@/lib/contracts";

interface StateMachineProps {
  currentState: EscrowState;
}

const STATES = [
  EscrowState.AWAITING_PAYMENT,
  EscrowState.FUNDED,
  EscrowState.DELIVERED,
  EscrowState.COMPLETE,
];

export function StateMachine({ currentState }: StateMachineProps) {
  const isTerminal = currentState === EscrowState.COMPLETE || 
                     currentState === EscrowState.REFUNDED ||
                     currentState === EscrowState.DISPUTED;

  return (
    <div className="flex items-center gap-2">
      {STATES.map((state, i) => {
        const isActive = state === currentState;
        const isPast = state < currentState && !isTerminal;
        const isFuture = state > currentState && !isTerminal;

        return (
          <div key={state} className="flex items-center gap-2">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: isActive ? 1 : 0.8 }}
              className={`
                w-3 h-3 rounded-full transition-colors
                ${isActive ? "bg-amber-500" : isPast ? "bg-teal-600" : "bg-slate-700"}
              `}
            />
            {i < STATES.length - 1 && (
              <div className={`w-8 h-0.5 ${isPast ? "bg-teal-600" : "bg-slate-700"}`} />
            )}
          </div>
        );
      })}
      <span className={`ml-3 text-sm font-medium ${STATE_COLORS[currentState]}`}>
        {STATE_LABELS[currentState]}
      </span>
    </div>
  );
}
