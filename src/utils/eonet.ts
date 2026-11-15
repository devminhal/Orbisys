export type TimeWindowDays = 7 | 30 | 90;

export type EventCategoryId =
  | 'wildfires'
  | 'severeStorms'
  | 'volcanoes'
  | 'seaLakeIce'
  | string;

export interface GeometryObservation {
  date: string;
  coordinates: [number, number];
  magnitudeValue: number | null;
  magnitudeUnit: string | null;
}

export interface EonetEvent {
  id: string;
  title: string;
  categoryId: EventCategoryId;
  categoryTitle: string;
  coordinates: [number, number]; // [lng, lat]
  date: string;
  observationCount: number;
  magnitude: string;
  magnitudeValue: number | null;
  magnitudeUnit: string | null;
  sourceUrl: string;
  observations: GeometryObservation[];
}

export interface CategoryMeta {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  badgeClass: string;
  dotClass: string;
}

export const CATEGORY_COLORS: Record<string, string> = {
  wildfires: '#F97316',
  severeStorms: '#3B82F6',
  volcanoes: '#EF4444',
  seaLakeIce: '#06B6D4',
  default: '#10B981',
};

export function getCategoryColor(categoryId: string): string {
  return CATEGORY_COLORS[categoryId] ?? CATEGORY_COLORS.default;
}

export function getCategoryMeta(categoryId: string, categoryTitle?: string): CategoryMeta {
  switch (categoryId) {
    case 'wildfires':
      return {
        id: 'wildfires',
        label: categoryTitle || 'Wildfires',
        shortLabel: 'Wildfires',
        color: '#F97316',
        badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
        dotClass: 'bg-orange-500',
      };
    case 'severeStorms':
      return {
        id: 'severeStorms',
        label: categoryTitle || 'Severe Storms',
        shortLabel: 'Storms',
        color: '#3B82F6',
        badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
        dotClass: 'bg-blue-500',
      };
    case 'volcanoes':
      return {
        id: 'volcanoes',
        label: categoryTitle || 'Volcanoes',
        shortLabel: 'Volcanoes',
        color: '#EF4444',
        badgeClass: 'bg-red-500/15 text-red-300 border-red-500/30',
        dotClass: 'bg-red-500',
      };
    case 'seaLakeIce':
      return {
        id: 'seaLakeIce',
        label: categoryTitle || 'Sea & Lake Ice',
        shortLabel: 'Ice',
        color: '#06B6D4',
        badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
        dotClass: 'bg-cyan-500',
      };
    default:
      return {
        id: categoryId || 'other',
        label: categoryTitle || 'Environmental Anomaly',
        shortLabel: 'Other',
        color: '#10B981',
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        dotClass: 'bg-emerald-500',
      };
  }
}

export interface RawEonetGeometry {
  magnitudeValue?: number | null;
  magnitudeUnit?: string | null;
  date?: string;
  type?: string;
  coordinates?: unknown;
}

export interface RawEonetEvent {
  id: string;
  title: string;
  link?: string;
  categories?: Array<{ id: string; title: string }>;
  sources?: Array<{ id: string; url: string }>;
  geometry?: RawEonetGeometry[];
}

export function extractCoordinates(type: string | undefined, coords: unknown): [number, number] | null {
  if (!Array.isArray(coords) || coords.length === 0) return null;

  if (type === 'Polygon' || Array.isArray(coords[0])) {
    // Polygon geometry: [[[lng, lat], ...]]
    const ring = Array.isArray((coords[0] as unknown[])?.[0])
      ? (coords[0] as unknown[])
      : coords;
    let sumLng = 0;
    let sumLat = 0;
    let count = 0;
    for (const pt of ring) {
      if (Array.isArray(pt) && typeof pt[0] === 'number' && typeof pt[1] === 'number') {
        sumLng += pt[0];
        sumLat += pt[1];
        count++;
      }
    }
    if (count === 0) return null;
    return [Number((sumLng / count).toFixed(4)), Number((sumLat / count).toFixed(4))];
  }

  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    if (!Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return null;
    return [coords[0], coords[1]];
  }

  return null;
}

