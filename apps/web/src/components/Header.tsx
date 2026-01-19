import { ConnectButton } from "@/components/ConnectButton";
import Link from "next/link";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-rose-500" />
            <Link href="/" className="font-semibold text-lg hover:text-slate-200 transition-colors">Escrow</Link>
          </div>
          <nav className="flex gap-4">
            <Link href="/disputes" className="text-sm font-medium text-slate-400 hover:text-amber-500 transition-colors">
              Disputes
            </Link>
            <Link href="/create" className="text-sm font-medium text-slate-400 hover:text-amber-500 transition-colors">
              Create Escrow
            </Link>
          </nav>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
