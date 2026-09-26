import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ApiTicket } from '../services/api.ts';
import {
  ShieldCheck,
  CheckCircle2,
  Calendar,
  MapPin,
  User,
  Copy,
  Check,
  ArrowRight,
  Lock,
} from 'lucide-react';

interface TicketPassCardProps {
  ticket: ApiTicket;
  onInspectAtGate?: (ticketToken: string) => void;
}

export const TicketPassCard: React.FC<TicketPassCardProps> = ({ ticket, onInspectAtGate }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Generate authentic QR code data URL from secure token
    QRCode.toDataURL(
      ticket.secureToken,
      {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 256,
        color: {
          dark: '#030712',
          light: '#ffffff',
        },
      },
      (err, url) => {
        if (!err && url) {
          setQrDataUrl(url);
        }
      }
    );
  }, [ticket.secureToken]);

  const handleCopy = () => {
    navigator.clipboard.writeText(ticket.secureToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isCheckedIn = ticket.status === 'CHECKED_IN';
  const isValid = ticket.status === 'VALID';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row relative">
      {/* Left Details Panel */}
      <div className="p-6 flex-1 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/80">
              {ticket.ticketTypeName}
            </span>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${
                isValid
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                  : isCheckedIn
                  ? 'bg-amber-950 text-amber-300 border border-amber-700'
                  : 'bg-rose-950 text-rose-300 border border-rose-700'
              }`}
            >
              {isValid && <CheckCircle2 className="w-3.5 h-3.5" />}
              {ticket.status}
            </span>
          </div>

          <h3 className="text-xl font-extrabold text-white mt-3">{ticket.eventName}</h3>

          <div className="mt-4 space-y-2 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                {new Date(ticket.eventDate).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{ticket.venue}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                Holder: <strong>{ticket.holderName}</strong> ({ticket.holderEmail})
              </span>
            </div>
          </div>
        </div>

        {/* Seat & Cryptographic Security Info */}
        <div className="mt-6 pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Seat / Pass</span>
              <span className="text-base font-extrabold text-white">{ticket.seatLabel}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Order Reference</span>
              <span className="font-mono text-xs text-slate-300">#{ticket.orderId.slice(0, 8)}</span>
            </div>
          </div>

          {/* Cryptography Badge */}
          <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 text-[11px] text-slate-400">
            <div className="flex items-center justify-between text-slate-300 font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Lock className="w-3.5 h-3.5" /> HMAC-SHA256 Signature
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy Token'}
              </button>
            </div>
            <div className="font-mono text-[10px] text-slate-400 truncate">
              sig: {ticket.signature.slice(0, 24)}...
            </div>
          </div>
        </div>
      </div>

      {/* Right QR Code Panel */}
      <div className="p-6 bg-slate-950/60 flex flex-col items-center justify-center min-w-[240px] text-center border-t md:border-t-0 border-slate-800">
        <div className="bg-white p-3 rounded-2xl shadow-xl border border-slate-200">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Ticket QR Pass" className="w-36 h-36 object-contain" />
          ) : (
            <div className="w-36 h-36 flex items-center justify-center text-slate-950">Generating...</div>
          )}
        </div>

        <span className="text-[10px] text-slate-400 mt-2 font-mono">
          ID: {ticket.id.slice(0, 8)}
        </span>

        {isCheckedIn && (
          <div className="mt-2 text-[11px] text-amber-400 font-bold bg-amber-950/80 px-2.5 py-1 rounded-full border border-amber-800">
            Checked in at {new Date(ticket.checkedInAt || '').toLocaleTimeString()}
          </div>
        )}

        {onInspectAtGate && (
          <button
            onClick={() => onInspectAtGate(ticket.secureToken)}
            className="mt-4 text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
          >
            <span>Verify at Staff Gate</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
