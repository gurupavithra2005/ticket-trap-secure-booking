import React from 'react';
import { ApiEvent } from '../services/api.ts';
import { Calendar, MapPin, ShieldAlert, Ticket as TicketIcon, CheckCircle2, Users } from 'lucide-react';

interface EventCardProps {
  event: ApiEvent;
  onSelectTickets: (event: ApiEvent) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onSelectTickets }) => {
  const totalQuantity = event.ticketTypes.reduce((sum, tt) => sum + tt.totalQuantity, 0);
  const totalAvailable = event.ticketTypes.reduce((sum, tt) => sum + tt.availableQuantity, 0);
  const totalReserved = event.ticketTypes.reduce((sum, tt) => sum + tt.reservedQuantity, 0);
  const totalSold = event.ticketTypes.reduce((sum, tt) => sum + tt.soldQuantity, 0);

  const percentSoldOrHeld = totalQuantity > 0 ? Math.round(((totalSold + totalReserved) / totalQuantity) * 100) : 0;
  const isSoldOut = totalAvailable === 0;
  const isHighDemand = totalAvailable > 0 && totalAvailable <= 10;

  const minPrice = Math.min(...event.ticketTypes.map((tt) => tt.price));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition duration-200 flex flex-col group shadow-xl shadow-black/40">
      {/* Event Image Banner */}
      <div className="relative h-48 w-full bg-slate-800 overflow-hidden">
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt={event.name}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-600">
            <TicketIcon className="w-12 h-12" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />

        {/* Category Pill */}
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-950/80 backdrop-blur-md text-cyan-400 border border-cyan-800/50">
            {event.category}
          </span>
          {isHighDemand && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/90 text-amber-300 border border-amber-600 flex items-center gap-1 animate-pulse">
              <ShieldAlert className="w-3.5 h-3.5" /> High Demand
            </span>
          )}
          {isSoldOut && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-950/90 text-rose-300 border border-rose-600">
              Sold Out
            </span>
          )}
        </div>

        {/* Price Tag */}
        <div className="absolute bottom-3 right-3 bg-slate-950/90 backdrop-blur-md px-3 py-1 rounded-lg border border-slate-700 text-right">
          <span className="text-[10px] text-slate-400 block uppercase font-medium">Starts from</span>
          <span className="text-base font-extrabold text-white">${minPrice}</span>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition line-clamp-1">
            {event.name}
          </h3>
          <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
            {event.description}
          </p>

          <div className="mt-4 space-y-1.5 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                {new Date(event.eventDate).toLocaleDateString('en-US', {
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
              <span className="truncate">{event.venue}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Max {event.maxTicketsPerUser} tickets / user limit enforced</span>
            </div>
          </div>
        </div>

        {/* Live Inventory Status Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800">
          <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              Authoritative Live Availability
            </span>
            <span className="font-bold text-slate-200">
              {totalAvailable} of {totalQuantity} available
            </span>
          </div>

          {/* Segmented inventory bar */}
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${(totalSold / totalQuantity) * 100}%` }}
              className="bg-slate-600 transition-all duration-300"
              title={`Sold: ${totalSold}`}
            />
            <div
              style={{ width: `${(totalReserved / totalQuantity) * 100}%` }}
              className="bg-amber-500 transition-all duration-300 animate-pulse"
              title={`Held in Checkout: ${totalReserved}`}
            />
            <div
              style={{ width: `${(totalAvailable / totalQuantity) * 100}%` }}
              className="bg-emerald-500 transition-all duration-300"
              title={`Available: ${totalAvailable}`}
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>Sold: {totalSold}</span>
            {totalReserved > 0 && <span className="text-amber-400 font-semibold">Held: {totalReserved}</span>}
            <span className="text-emerald-400 font-semibold">Available: {totalAvailable}</span>
          </div>

          {/* Action button */}
          <button
            onClick={() => onSelectTickets(event)}
            disabled={isSoldOut}
            className={`mt-4 w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              isSoldOut
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                : 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-950/40 border border-cyan-400/20 active:scale-[0.99]'
            }`}
          >
            {isSoldOut ? (
              'Sold Out'
            ) : (
              <>
                <TicketIcon className="w-4 h-4" />
                Select & Reserve Tickets
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