export function formatMagnitude(value: number | null | undefined, unit: string | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Not reported';
  }
  const formattedVal = Number.isInteger(value) ? value.toLocaleString('en-US') : value.toFixed(1);
  return unit ? `${formattedVal} ${unit}` : formattedVal;
}

export function normalizeEonetEvents(rawEvents: RawEonetEvent[]): EonetEvent[] {
  const normalized: EonetEvent[] = [];

  for (const raw of rawEvents) {
    if (!raw || !raw.id || !raw.title) continue;
    const category = raw.categories?.[0] ?? { id: 'other', title: 'Environmental Anomaly' };
    const observations: GeometryObservation[] = [];

    for (const g of raw.geometry ?? []) {
      const point = extractCoordinates(g.type, g.coordinates);
      if (!point) continue;
      observations.push({
        date: g.date || new Date().toISOString(),
        coordinates: point,
        magnitudeValue: typeof g.magnitudeValue === 'number' ? g.magnitudeValue : null,
        magnitudeUnit: g.magnitudeUnit ?? null,
      });
    }

    if (observations.length === 0) continue;

    // Sort observations chronologically ascending so last is latest
    observations.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const latest = observations[observations.length - 1];
    const bestMagnitudeObs =
      [...observations].reverse().find((o) => o.magnitudeValue !== null) ?? latest;

    const sourceUrl =
      raw.sources?.find((s) => typeof s.url === 'string' && s.url.startsWith('http'))?.url ??
      raw.link ??
      `https://eonet.gsfc.nasa.gov/api/v3/events/${encodeURIComponent(raw.id)}`;

    normalized.push({
      id: raw.id,
      title: raw.title.trim(),
      categoryId: category.id,
      categoryTitle: category.title,
      coordinates: latest.coordinates,
      date: latest.date,
      observationCount: observations.length,
      magnitude: formatMagnitude(bestMagnitudeObs.magnitudeValue, bestMagnitudeObs.magnitudeUnit),
      magnitudeValue: bestMagnitudeObs.magnitudeValue,
      magnitudeUnit: bestMagnitudeObs.magnitudeUnit,
      sourceUrl,
      observations,
    });
  }

  // Sort most recently observed first
  normalized.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return normalized;
}

export function formatCoordinates(coords: [number, number]): { lat: string; lng: string } {
  const [lng, lat] = coords;
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return {
    lat: `${Math.abs(lat).toFixed(3)}° ${latDir}`,
    lng: `${Math.abs(lng).toFixed(3)}° ${lngDir}`,
  };
}

export function getClimateZoneLabel(lat: number): string {
  const absLat = Math.abs(lat);
  if (absLat >= 66.5) return 'Polar / Cryosphere Band';
  if (absLat >= 50) return 'Boreal / Subpolar Belt';
  if (absLat >= 23.5) return 'Temperate Mid-Latitude Zone';
  return 'Tropical / Equatorial Belt';
}

export interface TrendSynthesis {
  sensorSuite: string;
  mechanism: string;
  environmentalRisk: string;
  climateZone: string;
}

