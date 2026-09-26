import React, { useState, useEffect } from 'react';
import { api, SecurityLogItem } from '../services/api.ts';
import { useLive } from '../context/LiveContext.tsx';
import {
  LayoutDashboard,
  ShieldAlert,
  Ticket,
  Users,
  CheckCircle,
  XCircle,
  Plus,
  RefreshCw,
  Clock,
  Layers,
  Search,
  Filter,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { recentSecurityEvents, refreshAll } = useLive();
  const [metrics, setMetrics] = useState<any>(null);
  const [securityEvents, setSecurityEvents] = useState<SecurityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  // Form states for new event creation
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [eventDate, setEventDate] = useState('2026-11-20T19:00');
  const [holdDurationSeconds, setHoldDurationSeconds] = useState(300);
  const [maxTicketsPerUser, setMaxTicketsPerUser] = useState(4);
  const [category, setCategory] = useState('Conference');
  const [tierName, setTierName] = useState('Standard Entry');
  const [tierPrice, setTierPrice] = useState(99);
  const [tierQty, setTierQty] = useState(50);
  const [submitting, setSubmitting] = useState(false);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [metricsRes, logsRes] = await Promise.all([
        api.getAdminMetrics(),
        api.getSecurityEvents(),
      ]);

      if (metricsRes.success) setMetrics(metricsRes.data);
      if (logsRes.success) setSecurityEvents(logsRes.events);
    } catch (err) {
      console.error('Failed to load admin telemetry', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.createEvent({
        name,
        venue,
        eventDate: new Date(eventDate).toISOString(),
        holdDurationSeconds,
        maxTicketsPerUser,
        category,
        ticketTypes: [
          {
            name: tierName,
            price: Number(tierPrice),
            totalQuantity: Number(tierQty),
            purchaseLimit: Number(maxTicketsPerUser),
          },
        ],
      });

      if (res.success) {
        setShowCreateModal(false);
        refreshAll();
        fetchAdminData();
        setName('');
        setVenue('');
      }
    } catch (err) {
      console.error('Event creation failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLogs = (securityEvents.length > 0 ? securityEvents : recentSecurityEvents).filter(
    (ev) => filterSeverity === 'ALL' || ev.severity === filterSeverity
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-950 text-purple-300 border border-purple-800 flex items-center gap-1.5">
              <LayoutDashboard className="w-3.5 h-3.5" /> Administrative Telemetry
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-white mt-1">System Observability & Audit Center</h2>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative inventory allocation rates, security threat audits, and real-time event governance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
          >
            <Plus className="w-4 h-4" /> Create Event
          </button>
          <button
            onClick={fetchAdminData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Aggregate Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 font-semibold block">Total Published Events</span>
            <span className="text-2xl font-extrabold text-white mt-1 block">{metrics.totalEvents}</span>
            <span className="text-[10px] text-slate-500">Live ticket catalogs</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 font-semibold block">Total Inventory Status</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-emerald-400">{metrics.availableInventory}</span>
              <span className="text-xs text-slate-400">/ {metrics.totalInventory} total</span>
            </div>
            <span className="text-[10px] text-slate-400">
              Sold: {metrics.soldInventory} | Held: {metrics.reservedInventory}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 font-semibold block">Orders & Payments</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-white">{metrics.confirmedOrders}</span>
              <span className="text-xs text-slate-400">confirmed</span>
            </div>
            <span className="text-[10px] text-rose-400">
              Failed/Compensated: {metrics.failedPayments}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 font-semibold block">Gate Validations</span>
            <span className="text-2xl font-extrabold text-amber-400 mt-1 block">
              {metrics.totalCheckedIn}
            </span>
            <span className="text-[10px] text-slate-400">Replay-free verified check-ins</span>
          </div>
        </div>
      )}

      {/* Security Audit Log Stream Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-sm text-white">Live Security Event Audit Stream</h3>
            <span className="text-[10px] bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-800">
              Authoritative Telemetry
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 text-[11px] mr-1">Severity:</span>
            {['ALL', 'INFO', 'WARN', 'CRITICAL'].map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                  filterSeverity === sev
                    ? 'bg-slate-700 text-white border border-slate-600'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto max-h-96 scrollbar-thin">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-[11px] text-slate-400 uppercase tracking-wider sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Severity</th>
                <th className="py-2.5 px-4">Event Type</th>
                <th className="py-2.5 px-4">Message</th>
                <th className="py-2.5 px-4">Client IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                    No security events recorded under current filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-850/60 transition">
                    <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.severity === 'CRITICAL'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : log.severity === 'WARN'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                        }`}
                      >
                        {log.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-white whitespace-nowrap text-[11px]">
                      {log.eventType}
                    </td>
                    <td className="py-2.5 px-4 text-slate-300 font-sans text-xs">
                      {log.message}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                      {log.ip}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl text-slate-100">
            <h3 className="text-lg font-bold text-white mb-4">Create New Ticketing Event</h3>

            <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Event Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Distributed Cloud Summit 2026"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Venue</label>
                  <input
                    type="text"
                    required
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="Silicon Valley Convention Center"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Hold Expiry (Seconds)</label>
                  <input
                    type="number"
                    required
                    value={holdDurationSeconds}
                    onChange={(e) => setHoldDurationSeconds(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Max Tickets / User</label>
                  <input
                    type="number"
                    required
                    value={maxTicketsPerUser}
                    onChange={(e) => setMaxTicketsPerUser(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <span className="font-semibold text-slate-300 block mb-2">Initial Ticket Tier</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Tier Name</label>
                    <input
                      type="text"
                      required
                      value={tierName}
                      onChange={(e) => setTierName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Price ($)</label>
                    <input
                      type="number"
                      required
                      value={tierPrice}
                      onChange={(e) => setTierPrice(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Quantity</label>
                    <input
                      type="number"
                      required
                      value={tierQty}
                      onChange={(e) => setTierQty(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold"
                >
                  {submitting ? 'Creating...' : 'Publish Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
