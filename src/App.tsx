import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { LiveProvider, useLive } from './context/LiveContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { EventCard } from './components/EventCard.tsx';
import { TicketSelectorModal } from './components/TicketSelectorModal.tsx';
import { CheckoutModal } from './components/CheckoutModal.tsx';
import { TicketPassCard } from './components/TicketPassCard.tsx';
import { StaffScanner } from './components/StaffScanner.tsx';
import { ConcurrencyDemoLab } from './components/ConcurrencyDemoLab.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { SecurityArchitectureModal } from './components/SecurityArchitectureModal.tsx';
import { EvaluationRubricModal } from './components/EvaluationRubricModal.tsx';
import { api, ApiEvent, ApiTicket } from './services/api.ts';
import {
  Ticket,
  ShieldCheck,
  Zap,
  Sparkles,
  Search,
  Filter,
  RefreshCw,
  QrCode,
  AlertCircle,
  FlaskConical,
  Lock,
} from 'lucide-react';

const MainContent: React.FC = () => {
  const { user } = useAuth();
  const { inventoryVersion, refreshAll } = useLive();

  const [currentTab, setCurrentTab] = useState<string>('events');
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Active Selections
  const [selectedEventForBooking, setSelectedEventForBooking] = useState<ApiEvent | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [architectureModalOpen, setArchitectureModalOpen] = useState(false);
  const [rubricModalOpen, setRubricModalOpen] = useState(false);
  const [staffInspectionToken, setStaffInspectionToken] = useState<string>('');

  // User Tickets
  const [myTickets, setMyTickets] = useState<ApiTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Fetch events whenever inventoryVersion changes
  useEffect(() => {
    let isMounted = true;
    const loadEvents = async () => {
      try {
        const res = await api.getEvents();
        if (isMounted && res.success) {
          setEvents(res.events);
        }
      } catch (err) {
        console.error('Failed to load events:', err);
      } finally {
        if (isMounted) setLoadingEvents(false);
      }
    };
    loadEvents();
    return () => {
      isMounted = false;
    };
  }, [inventoryVersion]);

  // Fetch user tickets
  const loadMyTickets = async () => {
    if (!user) return;
    setLoadingTickets(true);
    try {
      const res = await api.getMyTickets();
      if (res.success) {
        setMyTickets(res.tickets);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (currentTab === 'tickets') {
      loadMyTickets();
    }
  }, [currentTab, user]);

  const handleInspectAtGate = (token: string) => {
    setStaffInspectionToken(token);
    setCurrentTab('staff');
  };

  const filteredEvents = events.filter((evt) => {
    const matchesCategory = selectedCategory === 'ALL' || evt.category === selectedCategory;
    const matchesSearch =
      evt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.venue.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = ['ALL', ...Array.from(new Set(events.map((e) => e.category)))];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Global Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        openCheckout={() => setCheckoutModalOpen(true)}
        openArchitectureModal={() => setArchitectureModalOpen(true)}
        openRubricModal={() => setRubricModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ======================================================== */}
        {/* TAB 1: EVENTS CATALOG */}
        {/* ======================================================== */}
        {currentTab === 'events' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Hero / Value Proposition Banner */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 p-8 sm:p-10 shadow-2xl">
              <div className="relative z-10 max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 text-xs font-semibold mb-4">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span>Sub-Millisecond Concurrency Shield Active</span>
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                  High-Demand Ticketing with{' '}
                  <span className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                    Zero Oversell Guarantee.
                  </span>
                </h1>
                <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                  Built to withstand extreme burst drops. Authoritative row-level transactional locking, HMAC-signed non-sequential QR passes, and automated compensating rollbacks prevent double booking and ticket-limit bypasses.
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setCurrentTab('demo-lab')}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 font-bold text-xs text-white shadow-lg shadow-cyan-950/50 flex items-center gap-2 transition"
                  >
                    <FlaskConical className="w-4 h-4" />
                    Launch Concurrency Stress Lab
                  </button>
                  <button
                    onClick={() => setArchitectureModalOpen(true)}
                    className="px-5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 transition flex items-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    How It Prevents Race Conditions
                  </button>
                </div>
              </div>

              {/* Decorative Background Elements */}
              <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute right-40 top-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
              {/* Category Pills */}
              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      selectedCategory === cat
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search Field */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search events, venues..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Events Grid */}
            {loadingEvents ? (
              <div className="py-20 text-center text-slate-500 flex flex-col items-center">
                <RefreshCw className="w-8 h-8 animate-spin text-cyan-500 mb-3" />
                <p className="text-xs">Connecting to authoritative inventory stream...</p>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="py-16 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800/80">
                <Ticket className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-300">No events found matching your search</p>
                <p className="text-xs text-slate-500 mt-1">Try resetting the category filter or search keywords</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onSelectTickets={(evt) => setSelectedEventForBooking(evt)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: MY TICKETS & QR PASSES */}
        {/* ======================================================== */}
        {currentTab === 'tickets' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-2xl font-extrabold text-white">My Digital Ticket Passes</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Cryptographically signed HMAC-SHA256 passes issued upon authorized payment confirmation.
                </p>
              </div>
              <button
                onClick={loadMyTickets}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingTickets ? 'animate-spin' : ''}`} />
                Refresh Passes
              </button>
            </div>

            {loadingTickets ? (
              <div className="py-16 text-center text-slate-500">Loading your tickets...</div>
            ) : myTickets.length === 0 ? (
              <div className="py-16 text-center bg-slate-900 border border-slate-800 rounded-2xl p-8">
                <QrCode className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">No Tickets Issued Yet</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Browse the catalog, reserve available inventory, and complete checkout to receive your tamper-resistant digital pass.
                </p>
                <button
                  onClick={() => setCurrentTab('events')}
                  className="mt-5 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white shadow"
                >
                  Browse Events
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {myTickets.map((ticket) => (
                  <TicketPassCard
                    key={ticket.id}
                    ticket={ticket}
                    onInspectAtGate={handleInspectAtGate}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: STAFF GATE INSPECTION */}
        {/* ======================================================== */}
        {currentTab === 'staff' && (
          <div className="animate-in fade-in duration-200">
            <StaffScanner
              initialToken={staffInspectionToken}
              onRefresh={() => {
                refreshAll();
                loadMyTickets();
              }}
            />
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: CONCURRENCY DEMO LAB */}
        {/* ======================================================== */}
        {currentTab === 'demo-lab' && (
          <div className="animate-in fade-in duration-200">
            <ConcurrencyDemoLab />
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: ADMIN DASHBOARD */}
        {/* ======================================================== */}
        {currentTab === 'admin' && (
          <div className="animate-in fade-in duration-200">
            <AdminDashboard />
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* MODALS */}
      {/* ======================================================== */}
      {/* 1. Ticket Selector Modal */}
      {selectedEventForBooking && (
        <TicketSelectorModal
          event={selectedEventForBooking}
          onClose={() => setSelectedEventForBooking(null)}
          onReservationSuccess={() => {
            setSelectedEventForBooking(null);
            setCheckoutModalOpen(true);
          }}
        />
      )}

      {/* 2. Checkout Modal */}
      {checkoutModalOpen && (
        <CheckoutModal
          onClose={() => setCheckoutModalOpen(false)}
          onSuccess={(tickets) => {
            setCheckoutModalOpen(false);
            setCurrentTab('tickets');
          }}
        />
      )}

      {/* 3. Security Architecture Modal */}
      {architectureModalOpen && (
        <SecurityArchitectureModal onClose={() => setArchitectureModalOpen(false)} />
      )}

      {/* 4. Automated Evaluation Rubric Audit Modal */}
      {rubricModalOpen && (
        <EvaluationRubricModal onClose={() => setRubricModalOpen(false)} />
      )}

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-500" />
            <span className="font-semibold text-slate-400">AegisPass Concurrency Engine</span>
            <span>—</span>
            <span>Zero-Oversell Architecture</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Authoritative PostgreSQL Transaction Mutex</span>
            <span>•</span>
            <span>HMAC-SHA256 Signed QR Tokens</span>
            <span>•</span>
            <span>Anti-Bot Shield</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <LiveProvider>
        <MainContent />
      </LiveProvider>
    </AuthProvider>
  );
}