export function buildTrendSynthesis(event: EonetEvent, daysRange: TimeWindowDays): TrendSynthesis {
  const [, lat] = event.coordinates;
  const climateZone = getClimateZoneLabel(lat);
  const obsText = `${event.observationCount} sequential orbital pass${event.observationCount === 1 ? '' : 'es'}`;

  switch (event.categoryId) {
    case 'wildfires':
      return {
        sensorSuite: 'MODIS (Terra/Aqua) · VIIRS 375m Thermal Band',
        climateZone,
        mechanism: `NASA FIRMS/VIIRS infrared channels isolate persistent 3.9–11 µm thermal radiative anomalies across ${obsText} within the ${daysRange}D monitoring window.`,
        environmentalRisk: `Elevated canopy combustion releases fine particulate aerosols (PM2.5) and black carbon, accelerating regional surface albedo darkening and localized drought-feedback warming in the ${climateZone.toLowerCase()}.`,
      };
    case 'severeStorms':
      return {
        sensorSuite: 'GOES / Himawari IR · GPM IMERG Precipitation',
        climateZone,
        mechanism: `Geostationary infrared cloud-top temperature gradients and GPM microwave scatterometry track deep convective eyewall organization across ${obsText} in the ${daysRange}D window.`,
        environmentalRisk: `High sea-surface enthalpy sustains rapid barometric intensification, elevating coastal storm-surge flooding, extreme precipitation runoff, and marine boundary-layer wind shear risk.`,
      };
    case 'volcanoes':
      return {
        sensorSuite: 'TROPOMI / OMI SO₂ · ASTER Shortwave IR',
        climateZone,
        mechanism: `Hyperspectral UV/SWIR sensors resolve elevated sulfur dioxide (SO₂) column density and summit lava-dome thermal radiance across ${obsText} over the ${daysRange}D interval.`,
        environmentalRisk: `Stratospheric aerosol injection and fine silicate ash plumes pose aviation corridor hazards, regional air-quality degradation, and transient radiative forcing across downwind basins.`,
      };
    case 'seaLakeIce':
      return {
        sensorSuite: 'AMSR2 Microwave Radiometry · ICESat-2 Altimetry',
        climateZone,
        mechanism: `All-weather passive microwave brightness contrast and laser altimetry track tabular ice-edge drift and calving fracture geometry across ${obsText} during the ${daysRange}D window.`,
        environmentalRisk: `Progressive ice-shelf retreat reduces polar solar reflectance (ice-albedo feedback), alters thermohaline freshwater stratification, and introduces maritime drift hazards.`,
      };
    default:
      return {
        sensorSuite: 'Landsat OLI · Sentinel / GRACE-FO Multi-Sensor',
        climateZone,
        mechanism: `Multi-spectral optical reflectance and gravimetric anomaly passes register sustained surface-state departure from seasonal baselines across ${obsText} in the ${daysRange}D window.`,
        environmentalRisk: `Continued anomaly persistence disrupts watershed balance, soil moisture retention, and ecosystem resilience across the surrounding ${climateZone.toLowerCase()}.`,
      };
  }
}

export interface CategorySummaryCounts {
  total: number;
  wildfires: number;
  severeStorms: number;
  volcanoes: number;
  seaLakeIce: number;
  other: number;
}

export function summarizeEventsByCategory(events: EonetEvent[]): CategorySummaryCounts {
  const counts: CategorySummaryCounts = {
    total: events.length,
    wildfires: 0,
    severeStorms: 0,
    volcanoes: 0,
    seaLakeIce: 0,
    other: 0,
  };

  for (const ev of events) {
    if (ev.categoryId === 'wildfires') counts.wildfires++;
    else if (ev.categoryId === 'severeStorms') counts.severeStorms++;
    else if (ev.categoryId === 'volcanoes') counts.volcanoes++;
    else if (ev.categoryId === 'seaLakeIce') counts.seaLakeIce++;
    else counts.other++;
  }
  return counts;
}

export function filterEonetEvents(
  events: EonetEvent[],
  searchQuery: string,
  categoryFilter: string,
): EonetEvent[] {
  const q = searchQuery.trim().toLowerCase();
  return events.filter((ev) => {
    const matchesCategory =
      categoryFilter === 'all' ||
      (categoryFilter === 'other'
        ? !['wildfires', 'severeStorms', 'volcanoes', 'seaLakeIce'].includes(ev.categoryId)
        : ev.categoryId === categoryFilter);

    if (!matchesCategory) return false;
    if (!q) return true;

    return (
      ev.title.toLowerCase().includes(q) ||
      ev.id.toLowerCase().includes(q) ||
      ev.categoryTitle.toLowerCase().includes(q) ||
      getClimateZoneLabel(ev.coordinates[1]).toLowerCase().includes(q)
    );
  });
}

