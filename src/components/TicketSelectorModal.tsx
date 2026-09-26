import React, { useState } from 'react';
import { ApiEvent, api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useLive } from '../context/LiveContext.tsx';
import {
  X,
  Shield,
  AlertTriangle,
  CheckCircle,
  Plus,
  Minus,
  Lock,
  Loader2,
  Info,
} from 'lucide-react';

interface TicketSelectorModalProps {
  event: ApiEvent | null;
  onClose: () => void;
  onReservationSuccess: () => void;
}

export const TicketSelectorModal: React.FC<TicketSelectorModalProps> = ({
  event,
  onClose,
  onReservationSuccess,
}) => {
  const { user } = useAuth();
  const { refreshAll } = useLive();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!event) return null;

  // Keyboard accessibility: Escape key to close modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const totalSelectedTickets = Object.values(quantities).reduce((a, b) => a + b, 0);
  const maxLimit = event.maxTicketsPerUser;

  const handleQuantityChange = (tierId: string, delta: number) => {
    setError(null);
    const current = quantities[tierId] || 0;
    const next = Math.max(0, current + delta);

    const otherTickets = Object.entries(quantities)
      .filter(([id]) => id !== tierId)
      .reduce((sum, [, q]) => sum + q, 0);

    if (otherTickets + next > maxLimit) {
      setError(`Cannot exceed event maximum of ${maxLimit} tickets per user.`);
      return;
    }

    const tier = event.ticketTypes.find((t) => t.id === tierId);
    if (tier && next > tier.availableQuantity) {
      setError(`Only ${tier.availableQuantity} tickets remaining for ${tier.name}.`);
      return;
    }

    if (tier && next > tier.purchaseLimit) {
      setError(`Maximum limit for ${tier.name} is ${tier.purchaseLimit} per order.`);
      return;
    }

    setQuantities((prev) => ({
      ...prev,
      [tierId]: next,
    }));
  };

  const totalPrice = event.ticketTypes.reduce((sum, tier) => {
    const q = quantities[tier.id] || 0;
    return sum + q * tier.price;
  }, 0);

  const handleReserve = async () => {
    if (!user) {
      setError('Please log in to reserve tickets.');
      return;
    }

    if (totalSelectedTickets === 0) {
      setError('Please select at least 1 ticket to reserve.');
      return;
    }

    setLoading(true);
    setError(null);

    const items = Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([ticketTypeId, quantity]) => ({
        ticketTypeId,
        quantity,
      }));

    try {
      const res = await api.createReservation(event.id, items);
      if (res.success) {
        refreshAll();
        onReservationSuccess();
      } else {
        setError(res.message || 'Failed to reserve tickets. Please check availability.');
      }
    } catch (err: any) {
      setError('Network or system error during atomic allocation. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-modal-title"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-950/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                {event.category}
              </span>
              <span className="text-xs text-slate-400">
                Max {maxLimit} tickets / customer
              </span>
            </div>
            <h2 id="ticket-modal-title" className="text-lg font-bold text-white mt-1">{event.name}</h2>
            <p className="text-xs text-slate-400">{event.venue}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close ticket reservation dialog"
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Honeypot hidden input */}
        <input type="text" name="_hp_trap" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />

        {/* Tiers List */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <div className="bg-slate-950/70 border border-cyan-900/40 rounded-xl p-3 text-xs text-cyan-200 flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              <strong>Atomic Row-Level Hold:</strong> Reserving locks inventory exclusively for {event.holdDurationSeconds / 60} minutes while you complete checkout.
            </span>
          </div>

          {error && (
            <div className="bg-rose-950/80 border border-rose-800 rounded-xl p-3 text-xs text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            {event.ticketTypes.map((tier) => {
              const selectedQty = quantities[tier.id] || 0;
              const isAvailable = tier.availableQuantity > 0;

              return (
                <div
                  key={tier.id}
                  className={`p-4 rounded-xl border transition ${
                    selectedQty > 0
                      ? 'border-cyan-500/60 bg-cyan-950/10'
                      : 'border-slate-800 bg-slate-950/40'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{tier.name}</span>
                        <span className="text-xs font-semibold text-cyan-400">${tier.price}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{tier.description}</p>
                      <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-2">
                        <span
                          className={`font-medium ${
                            tier.availableQuantity <= 5 ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {tier.availableQuantity} available
                        </span>
                        {tier.reservedQuantity > 0 && (
                          <span className="text-slate-500">
                            ({tier.reservedQuantity} in checkout hold)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center gap-2 bg-slate-800/80 rounded-lg p-1 border border-slate-700">
                      <button
                        onClick={() => handleQuantityChange(tier.id, -1)}
                        disabled={selectedQty === 0}
                        className="w-7 h-7 rounded flex items-center justify-center bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-white transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-bold text-white">
                        {selectedQty}
                      </span>
                      <button
                        onClick={() => handleQuantityChange(tier.id, 1)}
                        disabled={!isAvailable || selectedQty >= tier.availableQuantity || selectedQty >= tier.purchaseLimit}
                        className="w-7 h-7 rounded flex items-center justify-center bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed text-white transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Summary & Reserve Button */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left w-full sm:w-auto">
            <span className="text-xs text-slate-400 block">
              Selected: {totalSelectedTickets} of {maxLimit} max tickets
            </span>
            <span className="text-xl font-extrabold text-white">
              ${totalPrice.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleReserve}
              disabled={loading || totalSelectedTickets === 0}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Locking Inventory...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Lock & Reserve Tickets</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
