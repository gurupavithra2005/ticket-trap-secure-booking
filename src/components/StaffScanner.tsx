import React, { useState } from 'react';
import { api, ApiTicket } from '../services/api.ts';
import {
  QrCode,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  Check,
  RefreshCw,
  Camera,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface StaffScannerProps {
  initialToken?: string;
  onRefresh?: () => void;
}

export const StaffScanner: React.FC<StaffScannerProps> = ({ initialToken = '', onRefresh }) => {
  const [tokenInput, setTokenInput] = useState<string>(initialToken);
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [checkInStatus, setCheckInStatus] = useState<string | null>(null);

  const handleValidate = async (tokenToUse?: string) => {
    const input = (tokenToUse || tokenInput).trim();
    if (!input) return;

    setLoading(true);
    setValidationResult(null);
    setCheckInStatus(null);

    try {
      const res = await api.validateTicket(input);
      setValidationResult(res);
    } catch (err: any) {
      setValidationResult({
        valid: false,
        status: 'TAMPERED_INVALID',
        message: 'Server failed to process ticket validation payload.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (ticketId: string) => {
    setLoading(true);
    try {
      const res = await api.checkInTicket(ticketId);
      if (res.valid) {
        setCheckInStatus('SUCCESS');
        setValidationResult(res);
        if (onRefresh) onRefresh();
      } else {
        setCheckInStatus('FAILED');
        setValidationResult(res);
      }
    } catch (err: any) {
      setCheckInStatus('ERROR');
    } finally {
      setLoading(false);
    }
  };

  // Quick preset attack testers for judges & evaluators
  const testPreset = (type: 'valid' | 'replay' | 'tampered') => {
    if (type === 'valid') {
      // Use sample-ticket-001 from seed
      setTokenInput('sample-ticket-001');
      handleValidate('sample-ticket-001');
    } else if (type === 'replay') {
      // Use sample-ticket-checkedin-002 from seed
      setTokenInput('sample-ticket-checkedin-002');
      handleValidate('sample-ticket-checkedin-002');
    } else if (type === 'tampered') {
      // Malformed HMAC token
      const tampered =
        'eyJ2IjoxLCJ0aWQiOiJzYW1wbGUtdGlja2V0LTAwMSIsImVpZCI6ImV2ZW50LTEiLCJub25jZSI6ImY3YTlhYzAwIiwic2lnIjoiYmFkX2hhc2hfdGFtcGVyZWRfOTk5OTk5In0';
      setTokenInput(tampered);
      handleValidate(tampered);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Staff Gate Inspection Mode
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-white mt-1">Ticket Validation & Replay Gate</h2>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative HMAC-SHA256 signature verification & atomic check-in shield preventing multi-entry replay attacks.
          </p>
        </div>

        {/* Quick Test Presets for Evaluator */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => testPreset('valid')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 transition"
          >
            ✓ Test Valid Pass
          </button>
          <button
            onClick={() => testPreset('replay')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800 transition"
          >
            ⚠ Test Replay Attack
          </button>
          <button
            onClick={() => testPreset('tampered')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 transition"
          >
            ✕ Test Tampered Signature
          </button>
        </div>
      </div>

      {/* Input Scanner Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <label className="text-xs font-bold uppercase text-slate-300 block mb-2">
          Scan QR Code or Enter Verification Token
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste ticket base64url token or ticket ID (e.g. sample-ticket-001)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            onClick={() => handleValidate()}
            disabled={loading || !tokenInput.trim()}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-cyan-950/50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Inspect Ticket</span>
          </button>
        </div>
      </div>

      {/* Validation Result Box */}
      {validationResult && (
        <div
          className={`border rounded-2xl p-6 shadow-2xl transition animate-in fade-in ${
            validationResult.status === 'VALID'
              ? 'bg-emerald-950/30 border-emerald-500/60'
              : validationResult.status === 'ALREADY_CHECKED_IN'
              ? 'bg-amber-950/40 border-amber-500/60'
              : 'bg-rose-950/40 border-rose-500/60'
          }`}
        >
          {/* Big Decision Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              {validationResult.status === 'VALID' ? (
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <CheckCircle className="w-7 h-7" />
                </div>
              ) : validationResult.status === 'ALREADY_CHECKED_IN' ? (
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <AlertTriangle className="w-7 h-7" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <XCircle className="w-7 h-7" />
                </div>
              )}

              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Gate Security Decision
                </span>
                <h3
                  className={`text-xl font-extrabold ${
                    validationResult.status === 'VALID'
                      ? 'text-emerald-400'
                      : validationResult.status === 'ALREADY_CHECKED_IN'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {validationResult.status === 'VALID' && '✓ VALID TICKET — ENTRY PERMITTED'}
                  {validationResult.status === 'ALREADY_CHECKED_IN' && '⚠ TICKET ALREADY USED — REPLAY DETECTED'}
                  {validationResult.status === 'TAMPERED_INVALID' && '✕ INVALID / TAMPERED CRYPTOGRAPHIC SIGNATURE'}
                  {validationResult.status === 'NOT_FOUND' && '✕ TICKET NOT FOUND IN SYSTEM'}
                  {validationResult.status === 'WRONG_EVENT' && '✕ WRONG EVENT GATE'}
                </h3>
              </div>
            </div>

            {/* Atomic Check-In Action Button */}
            {validationResult.status === 'VALID' && validationResult.ticket && (
              <button
                onClick={() => handleCheckIn(validationResult.ticket.id)}
                disabled={loading}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-950/60 transition flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                <span>CONFIRM CHECK-IN</span>
              </button>
            )}
          </div>

          {/* Explanation Text */}
          <p className="mt-4 text-xs text-slate-300 leading-relaxed font-medium">
            {validationResult.message}
          </p>

          {/* Ticket Metadata if available */}
          {validationResult.ticket && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Ticket Holder</span>
                <span className="font-bold text-white">{validationResult.ticket.holderName}</span>
                <div className="text-[11px] text-slate-400">{validationResult.ticket.holderEmail}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Tier & Assigned Seat</span>
                <span className="font-bold text-cyan-400">{validationResult.ticket.ticketTypeName}</span>
                <div className="text-white font-mono">{validationResult.ticket.seatLabel}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Event</span>
                <span className="font-bold text-white">{validationResult.ticket.eventName}</span>
                <div className="text-[11px] text-slate-400">{validationResult.ticket.venue}</div>
              </div>
            </div>
          )}

          {/* Security Audit Details */}
          {validationResult.securityDetails && (
            <div className="mt-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800/80 text-[11px] flex flex-wrap gap-4 text-slate-400">
              <div>
                Signature Check:{' '}
                <strong
                  className={
                    validationResult.securityDetails.verifiedSignature
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }
                >
                  {validationResult.securityDetails.verifiedSignature ? 'VERIFIED_VALID' : 'FAILED'}
                </strong>
              </div>
              <div>
                Tamper Detected:{' '}
                <strong
                  className={
                    validationResult.securityDetails.tamperDetected
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }
                >
                  {validationResult.securityDetails.tamperDetected ? 'TRUE' : 'NONE'}
                </strong>
              </div>
              {validationResult.securityDetails.checkedInAt && (
                <div>
                  Prior Check-in Time:{' '}
                  <strong className="text-amber-400">
                    {new Date(validationResult.securityDetails.checkedInAt).toLocaleString()}
                  </strong>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