export interface DossierAnalytics {
  categorySharePct: number;
  categoryTrendSeries: number[];
  persistenceScore: number;
  persistenceSeries: number[];
  severityIndex: number;
  severitySeries: number[];
}

export function computeDossierAnalytics(
  event: EonetEvent,
  allEvents: EonetEvent[],
  daysRange: TimeWindowDays,
  referenceNowMs: number = Date.now(),
): DossierAnalytics {
  const sameCategory = allEvents.filter((e) => e.categoryId === event.categoryId);
  const categorySharePct =
    allEvents.length > 0 ? Math.round((sameCategory.length / allEvents.length) * 100) : 0;

  // Build 10-bucket temporal trend for this category over [referenceNowMs - daysRange, referenceNowMs]
  const buckets = 10;
  const windowMs = daysRange * 24 * 60 * 60 * 1000;
  const startMs = referenceNowMs - windowMs;
  const categoryTrendSeries: number[] = Array.from({ length: buckets }, () => 0);

  for (const item of sameCategory) {
    const ts = Date.parse(item.date);
    if (!Number.isFinite(ts)) continue;
    const ratio = (ts - startMs) / windowMs;
    const idx = Math.max(0, Math.min(buckets - 1, Math.floor(ratio * buckets)));
    categoryTrendSeries[idx] += 1;
  }

  // Ensure visible non-flat baseline if single/clustered observations
  if (Math.max(...categoryTrendSeries) === 0) {
    categoryTrendSeries[buckets - 1] = Math.max(1, sameCategory.length);
  }

  // Persistence score (0-100): derived from observation count & span across window
  const firstObsMs = Date.parse(event.observations[0]?.date ?? event.date);
  const lastObsMs = Date.parse(event.date);
  const spanDays = Number.isFinite(firstObsMs) && Number.isFinite(lastObsMs)
    ? Math.max(1, (lastObsMs - firstObsMs) / (24 * 60 * 60 * 1000))
    : 1;

  const obsFactor = Math.min(60, Math.round(Math.log2(event.observationCount + 1) * 15));
  const spanFactor = Math.min(40, Math.round((spanDays / Math.max(7, daysRange * 0.6)) * 40));
  const persistenceScore = Math.max(18, Math.min(99, obsFactor + spanFactor));

  // Build persistence progression sparkline from cumulative observations
  const persistenceSeries: number[] = [];
  const obsCount = event.observations.length;
  for (let i = 0; i < 8; i++) {
    const progress = (i + 1) / 8;
    const stepObs = Math.max(1, Math.round(obsCount * progress));
    const val = Math.min(
      99,
      Math.max(14, Math.round((Math.log2(stepObs + 1) / Math.log2(obsCount + 2)) * persistenceScore)),
    );
    persistenceSeries.push(val);
  }

  // Hazard severity index (0-100) based on category weight + magnitude + pass cadence
  const categoryBase: Record<string, number> = {
    volcanoes: 68,
    severeStorms: 64,
    wildfires: 58,
    seaLakeIce: 52,
  };
  const base = categoryBase[event.categoryId] ?? 50;
  const magBoost =
    event.magnitudeValue !== null && event.magnitudeValue > 0
      ? Math.min(24, Math.round(Math.log10(event.magnitudeValue + 1) * 8))
      : 10;
  const cadenceBoost = Math.min(12, event.observationCount);
  const severityIndex = Math.max(25, Math.min(98, base + magBoost + cadenceBoost - 8));

  // Build severity intensity trajectory from observation magnitudes or cadence progression
  const severitySeries: number[] = [];
  if (obsCount >= 4) {
    const step = Math.max(1, Math.floor(obsCount / 8));
    for (let i = 0; i < obsCount && severitySeries.length < 8; i += step) {
      const obs = event.observations[i];
      const mVal = obs.magnitudeValue;
      const pointScore =
        mVal !== null && mVal > 0
          ? Math.min(98, base + Math.min(26, Math.round(Math.log10(mVal + 1) * 8)))
          : Math.min(98, Math.max(25, severityIndex - 10 + ((i * 3) % 14)));
      severitySeries.push(pointScore);
    }
  }
  while (severitySeries.length < 8) {
    const idx = severitySeries.length;
    const wave = Math.round(Math.sin(idx * 0.85) * 6 + idx * 1.6);
    severitySeries.push(Math.max(22, Math.min(98, severityIndex - 8 + wave)));
  }

  return {
    categorySharePct,
    categoryTrendSeries,
    persistenceScore,
    persistenceSeries,
    severityIndex,
    severitySeries,
  };
}

