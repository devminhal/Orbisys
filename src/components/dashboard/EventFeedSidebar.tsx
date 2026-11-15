import {
  Activity,
  CloudLightning,
  Flame,
  Search,
  Snowflake,
  TriangleAlert,
  X,
} from 'lucide-react';
import {
  EonetEvent,
  formatRelativeTime,
  getCategoryMeta,
} from '@/src/utils/eonet';

export const CATEGORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'wildfires', label: 'Wildfires' },
  { id: 'severeStorms', label: 'Storms' },
  { id: 'volcanoes', label: 'Volcanoes' },
  { id: 'seaLakeIce', label: 'Ice' },
] as const;

interface EventFeedSidebarProps {
  events: EonetEvent[];
  totalCount: number;
  selectedEventId: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (cat: string) => void;
  onSelectEvent: (event: EonetEvent) => void;
  isLoading: boolean;
}

function CategoryIcon({ categoryId, color }: { categoryId: string; color: string }) {
  const props = { className: 'w-3.5 h-3.5 shrink-0', style: { color }, 'aria-hidden': true as const };
  switch (categoryId) {
    case 'wildfires':
      return <Flame {...props} />;
    case 'severeStorms':
      return <CloudLightning {...props} />;
    case 'volcanoes':
      return <TriangleAlert {...props} />;
    case 'seaLakeIce':
      return <Snowflake {...props} />;
    default:
      return <Activity {...props} />;
  }
}

export default function EventFeedSidebar({
  events,
  totalCount,
  selectedEventId,
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  onSelectEvent,
  isLoading,
}: EventFeedSidebarProps) {
  return (
    <aside
      aria-label="Live Satellite Events"
      className="order-2 lg:order-1 flex flex-col bg-[#121418] border border-white/[0.08] rounded-[16px] overflow-hidden lg:h-full max-h-[540px] lg:max-h-none"
    >
      <div className="p-4 border-b border-white/[0.08] space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-[#F8FAFC]">
            Live Satellite Events
          </h2>
          <span className="text-xs font-mono tabular-nums text-[#94A3B8]">
            {events.length}/{totalCount}
          </span>
        </div>

        <div className="relative">
          <Search
            className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter region or event..."
            aria-label="Filter region or event"
            className="w-full h-9 pl-9 pr-8 rounded-xl bg-[#0A0B0D] border border-white/[0.08] text-xs text-[#F8FAFC] placeholder:text-[#94A3B8]/60 focus:outline-none focus:border-white/25"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search query"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div
          className="flex items-center justify-between gap-1"
          role="group"
          aria-label="Filter events by category"
        >
          {CATEGORY_FILTERS.map((cat) => {
            const active = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onCategoryFilterChange(cat.id)}
                aria-pressed={active}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium text-center transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#F8FAFC] text-[#0A0B0D]'
                    : 'bg-white/[0.03] text-[#94A3B8] hover:bg-white/[0.08] hover:text-[#F8FAFC] border border-white/[0.06]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto dashboard-scroll p-3 space-y-2" data-testid="event-feed-list">
        {isLoading && events.length === 0 ? (
          <div className="space-y-2" aria-label="Loading satellite events">
            {[0, 1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="h-24 rounded-xl bg-white/[0.04] border border-white/[0.06] animate-pulse"
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-3">
            <p className="text-sm font-medium text-[#F8FAFC]">
              No matching anomalies found
            </p>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Adjust your search terms or switch category filters to inspect active NASA EONET detections.
            </p>
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                onCategoryFilterChange('all');
              }}
              className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-[#F8FAFC] transition-colors cursor-pointer"
            >
              Reset filters
            </button>
          </div>
        ) : (
          events.map((ev) => {
            const isSelected = ev.id === selectedEventId;
            const meta = getCategoryMeta(ev.categoryId, ev.categoryTitle);

            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => onSelectEvent(ev)}
                aria-current={isSelected ? 'true' : undefined}
                className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-white/[0.08] border-white/25'
                    : 'bg-[#0A0B0D]/60 border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.14]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <CategoryIcon categoryId={ev.categoryId} color={meta.color} />
                    <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-[#94A3B8] truncate">
                      {ev.id}
                    </span>
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-[#94A3B8] shrink-0">
                    {formatRelativeTime(ev.date)}
                  </span>
                </div>

                <p className="text-xs font-medium text-[#F8FAFC] leading-snug line-clamp-2 mb-2">
                  {ev.title}
                </p>

                <div className="flex items-center justify-between gap-2 text-[11px] text-[#94A3B8]">
                  <span className="truncate">{meta.label}</span>
                  <span className="font-mono tabular-nums shrink-0 text-[#F8FAFC]/80">
                    {ev.observationCount} obs
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
