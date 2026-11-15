import { ArrowUpRight, Globe, Sparkles } from 'lucide-react';
import {
  EonetEvent,
  TimeWindowDays,
  buildTrendSynthesis,
  computeDossierAnalytics,
  formatCompactCoords,
  formatRelativeTime,
  getAerosolRiskLabel,
  getCategoryMeta,
  getPersistenceIndex,
  getSatelliteMapUrl,
} from '@/src/utils/eonet';
import TrendSparkline from './TrendSparkline';

interface TrendDossierSidebarProps {
  selectedEvent: EonetEvent | null;
  allEvents: EonetEvent[];
  daysRange: TimeWindowDays;
}

export default function TrendDossierSidebar({
  selectedEvent,
  allEvents,
  daysRange,
}: TrendDossierSidebarProps) {
  if (!selectedEvent) {
    return (
      <aside
        aria-label="Earth System Trend Synthesis"
        className="order-3 flex flex-col justify-center items-center text-center bg-[#121418] border border-white/[0.08] rounded-[16px] p-6 lg:h-full"
      >
        <p className="text-sm font-semibold text-[#F8FAFC] mb-1.5">
          Earth System Trend Synthesis
        </p>
        <p className="text-xs text-[#94A3B8] max-w-xs leading-relaxed">
          Select an anomaly from Live Satellite Events or click any marker on the globe to inspect its orbital synthesis dossier.
        </p>
      </aside>
    );
  }

  const meta = getCategoryMeta(selectedEvent.categoryId, selectedEvent.categoryTitle);
  const compactCoords = formatCompactCoords(selectedEvent.coordinates);
  const synthesis = buildTrendSynthesis(selectedEvent, daysRange);
  const analytics = computeDossierAnalytics(selectedEvent, allEvents, daysRange);
  const persistenceIndex = getPersistenceIndex(analytics.persistenceScore);
  const riskLabel = getAerosolRiskLabel(analytics.severityIndex);
  const satelliteMapUrl = getSatelliteMapUrl(selectedEvent.coordinates, selectedEvent.date);
  const lastSync = formatRelativeTime(selectedEvent.date);

  return (
    <aside
      aria-label="Earth System Trend Synthesis"
      data-testid="dossier-panel"
      className="order-3 flex flex-col bg-[#121418] border border-white/[0.08] rounded-[16px] overflow-hidden lg:h-full"
    >
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between gap-2 shrink-0">
        <h2 className="text-xs font-semibold tracking-tight text-[#94A3B8] uppercase">
          Earth System Trend Synthesis
        </h2>
        <span className="text-[11px] font-mono tabular-nums text-[#94A3B8]">
          {daysRange}D Window
        </span>
      </div>

      {/* Dossier Body */}
      <div className="flex-1 overflow-y-auto dashboard-scroll p-3.5 space-y-3">
        {/* Header: Active category pill, Event ID, and bold title */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium ${meta.badgeClass}`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: meta.color }}
                aria-hidden="true"
              />
              {meta.label}
            </span>
            <span className="text-xs font-mono tabular-nums text-[#94A3B8]">
              {selectedEvent.id}
            </span>
          </div>

          <h3 className="text-[15px] font-semibold text-[#F8FAFC] leading-snug">
            {selectedEvent.title}
          </h3>
        </div>

        {/* Highlighted Insight Box with Sparkle Icon */}
        <section
          aria-label="Orbital detection synthesis"
          className="rounded-xl bg-[#0A0B0D]/80 border border-white/[0.08] p-3 space-y-2"
        >
          <div className="flex items-center gap-2 text-[11px] font-medium text-[#F8FAFC]">
            <Sparkles
              className="w-3.5 h-3.5 shrink-0"
              style={{ color: meta.color }}
              aria-hidden="true"
            />
            <span className="truncate">{synthesis.sensorSuite}</span>
          </div>
          <p className="text-[11px] text-[#94A3B8] leading-relaxed">
            {synthesis.mechanism}
          </p>
          <p className="text-[11px] text-[#F8FAFC]/85 leading-relaxed pt-1.5 border-t border-white/[0.06]">
            {synthesis.environmentalRisk}
          </p>
        </section>

        {/* Active Coordinates & Telemetry Grid (2x2) */}
        <section aria-label="Active Coordinates and Telemetry">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-xl bg-[#0A0B0D]/70 border border-white/[0.08] px-2.5 py-2">
              <p className="text-[10px] text-[#94A3B8] mb-0.5">Latitude / Longitude</p>
              <p className="text-[11px] font-mono tabular-nums font-medium text-[#F8FAFC] truncate">
                {compactCoords}
              </p>
            </div>
            <div className="rounded-xl bg-[#0A0B0D]/70 border border-white/[0.08] px-2.5 py-2">
              <p className="text-[10px] text-[#94A3B8] mb-0.5">Observation Count</p>
              <p className="text-[11px] font-mono tabular-nums font-medium text-[#F8FAFC]">
                {selectedEvent.observationCount} passes
              </p>
            </div>
            <div className="rounded-xl bg-[#0A0B0D]/70 border border-white/[0.08] px-2.5 py-2">
              <p className="text-[10px] text-[#94A3B8] mb-0.5">Reported Magnitude</p>
              <p className="text-[11px] font-mono tabular-nums font-medium text-[#F8FAFC] truncate">
                {selectedEvent.magnitude}
              </p>
            </div>
            <div className="rounded-xl bg-[#0A0B0D]/70 border border-white/[0.08] px-2.5 py-2">
              <p className="text-[10px] text-[#94A3B8] mb-0.5">Last Sync</p>
              <p className="text-[11px] font-mono tabular-nums font-medium text-[#F8FAFC]">
                {lastSync}
              </p>
            </div>
          </div>
        </section>

        {/* Risk & Trend Metrics */}
        <section aria-label="Risk and Trend Metrics" className="space-y-1.5">
          <div className="rounded-xl bg-[#0A0B0D]/70 border border-white/[0.08] px-3 py-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] text-[#94A3B8] truncate">{daysRange}D Category Trend</p>
              <p className="text-xs font-mono tabular-nums font-semibold text-[#F8FAFC]">
                +{analytics.categorySharePct}%
              </p>
            </div>
            <div className="w-24 shrink-0">
              <TrendSparkline
                values={analytics.categoryTrendSeries}
                color={meta.color}
                height={26}
                label={`${daysRange}D category trend sparkline`}
              />
            </div>
          </div>

          <div className="rounded-xl bg-[#0A0B0D]/70 border border-white/[0.08] px-3 py-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] text-[#94A3B8] truncate">Persistence Index</p>
              <p className="text-xs font-mono tabular-nums font-semibold text-[#F8FAFC]">
                {persistenceIndex}
              </p>
            </div>
            <div className="w-24 shrink-0">
              <TrendSparkline
                values={analytics.persistenceSeries}
                color="#3B82F6"
                height={26}
                label="Persistence index sparkline"
              />
            </div>
          </div>

          <div className="rounded-xl bg-[#0A0B0D]/70 border border-white/[0.08] px-3 py-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] text-[#94A3B8] truncate">Regional Aerosol Risk</p>
              <p className="text-xs font-mono tabular-nums font-semibold text-[#F8FAFC]">
                {riskLabel} ({analytics.severityIndex})
              </p>
            </div>
            <div className="w-24 shrink-0">
              <TrendSparkline
                values={analytics.severitySeries}
                color={meta.color}
                height={26}
                label="Regional aerosol risk sparkline"
              />
            </div>
          </div>
        </section>

        {/* Footer CTA Buttons */}
        <section aria-label="Verification Links" className="space-y-1.5 pt-0.5">
          <a
            href={selectedEvent.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl bg-[#F8FAFC] text-[#0A0B0D] text-xs font-semibold hover:bg-white transition-colors whitespace-nowrap"
          >
            <span>View Official NASA Source</span>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          </a>
          <a
            href={satelliteMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl bg-transparent border border-white/[0.12] text-[#F8FAFC] text-xs font-medium hover:bg-white/[0.05] transition-colors whitespace-nowrap"
          >
            <Globe className="w-3.5 h-3.5 shrink-0 text-[#94A3B8]" aria-hidden="true" />
            <span>Inspect Satellite Terrain</span>
          </a>
        </section>
      </div>
    </aside>
  );
}
