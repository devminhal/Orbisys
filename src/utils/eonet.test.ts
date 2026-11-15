import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShortCanvasLabel,
  buildTrendSynthesis,
  computeDossierAnalytics,
  extractCoordinates,
  filterEonetEvents,
  formatCompactCoords,
  formatCoordinates,
  formatRelativeTime,
  getAerosolRiskLabel,
  getCategoryColor,
  getFallbackEvents,
  getOrbitalConstellations,
  getPersistenceIndex,
  getSatelliteMapUrl,
  normalizeEonetEvents,
  summarizeEventsByCategory,
} from './eonet';

test('extractCoordinates supports Point and Polygon centroid extraction', () => {
  assert.deepEqual(extractCoordinates('Point', [-120.5, 38.2]), [-120.5, 38.2]);
  assert.deepEqual(
    extractCoordinates('Polygon', [
      [
        [10, 20],
        [14, 20],
        [14, 24],
        [10, 24],
      ],
    ]),
    [12, 22],
  );
  assert.equal(extractCoordinates('Point', []), null);
});

test('normalizeEonetEvents extracts latest geometry, observationCount, magnitude, and sourceUrl', () => {
  const events = normalizeEonetEvents([
    {
      id: 'EONET_1',
      title: 'Test Wildfire',
      categories: [{ id: 'wildfires', title: 'Wildfires' }],
      sources: [{ id: 'InciWeb', url: 'https://inciweb.wildfire.gov/incident/1' }],
      geometry: [
        { date: '2026-11-01T00:00:00Z', type: 'Point', coordinates: [-110, 40], magnitudeValue: 100, magnitudeUnit: 'acres' },
        { date: '2026-11-05T00:00:00Z', type: 'Point', coordinates: [-110.2, 40.3], magnitudeValue: 540, magnitudeUnit: 'acres' },
      ],
    },
    {
      id: 'EONET_2',
      title: 'Missing Geometry Event',
      categories: [{ id: 'volcanoes', title: 'Volcanoes' }],
      geometry: [],
    },
  ]);

  assert.equal(events.length, 1);
  assert.equal(events[0].id, 'EONET_1');
  assert.deepEqual(events[0].coordinates, [-110.2, 40.3]);
  assert.equal(events[0].observationCount, 2);
  assert.equal(events[0].magnitude, '540 acres');
  assert.equal(events[0].sourceUrl, 'https://inciweb.wildfire.gov/incident/1');
});

test('category colors match exact specification', () => {
  assert.equal(getCategoryColor('wildfires'), '#F97316');
  assert.equal(getCategoryColor('severeStorms'), '#3B82F6');
  assert.equal(getCategoryColor('volcanoes'), '#EF4444');
  assert.equal(getCategoryColor('seaLakeIce'), '#06B6D4');
  assert.equal(getCategoryColor('drought'), '#10B981');
});

test('summarizeEventsByCategory and filterEonetEvents compute accurate counts and search matches', () => {
  const sample = getFallbackEvents(Date.parse('2026-11-15T12:00:00Z'));
  const summary = summarizeEventsByCategory(sample);

  assert.equal(summary.total, 8);
  assert.equal(summary.wildfires, 2);
  assert.equal(summary.severeStorms, 2);
  assert.equal(summary.volcanoes, 2);
  assert.equal(summary.seaLakeIce, 2);

  const wildfiresOnly = filterEonetEvents(sample, '', 'wildfires');
  assert.equal(wildfiresOnly.length, 2);

  const searchBrazil = filterEonetEvents(sample, 'brazil', 'all');
  assert.equal(searchBrazil.length, 1);
  assert.equal(searchBrazil[0].id, 'EONET_9041');
});

test('buildTrendSynthesis and computeDossierAnalytics produce bounded scientific outputs', () => {
  const now = Date.parse('2026-11-15T12:00:00Z');
  const sample = getFallbackEvents(now);
  const storm = sample.find((e) => e.categoryId === 'severeStorms');
  assert.ok(storm);

  const synthesis = buildTrendSynthesis(storm, 30);
  assert.ok(synthesis.sensorSuite.includes('GOES'));
  assert.ok(synthesis.mechanism.includes('30D'));

  const analytics = computeDossierAnalytics(storm, sample, 30, now);
  assert.equal(analytics.categorySharePct, 25);
  assert.equal(analytics.categoryTrendSeries.length, 10);
  assert.ok(analytics.persistenceScore >= 18 && analytics.persistenceScore <= 99);
  assert.ok(analytics.severityIndex >= 25 && analytics.severityIndex <= 98);
});

test('formatCoordinates, buildShortCanvasLabel, and getSatelliteMapUrl format cleanly', () => {
  assert.deepEqual(formatCoordinates([-120.42, 38.64]), {
    lat: '38.640° N',
    lng: '120.420° W',
  });

  const longTitleEvent = getFallbackEvents()[0];
  assert.ok(buildShortCanvasLabel(longTitleEvent).length <= 24);
  const url = getSatelliteMapUrl([-47.71, -11.36], '2026-11-15T10:00:00Z');
  assert.ok(url.startsWith('https://worldview.earthdata.nasa.gov/'));
});

test('compact callout coords, relative timestamps, persistence/risk labels, and constellations work accurately', () => {
  assert.equal(formatCompactCoords([-121.45, 39.82]), '39.82° N, 121.45° W');
  const now = Date.parse('2026-11-15T12:00:00Z');
  assert.equal(formatRelativeTime('2026-11-15T09:00:00Z', now), '3h ago');
  assert.equal(formatRelativeTime('2026-11-12T12:00:00Z', now), '3d ago');
  assert.equal(getPersistenceIndex(84), '8.4/10');
  assert.equal(getAerosolRiskLabel(82), 'High');
  assert.equal(getAerosolRiskLabel(64), 'Elevated');
  assert.equal(getAerosolRiskLabel(40), 'Moderate');

  const constellations = getOrbitalConstellations(getFallbackEvents(now));
  assert.equal(constellations.length, 4);
  assert.equal(constellations[0].activeCount, 2);
});

