import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, ConcurrencyMetricsData, SecurityLogItem } from '../services/api.ts';
import { useAuth } from './AuthContext.tsx';

interface ActiveHold {
  reservation: any;
  items: any[];
  event: any;
  secondsRemaining: number;
}

interface LiveContextType {
  connected: boolean;
  inventoryVersion: number;
  recentSecurityEvents: SecurityLogItem[];
  metrics: ConcurrencyMetricsData;
  trafficLevel: 'NORMAL' | 'ELEVATED' | 'SURGE_PROTECTION';
  activeHold: ActiveHold | null;
  refreshActiveHold: () => Promise<void>;
  refreshAll: () => void;
}

const defaultMetrics: ConcurrencyMetricsData = {
  concurrentAttempts: 0,
  successfulReservations: 0,
  rejectedDuplicates: 0,
  oversellAttemptsBlocked: 0,
  purchaseLimitViolationsBlocked: 0,
  rateLimitedRequests: 0,
  botSuspiciousDetected: 0,
  expiredHoldsReleased: 0,
};

const LiveContext = createContext<LiveContextType | undefined>(undefined);

export const LiveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [inventoryVersion, setInventoryVersion] = useState(1);
  const [recentSecurityEvents, setRecentSecurityEvents] = useState<SecurityLogItem[]>([]);
  const [metrics, setMetrics] = useState<ConcurrencyMetricsData>(defaultMetrics);
  const [activeHold, setActiveHold] = useState<ActiveHold | null>(null);

  // Derive traffic level from activity
  const trafficLevel =
    metrics.concurrentAttempts > 30 || metrics.rateLimitedRequests > 5
      ? 'SURGE_PROTECTION'
      : metrics.concurrentAttempts > 10
      ? 'ELEVATED'
      : 'NORMAL';

  const refreshActiveHold = useCallback(async () => {
    if (!user) {
      setActiveHold(null);
      return;
    }
    try {
      const res = await api.getActiveReservation();
      if (res.success && res.active) {
        setActiveHold(res.active);
      } else {
        setActiveHold(null);
      }
    } catch {
      setActiveHold(null);
    }
  }, [user]);

  const refreshAll = useCallback(() => {
    setInventoryVersion((v) => v + 1);
    refreshActiveHold();
  }, [refreshActiveHold]);

  // Active hold local countdown timer
  useEffect(() => {
    if (!activeHold || activeHold.secondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setActiveHold((prev) => {
        if (!prev) return null;
        if (prev.secondsRemaining <= 1) {
          // Trigger server refresh on expiration
          setInventoryVersion((v) => v + 1);
          return null;
        }
        return {
          ...prev,
          secondsRemaining: prev.secondsRemaining - 1,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeHold]);

  // Connect to SSE stream
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/events/live-stream');

        eventSource.onopen = () => {
          setConnected(true);
        };

        eventSource.addEventListener('init', (e: any) => {
          try {
            const data = JSON.parse(e.data);
            if (data.metrics) setMetrics(data.metrics);
          } catch (err) {
            console.error('Error parsing init event', err);
          }
        });

        eventSource.addEventListener('inventory_update', () => {
          setInventoryVersion((v) => v + 1);
          refreshActiveHold();
        });

        eventSource.addEventListener('security_event', (e: any) => {
          try {
            const item: SecurityLogItem = JSON.parse(e.data);
            setRecentSecurityEvents((prev) => [item, ...prev].slice(0, 50));
          } catch (err) {
            console.error('Error parsing security event', err);
          }
        });

        eventSource.addEventListener('metrics_update', (e: any) => {
          try {
            const data: ConcurrencyMetricsData = JSON.parse(e.data);
            setMetrics(data);
          } catch (err) {
            console.error('Error parsing metrics update', err);
          }
        });

        eventSource.onerror = () => {
          setConnected(false);
          eventSource?.close();
          // Reconnect with exponential backoff
          reconnectTimeout = setTimeout(connectSSE, 3000);
        };
      } catch (err) {
        console.error('SSE initialization error:', err);
        setConnected(false);
        reconnectTimeout = setTimeout(connectSSE, 4000);
      }
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [refreshActiveHold]);

  // Refresh active hold on auth change
  useEffect(() => {
    refreshActiveHold();
  }, [user, refreshActiveHold]);

  return (
    <LiveContext.Provider
      value={{
        connected,
        inventoryVersion,
        recentSecurityEvents,
        metrics,
        trafficLevel,
        activeHold,
        refreshActiveHold,
        refreshAll,
      }}
    >
      {children}
    </LiveContext.Provider>
  );
};

export const useLive = () => {
  const context = useContext(LiveContext);
  if (!context) {
    throw new Error('useLive must be used within a LiveProvider');
  }
  return context;
};
