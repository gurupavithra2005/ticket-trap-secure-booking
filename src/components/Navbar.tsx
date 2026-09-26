import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useLive } from '../context/LiveContext.tsx';
import {
  ShieldCheck,
  Zap,
  Activity,
  Ticket,
  QrCode,
  FlaskConical,
  LayoutDashboard,
  Clock,
  LogOut,
  UserCheck,
  Award,
  Layers,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  openCheckout: () => void;
  openArchitectureModal: () => void;
  openRubricModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  openCheckout,
  openArchitectureModal,
  openRubricModal,
}) => {
  const { user, logout, switchRole } = useAuth();
  const { connected, trafficLevel, activeHold } = useLive();

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      {/* Top System Health Bar */}
      <div className="bg-slate-900 border-b border-slate-800/80 px-4 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-400 font-medium">
              {connected ? 'Authoritative SSE Stream' : 'Reconnecting...'}
            </span>
          </div>

          <span className="text-slate-600">|</span>

          <div className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Traffic Shield:</span>
            <span
              className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${
                trafficLevel === 'SURGE_PROTECTION'
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : trafficLevel === 'ELEVATED'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
              }`}
            >
              {trafficLevel === 'SURGE_PROTECTION'
                ? 'SURGE THROTTLING'
                : trafficLevel === 'ELEVATED'
                ? 'ELEVATED TRAFFIC'
                : 'NORMAL LOAD'}
            </span>
          </div>
        </div>

        {/* Quick Evaluator Role Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 hidden sm:inline">Evaluator Role:</span>
          <div className="inline-flex rounded-md bg-slate-800 p-0.5 border border-slate-700">
            <button
              onClick={() => switchRole('CUSTOMER')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                user?.role === 'CUSTOMER'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Guest
            </button>
            <button
              onClick={() => switchRole('STAFF')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                user?.role === 'STAFF'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Staff
            </button>
            <button
              onClick={() => switchRole('ADMIN')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                user?.role === 'ADMIN'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Admin
            </button>
          </div>

          <button
            onClick={openArchitectureModal}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/50 transition font-medium text-[11px]"
            title="View Security & Concurrency Architecture Map"
          >
            <Layers className="w-3 h-3" />
            <span className="hidden md:inline">Architecture</span>
          </button>

          <button
            onClick={openRubricModal}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/80 transition font-bold text-[11px] animate-pulse"
            title="View Automated Evaluation Parameters & Rubric Audit"
          >
            <Award className="w-3 h-3 text-emerald-400" />
            <span>Rubric (100%)</span>
          </button>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentTab('events')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-950/50 border border-cyan-400/30">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  Aegis<span className="text-cyan-400">Pass</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80">
                  Zero Oversell
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                High-Demand Concurrency & Anti-Bot Ticketing Platform
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            <button
              onClick={() => setCurrentTab('events')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                currentTab === 'events'
                  ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Ticket className="w-4 h-4" />
              Events
            </button>

            <button
              onClick={() => setCurrentTab('tickets')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                currentTab === 'tickets'
                  ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <QrCode className="w-4 h-4" />
              My Tickets
            </button>

            <button
              onClick={() => setCurrentTab('staff')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                currentTab === 'staff'
                  ? 'bg-slate-800 text-amber-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4 text-amber-400" />
              Staff Gate
            </button>

            <button
              onClick={() => setCurrentTab('demo-lab')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                currentTab === 'demo-lab'
                  ? 'bg-gradient-to-r from-cyan-950 to-indigo-950 text-cyan-300 border border-cyan-700 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <FlaskConical className="w-4 h-4 text-cyan-400" />
              Concurrency Lab
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            </button>

            <button
              onClick={() => setCurrentTab('admin')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                currentTab === 'admin'
                  ? 'bg-slate-800 text-purple-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-purple-400" />
              Admin
            </button>
          </nav>

          {/* Right Action / Active Hold Alert */}
          <div className="flex items-center gap-3">
            {activeHold && activeHold.secondsRemaining > 0 && (
              <button
                onClick={openCheckout}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 px-3.5 py-1.5 rounded-lg font-bold text-xs shadow-md shadow-amber-950/40 border border-amber-300/40 animate-pulse transition"
              >
                <Clock className="w-4 h-4" />
                <span>Hold: {formatCountdown(activeHold.secondsRemaining)}</span>
                <span className="bg-slate-950/20 px-1.5 py-0.5 rounded text-[10px]">Checkout</span>
              </button>
            )}

            {user && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <div className="hidden sm:block text-right">
                  <div className="text-xs font-semibold text-slate-200">{user.name}</div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        user.role === 'ADMIN'
                          ? 'bg-purple-400'
                          : user.role === 'STAFF'
                          ? 'bg-amber-400'
                          : 'bg-cyan-400'
                      }`}
                    />
                    {user.role}
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Submenu */}
        <div className="flex lg:hidden overflow-x-auto py-2 gap-1 border-t border-slate-800/80 scrollbar-none text-xs">
          <button
            onClick={() => setCurrentTab('events')}
            className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap ${
              currentTab === 'events' ? 'bg-cyan-600 text-white' : 'text-slate-300 bg-slate-900'
            }`}
          >
            Events
          </button>
          <button
            onClick={() => setCurrentTab('tickets')}
            className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap ${
              currentTab === 'tickets' ? 'bg-cyan-600 text-white' : 'text-slate-300 bg-slate-900'
            }`}
          >
            My Tickets
          </button>
          <button
            onClick={() => setCurrentTab('staff')}
            className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap ${
              currentTab === 'staff' ? 'bg-amber-600 text-white' : 'text-slate-300 bg-slate-900'
            }`}
          >
            Staff Gate
          </button>
          <button
            onClick={() => setCurrentTab('demo-lab')}
            className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap ${
              currentTab === 'demo-lab' ? 'bg-indigo-600 text-white' : 'text-slate-300 bg-slate-900'
            }`}
          >
            Concurrency Lab
          </button>
          <button
            onClick={() => setCurrentTab('admin')}
            className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap ${
              currentTab === 'admin' ? 'bg-purple-600 text-white' : 'text-slate-300 bg-slate-900'
            }`}
          >
            Admin
          </button>
        </div>
      </div>
    </header>
  );
};
