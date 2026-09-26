import React from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  Zap,
  Server,
  Database,
  CreditCard,
  QrCode,
  CheckCircle,
  AlertTriangle,
  Layers,
  ArrowDown,
} from 'lucide-react';

interface SecurityArchitectureModalProps {
  onClose: () => void;
}

export const SecurityArchitectureModal: React.FC<SecurityArchitectureModalProps> = ({ onClose }) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const layers = [
    {
      step: 1,
      title: 'Frontend Client & Honeypot Trap',
      icon: Layers,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-950/40 border-cyan-800/60',
      description:
        'Captures client telemetry, timestamp velocity, and embeds hidden honeypot fields (`_hp_trap`). Automated headless scrapers trigger instant 403 blocks.',
    },
    {
      step: 2,
      title: 'Session Authentication & RBAC Layer',
      icon: Lock,
      color: 'text-purple-400',
      bgColor: 'bg-purple-950/40 border-purple-800/60',
      description:
        'Cryptographic session validation using PBKDF2 password salting and HS256/RS256 JWT tokens. Enforces strict role boundaries (ADMIN, STAFF, CUSTOMER).',
    },
    {
      step: 3,
      title: 'Anti-Bot & Sliding-Window Rate Limiter',
      icon: Zap,
      color: 'text-rose-400',
      bgColor: 'bg-rose-950/40 border-rose-800/60',
      description:
        'Sliding-window counters per IP and per account. Detects inhuman velocity (<600ms booking submissions), bursts, and automated scraping.',
    },
    {
      step: 4,
      title: 'Authoritative Per-User Limit Validator',
      icon: ShieldCheck,
      color: 'text-amber-400',
      bgColor: 'bg-amber-950/40 border-amber-800/60',
      description:
        'Validates committed purchases + active unexpired reservation holds against `maxTicketsPerUser`. Blocks parallel multi-tab attempts.',
    },
    {
      step: 5,
      title: 'Row-Level Mutex & Database Atomic Transaction',
      icon: Database,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-950/40 border-emerald-800/60',
      description:
        'Serialized transaction isolation on the inventory row. Guarantees inventory never drops below zero and no two users receive the same ticket.',
    },
    {
      step: 6,
      title: 'TTL Reservation Hold & Lazy Sweeper',
      icon: Server,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-950/40 border-indigo-800/60',
      description:
        'Active holds expire after 300s. A background sweeper plus lazy pre-transaction sweeps immediately return unpurchased tickets to public availability.',
    },
    {
      step: 7,
      title: 'Payment Gateway & Compensating Rollback',
      icon: CreditCard,
      color: 'text-pink-400',
      bgColor: 'bg-pink-950/40 border-pink-800/60',
      description:
        'State machine: PAYMENT_PENDING → PAID or PAYMENT_FAILED. On bank decline or timeout, an immediate compensating transaction frees the held inventory.',
    },
    {
      step: 8,
      title: 'HMAC-SHA256 Signed QR Pass Issuance',
      icon: QrCode,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-950/40 border-cyan-800/60',
      description:
        'Generates non-sequential ticket IDs with random nonces and cryptographic HMAC-SHA256 signatures. QR codes contain verification hashes without PII.',
    },
    {
      step: 9,
      title: 'Gate Replay-Proof Check-In Scanner',
      icon: CheckCircle,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-950/40 border-emerald-800/60',
      description:
        'Staff gate verifier checks signature authenticity, event validity, and executes atomic status transition to `CHECKED_IN`, blocking reuse.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="arch-modal-title"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 id="arch-modal-title" className="text-lg font-bold text-white">Defense-in-Depth Security & Concurrency Architecture</h2>
              <p className="text-xs text-slate-400">
                Authoritative multi-tiered protection model for high-contention ticket drops
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close architecture modal"
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Flow */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {layers.map((layer, index) => {
            const Icon = layer.icon;
            return (
              <div key={layer.step} className="flex flex-col items-center">
                <div className={`w-full p-4 rounded-xl border ${layer.bgColor} transition`}>
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold font-mono text-slate-300">{layer.step}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${layer.color}`} />
                        <h4 className="text-sm font-bold text-white">{layer.title}</h4>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        {layer.description}
                      </p>
                    </div>
                  </div>
                </div>

                {index < layers.length - 1 && (
                  <div className="my-1 text-slate-600">
                    <ArrowDown className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white"
          >
            Close Architecture Map
          </button>
        </div>
      </div>
    </div>
  );
};
