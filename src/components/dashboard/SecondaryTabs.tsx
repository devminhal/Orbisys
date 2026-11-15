import { ArrowUpRight, Radio, Satellite } from 'lucide-react';
import {
  CATEGORY_COLORS,
  EonetEvent,
  TimeWindowDays,
  formatCompactCoords,
  formatRelativeTime,
  getCategoryMeta,
  getOrbitalConstellations,
  summarizeEventsByCategory,
} from '@/src/utils/eonet';

interface TrendAnalyticsViewProps {
  events: EonetEvent[];
  daysRange: TimeWindowDays;
  onInspectEvent: (event: EonetEvent) => void;
}

export function TrendAnalyticsView({
  events,
  daysRange,
  onInspectEvent,
}: TrendAnalyticsViewProps) {
  const summary = summarizeEventsByCategory(events);
  const categories = [
    { id: 'wildfires', label: 'Wildfires', count: summary.wildfires, color: CATEGORY_COLORS.wildfires },
    { id: 'severeStorms', label: 'Severe Storms', count: summary.severeStorms, color: CATEGORY_COLORS.severeStorms },
    { id: 'volcanoes', label: 'Volcanoes', count: summary.volcanoes, color: CATEGORY_COLORS.volcanoes },
    { id: 'seaLakeIce', label: 'Sea & Lake Ice', count: summary.seaLakeIce, color: CATEGORY_COLORS.seaLakeIce },
  ];

  const topPersistent = [...events]
    .sort((a, b) => b.observationCount - a.observationCount)
    .slice(0, 8);

  return (
    <div className="w-full max-w-6xl mx-auto p-4 lg:p-6 space-y-5 overflow-y-auto dashboard-scroll h-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#F8FAFC] tracking-tight">
            Global Anomaly Trend Analytics
          </h1>
          <p className="text-xs text-[#94A3B8]">
            Live category distribution and orbital pass persistence across the {daysRange}-day NASA EONET v3 feed.
          </p>
        </div>
        <span className="text-xs font-mono tabular-nums text-[#94A3B8]">
          {summary.total} open anomalies indexed
        </span>
      </div>

      {/* Category Breakdown Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {categories.map((cat) => {
          const pct = summary.total > 0 ? Math.round((cat.count / summary.total) * 100) : 0;
          return (
            <div
              key={cat.id}
              className="bg-[#121418] border border-white/[0.08] rounded-[16px] p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#94A3B8]">{cat.label}</span>
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: cat.color }}
                  aria-hidden="true"
                />
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl font-mono tabular-nums font-semibold text-[#F8FAFC]">
                  {cat.count}
                </span>
                <span className="text-xs font-mono tabular-nums text-[#94A3B8]">
                  {pct}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(4, pct)}%`, backgroundColor: cat.color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Most Persistent Anomalies Table */}
      <div className="bg-[#121418] border border-white/[0.08] rounded-[16px] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
            Highest Orbital Persistence ({daysRange}D)
          </h2>
          <span className="text-[11px] text-[#94A3B8]">Click any row to focus on globe</span>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {topPersistent.map((ev) => {
            const meta = getCategoryMeta(ev.categoryId, ev.categoryTitle);
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => onInspectEvent(ev)}
                className="w-full text-left px-4 py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: meta.color }}
                    aria-hidden="true"
                  />
                  <span className="text-[11px] font-mono tabular-nums text-[#94A3B8] shrink-0">
                    {ev.id}
                  </span>
                  <span className="text-xs font-medium text-[#F8FAFC] truncate">
                    {ev.title}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-[#94A3B8] shrink-0">
                  <span className="hidden sm:inline">{formatCompactCoords(ev.coordinates)}</span>
                  <span className="text-[#F8FAFC]">{ev.observationCount} obs</span>
                  <span>{formatRelativeTime(ev.date)}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#94A3B8]" aria-hidden="true" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface SatellitesViewProps {
  events: EonetEvent[];
  onFilterCategoryAndOpenDashboard: (categoryId: string) => void;
}

export function SatellitesView({
  events,
  onFilterCategoryAndOpenDashboard,
}: SatellitesViewProps) {
  const constellations = getOrbitalConstellations(events);

  return (
    <div className="w-full max-w-6xl mx-auto p-4 lg:p-6 space-y-5 overflow-y-auto dashboard-scroll h-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#F8FAFC] tracking-tight">
            NASA Earth Observation Constellations
          </h1>
          <p className="text-xs text-[#94A3B8]">
            Active orbital sensor platforms feeding telemetry into Orbisys via NASA EONET v3.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#10B981]">
          <Radio className="w-3.5 h-3.5" aria-hidden="true" />
          4 Sensor Networks Online
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {constellations.map((sat) => (
          <div
            key={sat.id}
            className="bg-[#121418] border border-white/[0.08] rounded-[16px] p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#0A0B0D] border border-white/[0.08] flex items-center justify-center shrink-0">
                    <Satellite className="w-4 h-4" style={{ color: sat.color }} aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[#F8FAFC]">{sat.name}</h2>
                    <p className="text-[11px] font-mono text-[#94A3B8]">{sat.agency}</p>
                  </div>
                </div>
                <span className="text-xs font-mono tabular-nums px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-[#F8FAFC]">
                  {sat.activeCount} active
                </span>
              </div>

              <p className="text-xs text-[#94A3B8] leading-relaxed">
                {sat.description}
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-xl bg-[#0A0B0D] border border-white/[0.06] px-3 py-2">
                  <p className="text-[10px] text-[#94A3B8]">Orbit Profile</p>
                  <p className="text-[11px] font-mono text-[#F8FAFC] truncate">{sat.orbit}</p>
                </div>
                <div className="rounded-xl bg-[#0A0B0D] border border-white/[0.06] px-3 py-2">
                  <p className="text-[10px] text-[#94A3B8]">Primary Payload</p>
                  <p className="text-[11px] font-mono text-[#F8FAFC] truncate">{sat.sensors}</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onFilterCategoryAndOpenDashboard(sat.targetCategory)}
              className="w-full h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-xs font-medium text-[#F8FAFC] transition-colors cursor-pointer"
            >
              Inspect Active Detections on Globe
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
