"use client";

import { useAccount } from "wagmi";
import { Header } from "@/components/Header";
import { ConnectButton } from "@/components/ConnectButton";
import { DisputesList } from "@/components/disputes/DisputesList";
import { useArbiterDisputes } from "@/hooks/useArbiterDisputes";

export default function DisputesPage() {
    const { address } = useAccount();
    const { disputes, isLoading } = useArbiterDisputes();

    return (
        <div className="min-h-screen">
            <Header />
            <main className="pt-24 pb-16 px-6 max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold mb-2">Disputes</h1>
                    <p className="text-slate-400 max-w-xl">
                        Manage disputes for escrows where you are assigned as arbiter
                    </p>
                </div>

                {!address ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-4">
                        <p className="text-slate-500">Connect your wallet to view disputes</p>
                        <ConnectButton />
                    </div>
                ) : isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-48 bg-slate-900 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <DisputesList disputes={disputes} />
                )}
            </main>
        </div>
    );
}
