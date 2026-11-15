/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import RotatingEarth from '@/components/ui/wireframe-dotted-globe';
import EventFeedSidebar from '@/src/components/dashboard/EventFeedSidebar';
import TrendDossierSidebar from '@/src/components/dashboard/TrendDossierSidebar';
import { SatellitesView, TrendAnalyticsView } from '@/src/components/dashboard/SecondaryTabs';
import {
  EonetEvent,
  RawEonetEvent,
  TimeWindowDays,
  filterEonetEvents,
  getFallbackEvents,
  normalizeEonetEvents,
} from '@/src/utils/eonet';

type WorkspaceTab = 'dashboard' | 'analytics' | 'satellites';

const TIME_WINDOWS: TimeWindowDays[] = [7, 30, 90];

const NAV_TABS: { id: WorkspaceTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'analytics', label: 'Trend Analytics' },
  { id: 'satellites', label: 'Satellites' },
];

function isDashboardPath() {
  return window.location.pathname === '/dashboard';
}

export default function App() {
  const [isDashboard, setIsDashboard] = useState<boolean>(isDashboardPath);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [daysRange, setDaysRange] = useState<TimeWindowDays>(30);
  const [events, setEvents] = useState<EonetEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EonetEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLiveSource, setIsLiveSource] = useState<boolean>(true);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const syncRoute = () => {
      const nextIsDashboard = isDashboardPath();
      setIsDashboard(nextIsDashboard);
      document.documentElement.classList.toggle('is-dashboard', nextIsDashboard);
      const video = document.getElementById('earth-background') as HTMLVideoElement | null;
      if (video) {
        if (nextIsDashboard) {
          video.pause();
        } else {
          video.play().catch(() => {});
        }
      }
    };

    syncRoute();
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('orbisys:navigate', syncRoute);

    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('orbisys:navigate', syncRoute);
    };
  }, []);

  const fetchEonetEvents = useCallback(async (days: TimeWindowDays) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60&days=${days}`,
        { signal: controller.signal },
      );
      if (!response.ok) {
        throw new Error(`EONET HTTP ${response.status}`);
      }
      const data = (await response.json()) as { events?: RawEonetEvent[] };
      const parsed = normalizeEonetEvents(data.events ?? []);
      const finalEvents = parsed.length > 0 ? parsed : getFallbackEvents();

      setEvents(finalEvents);
      setIsLiveSource(parsed.length > 0);
      setSelectedEvent((prev) => {
        if (prev) {
          const match = finalEvents.find((item) => item.id === prev.id);
          if (match) return match;
        }
        return finalEvents[0] ?? null;
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const fallback = getFallbackEvents();
      setEvents(fallback);
      setIsLiveSource(false);
      setSelectedEvent((prev) => {
        if (prev) {
          const match = fallback.find((item) => item.id === prev.id);
          if (match) return match;
        }
        return fallback[0] ?? null;
      });
    } finally {
      if (abortRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isDashboard) return;
    fetchEonetEvents(daysRange);
    return () => {
      abortRef.current?.abort();
    };
  }, [isDashboard, daysRange, fetchEonetEvents]);

  const filteredEvents = useMemo(
    () => filterEonetEvents(events, searchQuery, categoryFilter),
    [events, searchQuery, categoryFilter],
  );

  const handleSelectEvent = useCallback((event: EonetEvent) => {
    setSelectedEvent(event);
  }, []);

  const handleInspectFromAnalytics = useCallback((event: EonetEvent) => {
    setSelectedEvent(event);
    setActiveTab('dashboard');
  }, []);

  const handleInspectCategoryFromSatellites = useCallback(
    (categoryId: string) => {
      setCategoryFilter(categoryId);
      setSearchQuery('');
      const matching = events.find((ev) => ev.categoryId === categoryId);
      if (matching) {
        setSelectedEvent(matching);
      }
      setActiveTab('dashboard');
    },
    [events],
  );

  const navigateHome = () => {
    window.history.pushState(null, '', '/');
    window.dispatchEvent(new CustomEvent('orbisys:navigate'));
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  if (!isDashboard) {
    return null;
  }

  return (
    <div className="dark min-h-screen w-full bg-[#0A0B0D] text-[#F8FAFC] flex flex-col overflow-x-hidden lg:h-screen lg:overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="w-full px-3 sm:px-4 lg:px-6 min-h-14 py-2 md:py-0 md:h-14 border-b border-white/[0.08] bg-[#121418]/95 flex flex-wrap md:flex-nowrap items-center justify-between gap-2 md:gap-4 shrink-0 z-20">
        {/* Left: Bold Orbisys Logo + Glowing Green Live Status Badge */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={navigateHome}
            aria-label="Back to Orbisys home"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.08] transition-colors shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </button>

          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigateHome();
            }}
            className="text-[#F8FAFC] no-underline text-lg font-bold tracking-[-0.025em] leading-none whitespace-nowrap shrink-0"
          >
            Orbisys
          </a>

          <span
            data-testid="live-status-badge"
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#222528] border border-white/[0.1] text-[11px] font-semibold uppercase tracking-[0.04em] leading-none whitespace-nowrap shrink-0 ${
              isLiveSource ? 'text-[#55DCFF]' : 'text-amber-300'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isLiveSource
                  ? 'bg-[#10A373] shadow-[0_0_8px_2px_rgba(16,185,129,0.55)]'
                  : 'bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.45)]'
              }`}
              aria-hidden="true"
            />
            {isLiveSource ? 'LIVE NASA EONET' : 'SNAPSHOT FEED'}
          </span>
        </div>

        {/* Center: Minimalist Navigation Tabs */}
        <nav
          aria-label="Dashboard sections"
          className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-[#0A0B0D] border border-white/[0.08]"
        >
          {NAV_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#121418] text-[#F8FAFC] border border-white/[0.1]'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC] border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Right: Segmented Time-Window Pill Switcher + Subtle Refresh Icon Button */}
        <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0">
          <div
            className="inline-flex items-center p-0.5 rounded-full bg-[#0A0B0D] border border-white/[0.08]"
            role="group"
            aria-label="Trend time window"
          >
            {TIME_WINDOWS.map((win) => {
              const active = daysRange === win;
              return (
                <button
                  key={win}
                  type="button"
                  onClick={() => setDaysRange(win)}
                  aria-pressed={active}
                  className={`px-3 py-1 rounded-full text-xs font-mono tabular-nums font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#F8FAFC] text-[#0A0B0D]'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {win}D
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => fetchEonetEvents(daysRange)}
            disabled={isLoading}
            aria-label="Refresh telemetry feed"
            title="Refresh NASA EONET feed"
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.08] text-[#94A3B8] hover:bg-white/[0.08] hover:text-[#F8FAFC] transition-colors shrink-0 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </header>

      {/* Mobile Nav Tabs Strip */}
      <nav
        aria-label="Mobile dashboard sections"
        className="md:hidden px-3 py-2 border-b border-white/[0.08] bg-[#121418]/80 flex items-center gap-1 shrink-0"
      >
        {NAV_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium text-center transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-[#F8FAFC] text-[#0A0B0D]'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Workspace Body */}
      <main className="flex-1 min-h-0 w-full">
        {activeTab === 'dashboard' ? (
          <div className="h-full w-full p-3 lg:p-4 grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_360px] gap-3 lg:gap-4 items-stretch">
            {/* Left Floating Panel (~320px) */}
            <EventFeedSidebar
              events={filteredEvents}
              totalCount={events.length}
              selectedEventId={selectedEvent?.id ?? null}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              onSelectEvent={handleSelectEvent}
              isLoading={isLoading}
            />

            {/* Center Stage (Hero Interactive 3D Dotted Globe) */}
            <section
              aria-label="Global Anomaly Orbit View"
              className="order-1 lg:order-2 relative flex flex-col items-center justify-center rounded-[16px] bg-[#0A0B0D] py-3 px-2 min-h-[340px] lg:min-h-0 overflow-hidden"
            >
              {/* Subtle Thin Orbital Ring */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <div className="w-[min(84%,560px)] aspect-square rounded-full border border-white/[0.06]" />
                <div className="absolute w-[min(94%,630px)] aspect-square rounded-full border border-dashed border-white/[0.04]" />
              </div>

              <div className="relative z-10 w-full flex-1 flex items-center justify-center min-h-0">
                <RotatingEarth
                  width={680}
                  height={600}
                  events={filteredEvents}
                  selectedEvent={selectedEvent}
                  onSelectEvent={handleSelectEvent}
                />
              </div>

              <div className="relative z-10 mt-1 px-3.5 py-1.5 rounded-full bg-[#121418] border border-white/[0.08] text-[11px] text-[#94A3B8] text-center max-w-full">
                Drag to rotate • Scroll to zoom • Click marker to inspect
              </div>
            </section>

            {/* Right Floating Panel (~360px) */}
            <TrendDossierSidebar
              selectedEvent={selectedEvent}
              allEvents={events}
              daysRange={daysRange}
            />
          </div>
        ) : activeTab === 'analytics' ? (
          <TrendAnalyticsView
            events={events}
            daysRange={daysRange}
            onInspectEvent={handleInspectFromAnalytics}
          />
        ) : (
          <SatellitesView
            events={events}
            onFilterCategoryAndOpenDashboard={handleInspectCategoryFromSatellites}
          />
        )}
      </main>
    </div>
  );
}