export function buildShortCanvasLabel(event: EonetEvent): string {
  const cleanTitle = event.title.replace(/\s+/g, ' ').trim();
  if (cleanTitle.length <= 24) return cleanTitle;
  return `${cleanTitle.slice(0, 22).trim()}…`;
}

export function formatCompactCoords(coords: [number, number]): string {
  const [lng, lat] = coords;
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}° ${latDir}, ${Math.abs(lng).toFixed(2)}° ${lngDir}`;
}

export function formatRelativeTime(isoDate: string, nowMs: number = Date.now()): string {
  const ts = Date.parse(isoDate);
  if (!Number.isFinite(ts)) return 'Recent';
  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 3600) {
    const mins = Math.max(1, Math.floor(diffSec / 60));
    return `${mins}m ago`;
  }
  const diffHours = Math.floor(diffSec / 3600);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays}d ago`;
  }
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getPersistenceIndex(persistenceScore: number): string {
  const outOfTen = Math.max(1, Math.min(9.9, persistenceScore / 10));
  return `${outOfTen.toFixed(1)}/10`;
}

export function getAerosolRiskLabel(severityIndex: number): string {
  if (severityIndex >= 78) return 'High';
  if (severityIndex >= 58) return 'Elevated';
  return 'Moderate';
}

export interface OrbitalConstellation {
  id: string;
  name: string;
  agency: string;
  orbit: string;
  sensors: string;
  targetCategory: EventCategoryId;
  activeCount: number;
  color: string;
  description: string;
}

export function getOrbitalConstellations(events: EonetEvent[]): OrbitalConstellation[] {
  const counts = summarizeEventsByCategory(events);
  return [
    {
      id: 'modis-viirs',
      name: 'Terra · Aqua · Suomi NPP',
      agency: 'NASA / NOAA EOSDIS',
      orbit: 'Sun-Synchronous LEO (705–824 km)',
      sensors: 'MODIS · VIIRS 375m Thermal IR',
      targetCategory: 'wildfires',
      activeCount: counts.wildfires,
      color: CATEGORY_COLORS.wildfires,
      description: 'Captures active biomass thermal hotspots, fire radiative power, and smoke aerosol optical depth twice daily.',
    },
    {
      id: 'goes-gpm',
      name: 'GOES-East/West · GPM Core',
      agency: 'NOAA / NASA / JAXA',
      orbit: 'Geostationary & 65° Inclined LEO',
      sensors: 'ABI Infrared · IMERG Microwave',
      targetCategory: 'severeStorms',
      activeCount: counts.severeStorms,
      color: CATEGORY_COLORS.severeStorms,
      description: 'Monitors deep convective cloud-top cooling, eyewall symmetry, and real-time oceanic precipitation flux.',
    },
    {
      id: 'aura-terra',
      name: 'Aura · Sentinel-5P · Terra',
      agency: 'NASA / ESA Copernicus',
      orbit: 'Afternoon A-Train Constellation',
      sensors: 'OMI · TROPOMI SO₂ · ASTER SWIR',
      targetCategory: 'volcanoes',
      activeCount: counts.volcanoes,
      color: CATEGORY_COLORS.volcanoes,
      description: 'Measures volcanic sulfur dioxide plumes, ash cloud altitude dispersion, and summit lava-dome radiance.',
    },
    {
      id: 'icesat-gcom',
      name: 'ICESat-2 · GCOM-W1',
      agency: 'NASA / JAXA',
      orbit: 'Near-Polar Cryosphere Orbit',
      sensors: 'ATLAS Laser Altimetry · AMSR2',
      targetCategory: 'seaLakeIce',
      activeCount: counts.seaLakeIce,
      color: CATEGORY_COLORS.seaLakeIce,
      description: 'Tracks sea-ice edge retreat, tabular iceberg calving corridors, and polar surface albedo transitions.',
    },
  ];
}

