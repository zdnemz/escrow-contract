"use client";

import { Header } from "@/components/Header";
import { CreateEscrowForm } from "@/components/create/CreateEscrowForm";
import { motion } from "framer-motion";

export default function CreatePage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-16 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="max-w-xl mx-auto mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">Create New Escrow</h1>
            <p className="text-slate-400">
              Set up a secure, deadline-based escrow agreement.
            </p>
          </div>
          
          <CreateEscrowForm />
        </motion.div>
      </main>
    </div>
  );
}
