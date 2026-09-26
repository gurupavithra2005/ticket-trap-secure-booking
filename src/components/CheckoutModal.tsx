import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useLive } from '../context/LiveContext.tsx';
import { api } from '../services/api.ts';
import {
  X,
  Clock,
  ShieldCheck,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Lock,
} from 'lucide-react';

interface CheckoutModalProps {
  onClose: () => void;
  onSuccess: (tickets: any[]) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const { activeHold, refreshAll } = useLive();

  const [paymentOutcome, setPaymentOutcome] = useState<'SUCCESS' | 'DECLINED' | 'TIMEOUT'>('SUCCESS');
  const [customerName, setCustomerName] = useState(user?.name || 'Alex Johnson');
  const [customerEmail, setCustomerEmail] = useState(user?.email || 'guest@example.com');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
    details?: string;
  } | null>(null);

  // Keyboard accessibility: Escape key to close modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!activeHold || !activeHold.reservation) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 text-center text-slate-100 shadow-2xl">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">No Active Reservation</h3>
          <p className="text-xs text-slate-400 mt-2">
            You do not currently have any tickets held in checkout, or your hold has expired.
          </p>
          <button
            onClick={onClose}
            className="mt-6 w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-xs text-white"
          >
            Browse Available Events
          </button>
        </div>
      </div>
    );
  }

  const { reservation, items, event, secondsRemaining } = activeHold;

  const totalAmount = items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0);

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCheckout = async () => {
    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await api.processCheckout({
        reservationId: reservation.id,
        paymentOutcome,
        customerName,
        customerEmail,
      });

      refreshAll();

      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: 'Payment Authorized & Tickets Issued!',
          details: `Order #${res.order?.id.slice(0, 8)} confirmed. ${res.tickets?.length} tamper-resistant tickets generated.`,
        });
        setTimeout(() => {
          onSuccess(res.tickets || []);
        }, 1200);
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message || 'Payment simulation failed.',
          details: 'Compensating transaction executed: Reserved inventory was released back to public availability.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Checkout transaction error',
        details: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseHold = async () => {
    setLoading(true);
    try {
      await api.releaseReservation(reservation.id);
      refreshAll();
      onClose();
    } catch (err) {
      console.error('Failed to release reservation', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-modal-title"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[92vh]"
      >
        {/* Hold Countdown Header */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 p-4 border-b border-amber-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div id="checkout-modal-title" className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <span>Atomic Reservation Hold Active</span>
              </div>
              <div
                aria-live="polite"
                aria-atomic="true"
                className="text-xl font-extrabold text-white"
              >
                {formatCountdown(secondsRemaining)} remaining
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close checkout dialog"
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Status Alert Banner */}
          {statusMessage && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-800 text-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-bold text-sm">{statusMessage.text}</div>
                {statusMessage.details && <div className="mt-1 opacity-90">{statusMessage.details}</div>}
              </div>
            </div>
          )}

          {/* Event & Items Summary */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 uppercase font-semibold">Event</div>
            <h3 className="text-base font-bold text-white mt-0.5">{event?.name}</h3>
            <p className="text-xs text-slate-400">{event?.venue}</p>

            <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
              <div className="text-xs text-slate-400 uppercase font-semibold">Held Ticket Items</div>
              {items.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center text-xs">
                  <span className="text-slate-300">
                    {item.ticketTypeName} × {item.quantity}
                  </span>
                  <span className="font-mono font-bold text-slate-100">
                    ${(item.quantity * item.unitPrice).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center font-bold text-sm text-white">
                <span>Total Due</span>
                <span className="text-cyan-400 text-base">${totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Customer Details Form */}
          <div className="space-y-3">
            <div className="text-xs text-slate-400 uppercase font-semibold">Ticket Holder Details</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Full Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Email for Ticket Delivery</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Mock Payment Simulator Box */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-300 font-bold flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-cyan-400" />
                Payment Simulator (Evaluator Control)
              </span>
              <span className="text-[10px] text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                Mock Gateway
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
              Select an outcome to test atomic settlement vs. compensating rollback on failure:
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentOutcome('SUCCESS')}
                className={`p-2.5 rounded-lg border text-left transition ${
                  paymentOutcome === 'SUCCESS'
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs">✓ Success</div>
                <div className="text-[10px] opacity-75 mt-0.5">Authorizes & Issues Signed Passes</div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentOutcome('DECLINED')}
                className={`p-2.5 rounded-lg border text-left transition ${
                  paymentOutcome === 'DECLINED'
                    ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs">✕ Decline</div>
                <div className="text-[10px] opacity-75 mt-0.5">Bank Rejection & Rollback</div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentOutcome('TIMEOUT')}
                className={`p-2.5 rounded-lg border text-left transition ${
                  paymentOutcome === 'TIMEOUT'
                    ? 'bg-amber-950/60 border-amber-500 text-amber-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs">⏱ Timeout</div>
                <div className="text-[10px] opacity-75 mt-0.5">Deadline Expiry & Compensation</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between gap-3">
          <button
            onClick={handleReleaseHold}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition border border-rose-900/40"
          >
            Release Held Tickets
          </button>

          <button
            onClick={handleCheckout}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 transition flex items-center gap-2 shadow-lg shadow-cyan-950/50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Transaction...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Pay & Finalize Order (${totalAmount.toFixed(2)})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