export function getSatelliteMapUrl(coords: [number, number], isoDate: string): string {
  const [lng, lat] = coords;
  const datePart = isoDate.slice(0, 10) || '2026-11-15';
  const minLng = Math.max(-180, lng - 4).toFixed(2);
  const minLat = Math.max(-90, lat - 3).toFixed(2);
  const maxLng = Math.min(180, lng + 4).toFixed(2);
  const maxLat = Math.min(90, lat + 3).toFixed(2);
  return `https://worldview.earthdata.nasa.gov/?v=${minLng},${minLat},${maxLng},${maxLat}&t=${datePart}-T00%3A00%3A00Z`;
}

export function getFallbackEvents(nowMs: number = Date.now()): EonetEvent[] {
  const day = 24 * 60 * 60 * 1000;
  const iso = (daysAgo: number) => new Date(nowMs - daysAgo * day).toISOString();

  return normalizeEonetEvents([
    {
      id: 'EONET_9041',
      title: 'Cerrado Canopy Wildfire Complex, Brazil',
      categories: [{ id: 'wildfires', title: 'Wildfires' }],
      sources: [{ id: 'InciWeb', url: 'https://firms.modaps.eosdis.nasa.gov/' }],
      geometry: [
        { date: iso(6), type: 'Point', coordinates: [-47.82, -11.45], magnitudeValue: 420, magnitudeUnit: 'acres' },
        { date: iso(4), type: 'Point', coordinates: [-47.79, -11.42], magnitudeValue: 1180, magnitudeUnit: 'acres' },
        { date: iso(2), type: 'Point', coordinates: [-47.75, -11.39], magnitudeValue: 2450, magnitudeUnit: 'acres' },
        { date: iso(0.3), type: 'Point', coordinates: [-47.71, -11.36], magnitudeValue: 3120, magnitudeUnit: 'acres' },
      ],
    },
    {
      id: 'EONET_9042',
      title: 'Tropical Cyclone Halima, Western Pacific',
      categories: [{ id: 'severeStorms', title: 'Severe Storms' }],
      sources: [{ id: 'JTWC', url: 'https://www.metoc.navy.mil/jtwc/jtwc.html' }],
      geometry: [
        { date: iso(5), type: 'Point', coordinates: [134.8, 12.1], magnitudeValue: 45, magnitudeUnit: 'kts' },
        { date: iso(3), type: 'Point', coordinates: [131.4, 14.3], magnitudeValue: 65, magnitudeUnit: 'kts' },
        { date: iso(1.5), type: 'Point', coordinates: [128.2, 16.9], magnitudeValue: 85, magnitudeUnit: 'kts' },
        { date: iso(0.2), type: 'Point', coordinates: [125.6, 19.2], magnitudeValue: 95, magnitudeUnit: 'kts' },
      ],
    },
    {
      id: 'EONET_9043',
      title: 'Mount Etna Effusive Summit Activity, Italy',
      categories: [{ id: 'volcanoes', title: 'Volcanoes' }],
      sources: [{ id: 'SIVolcano', url: 'https://volcano.si.edu/' }],
      geometry: [
        { date: iso(12), type: 'Point', coordinates: [14.99, 37.75], magnitudeValue: null, magnitudeUnit: null },
        { date: iso(6), type: 'Point', coordinates: [14.99, 37.75], magnitudeValue: null, magnitudeUnit: null },
        { date: iso(1), type: 'Point', coordinates: [14.993, 37.751], magnitudeValue: null, magnitudeUnit: null },
      ],
    },
    {
      id: 'EONET_9044',
      title: 'Iceberg A-23A Drift Corridor, Southern Ocean',
      categories: [{ id: 'seaLakeIce', title: 'Sea and Lake Ice' }],
      sources: [{ id: 'USNIC', url: 'https://usicecenter.gov/' }],
      geometry: [
        { date: iso(22), type: 'Point', coordinates: [-44.2, -59.8], magnitudeValue: 3670, magnitudeUnit: 'km2' },
        { date: iso(11), type: 'Point', coordinates: [-41.6, -58.4], magnitudeValue: 3580, magnitudeUnit: 'km2' },
        { date: iso(1.2), type: 'Point', coordinates: [-38.9, -56.9], magnitudeValue: 3510, magnitudeUnit: 'km2' },
      ],
    },
    {
      id: 'EONET_9045',
      title: 'Kilauea Halemaumau Thermal Anomaly, Hawaii',
      categories: [{ id: 'volcanoes', title: 'Volcanoes' }],
      sources: [{ id: 'USGS', url: 'https://www.usgs.gov/observatories/hvo' }],
      geometry: [
        { date: iso(8), type: 'Point', coordinates: [-155.28, 19.41], magnitudeValue: null, magnitudeUnit: null },
        { date: iso(1.5), type: 'Point', coordinates: [-155.28, 19.41], magnitudeValue: null, magnitudeUnit: null },
      ],
    },
    {
      id: 'EONET_9046',
      title: 'Sierra Nevada Ridge Wildfire, California',
      categories: [{ id: 'wildfires', title: 'Wildfires' }],
      sources: [{ id: 'InciWeb', url: 'https://inciweb.wildfire.gov/' }],
      geometry: [
        { date: iso(4), type: 'Point', coordinates: [-120.42, 38.64], magnitudeValue: 920, magnitudeUnit: 'acres' },
        { date: iso(0.8), type: 'Point', coordinates: [-120.38, 38.68], magnitudeValue: 1840, magnitudeUnit: 'acres' },
      ],
    },
    {
      id: 'EONET_9047',
      title: 'Extratropical Low System 14L, North Atlantic',
      categories: [{ id: 'severeStorms', title: 'Severe Storms' }],
      sources: [{ id: 'NHC', url: 'https://www.nhc.noaa.gov/' }],
      geometry: [
        { date: iso(3), type: 'Point', coordinates: [-48.5, 34.2], magnitudeValue: 50, magnitudeUnit: 'kts' },
        { date: iso(0.6), type: 'Point', coordinates: [-41.1, 39.8], magnitudeValue: 60, magnitudeUnit: 'kts' },
      ],
    },
    {
      id: 'EONET_9048',
      title: 'Amundsen Sea Polynya Opening, Antarctica',
      categories: [{ id: 'seaLakeIce', title: 'Sea and Lake Ice' }],
      sources: [{ id: 'NSIDC', url: 'https://nsidc.org/' }],
      geometry: [
        { date: iso(14), type: 'Point', coordinates: [-107.4, -73.2], magnitudeValue: 820, magnitudeUnit: 'km2' },
        { date: iso(2.4), type: 'Point', coordinates: [-106.9, -73.0], magnitudeValue: 1140, magnitudeUnit: 'km2' },
      ],
    },
  ]);
}
