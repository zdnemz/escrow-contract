"use client";

import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { ESCROW_ABI } from "@/lib/contracts";

interface TimelineEvent {
    name: string;
    blockNumber: bigint;
    transactionHash: string;
    args: any;
    timestamp?: bigint;
}

const EVENTS = [
    "event Deposited(address indexed buyer, uint256 amount)",
    "event DeliveryMarked(address indexed seller, uint256 timestamp)",
    "event DeliveryConfirmed(address indexed buyer)",
    "event DisputeOpened(address indexed caller)",
    "event DisputeResolved(address indexed arbiter, address winner, uint256 amount)",
    "event AutoReleased(address indexed caller, uint256 amount)",
    "event AutoRefunded(address indexed caller, uint256 amount)",
    "event Refunded(address indexed caller, uint256 amount)"
];

export function EventTimeline({ address }: { address: `0x${string}` }) {
    const publicClient = usePublicClient();
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchEvents() {
            if (!publicClient) return;

            try {
                const promises = EVENTS.map(sig =>
                    publicClient.getLogs({
                        address,
                        event: parseAbiItem(sig) as any,
                        fromBlock: 'earliest'
                    })
                );

                const results = await Promise.all(promises);
                const allLogs = results.flat();

                const formattedEvents: TimelineEvent[] = allLogs.map(log => ({
                    name: (log as any).eventName as string,
                    blockNumber: log.blockNumber,
                    transactionHash: log.transactionHash,
                    args: (log as any).args,
                }));

                // Sort by block number descending
                formattedEvents.sort((a, b) => Number(b.blockNumber - a.blockNumber));
                setEvents(formattedEvents);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }

        fetchEvents();
    }, [address, publicClient]);

    if (loading) return <div className="animate-pulse h-24 bg-slate-900 rounded-xl" />;
    if (events.length === 0) return null;

    return (
        <div className="mt-8">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Event History</h3>
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
                {events.map((ev) => (
                    <div key={ev.transactionHash} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full border border-slate-700 bg-slate-900 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <div className="w-2 h-2 rounded-full bg-slate-500" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-800 bg-slate-900/50 shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-slate-200">{formatEventName(ev.name)}</span>
                                <a
                                    href={`https://etherscan.io/tx/${ev.transactionHash}`} // Mock explorer for now
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-slate-500 hover:text-amber-500 font-mono"
                                >
                                    {ev.transactionHash.slice(0, 6)}...
                                </a>
                            </div>
                            {renderEventArgs(ev)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function formatEventName(name: string) {
    return name.replace(/([A-Z])/g, ' $1').trim();
}

function renderEventArgs(ev: TimelineEvent) {
    if (ev.name === "Deposited" || ev.name === "AutoReleased" || ev.name === "Refunded") {
        return <p className="text-xs text-slate-400">Amount: {formatEther(ev.args.amount)} ETH</p>;
    }
    if (ev.name === "DeliveryMarked") {
        return <p className="text-xs text-slate-400">Marked at: {new Date(Number(ev.args.timestamp) * 1000).toLocaleString()}</p>;
    }
    if (ev.name === "DisputeResolved") {
        return (
            <>
                <p className="text-xs text-slate-400">Winner: {ev.args.winner.slice(0, 8)}...</p>
                <p className="text-xs text-slate-400">Amount: {formatEther(ev.args.amount)} ETH</p>
            </>
        );
    }
    return null;
}
