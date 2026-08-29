import {
  AcUnitRounded, BlurOnRounded, BoltRounded, CloudRounded, DarkModeRounded,
  FilterDramaRounded, GrainRounded, NightlightRounded, ThunderstormRounded,
  WaterRounded, WbCloudyRounded, WbSunnyRounded,
} from '@mui/icons-material';

/**
 * The look of a forecast.
 *
 * A weather app that renders every condition in the same house teal tells the reader nothing at a
 * glance. Everything here derives from OpenWeather's icon code, so one lookup drives the artwork,
 * the accent colour and the sky wash behind the page, and they can never disagree with each other.
 */

/** OpenWeather icon codes are `NNd` / `NNn` — the two digits are the condition, the suffix is day or night. */
const parse = (code = '') => ({ group: String(code).slice(0, 2), night: String(code).endsWith('n') });

const CONDITIONS = {
  '01': {
    day:   { Icon: WbSunnyRounded,     color: '#fbbf24', sky: ['#38bdf8', '#0ea5e9'] },
    night: { Icon: DarkModeRounded,    color: '#c7d2fe', sky: ['#4338ca', '#1e1b4b'] },
  },
  '02': {
    day:   { Icon: WbCloudyRounded,    color: '#fcd34d', sky: ['#60a5fa', '#2563eb'] },
    night: { Icon: NightlightRounded,  color: '#a5b4fc', sky: ['#4f46e5', '#1e1b4b'] },
  },
  '03': {
    day:   { Icon: CloudRounded,       color: '#cbd5e1', sky: ['#94a3b8', '#475569'] },
    night: { Icon: CloudRounded,       color: '#94a3b8', sky: ['#475569', '#1e293b'] },
  },
  '04': {
    day:   { Icon: FilterDramaRounded, color: '#94a3b8', sky: ['#64748b', '#334155'] },
    night: { Icon: FilterDramaRounded, color: '#94a3b8', sky: ['#334155', '#0f172a'] },
  },
  '09': {
    day:   { Icon: GrainRounded,       color: '#38bdf8', sky: ['#0891b2', '#164e63'] },
    night: { Icon: GrainRounded,       color: '#38bdf8', sky: ['#155e75', '#0c2a3a'] },
  },
  '10': {
    day:   { Icon: WaterRounded,       color: '#0ea5e9', sky: ['#0e7490', '#134e4a'] },
    night: { Icon: WaterRounded,       color: '#38bdf8', sky: ['#134e4a', '#0b2727'] },
  },
  '11': {
    day:   { Icon: ThunderstormRounded, color: '#fbbf24', sky: ['#4c1d95', '#1e1b4b'] },
    night: { Icon: BoltRounded,        color: '#fbbf24', sky: ['#312e81', '#1e1b4b'] },
  },
  '13': {
    day:   { Icon: AcUnitRounded,      color: '#bae6fd', sky: ['#7dd3fc', '#0369a1'] },
    night: { Icon: AcUnitRounded,      color: '#e0f2fe', sky: ['#0369a1', '#082f49'] },
  },
  '50': {
    day:   { Icon: BlurOnRounded,      color: '#cbd5e1', sky: ['#94a3b8', '#64748b'] },
    night: { Icon: BlurOnRounded,      color: '#94a3b8', sky: ['#475569', '#1e293b'] },
  },
};

const FALLBACK = { Icon: WbCloudyRounded, color: '#2dd4bf', sky: ['#0d9488', '#134e4a'] };

/** Icon, accent colour and sky palette for an OpenWeather icon code. */
export const conditionVisual = (code) => {
  const { group, night } = parse(code);
  const entry = CONDITIONS[group];
  if (!entry) return { ...FALLBACK, night };
  return { ...(night ? entry.night : entry.day), night };
};

/**
 * The wash behind the page header.
 *
 * Kept to a translucent band at the top rather than a full-bleed background: the app's identity is
 * AMOLED black or pure white, and repainting the whole page per condition would make the weather
 * route look like it belongs to a different product.
 */
export const skyWash = (code, dark) => {
  const [from, to] = conditionVisual(code).sky;
  const strength = dark ? [0.42, 0.14] : [0.30, 0.10];
  return `linear-gradient(180deg, ${hexA(from, strength[0])} 0%, ${hexA(to, strength[1])} 45%, transparent 100%)`;
};

/** #rrggbb + alpha → rgba(). Keeps the palette above readable as plain hex. */
function hexA(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// -- Temperature colour -------------------------------------------------------

/**
 * Cold → hot, keyed to **absolute** degrees rather than to the range on screen.
 *
 * Anchoring the ramp to the visible min/max would repaint the same 18° blue in a hot week and
 * amber in a cold one, which makes the colour decorative. Fixed anchors mean blue always means
 * cold, wherever and whenever you are reading — the *position* of a bar is what carries the
 * relative comparison.
 *
 * Stops stay inside the app's palette (sky → teal → amber → red) so the outlook does not read as
 * a different product from the rest of the page.
 */
const TEMPERATURE_RAMP = [
  [-15, [165, 180, 252]], // indigo — deep freeze
  [0, [125, 211, 252]],   // pale sky — freezing
  [12, [56, 189, 248]],   // sky — cool
  [20, [45, 212, 191]],   // teal — mild
  [28, [251, 191, 36]],   // amber — warm
  [38, [248, 113, 113]],  // red — hot
];

/** The ramp colour for a temperature in Celsius, linearly interpolated between the stops. */
export const temperatureColor = (celsius) => {
  const [firstT, firstC] = TEMPERATURE_RAMP[0];
  if (celsius <= firstT) return rgb(firstC);

  for (let i = 1; i < TEMPERATURE_RAMP.length; i += 1) {
    const [upperT, upperC] = TEMPERATURE_RAMP[i];
    if (celsius > upperT) continue;

    const [lowerT, lowerC] = TEMPERATURE_RAMP[i - 1];
    const ratio = (celsius - lowerT) / (upperT - lowerT);
    return rgb(lowerC.map((channel, c) => Math.round(channel + (upperC[c] - channel) * ratio)));
  }

  return rgb(TEMPERATURE_RAMP[TEMPERATURE_RAMP.length - 1][1]);
};

const rgb = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;

// -- Air quality --------------------------------------------------------------

/** OpenWeather's 1-5 index. Colours run green → red, the convention every AQI scale shares. */
const AQI = [
  { label: 'Unknown',   color: '#94a3b8', advice: 'No air-quality reading for this place.' },
  { label: 'Good',      color: '#10b981', advice: 'Air quality is ideal. Enjoy your usual activities.' },
  { label: 'Fair',      color: '#84cc16', advice: 'Acceptable. Unusually sensitive people may notice it.' },
  { label: 'Moderate',  color: '#f59e0b', advice: 'Sensitive groups should ease off long spells outdoors.' },
  { label: 'Poor',      color: '#f97316', advice: 'Cut back on strenuous activity outdoors.' },
  { label: 'Very Poor', color: '#ef4444', advice: 'Avoid outdoor exertion; keep windows shut.' },
];

export const aqiVisual = (aqi) => AQI[aqi >= 1 && aqi <= 5 ? aqi : 0];

/** Pollutant labels, in the order the panel lists them. */
export const POLLUTANT_LABELS = {
  pm2_5: 'PM2.5',
  pm10: 'PM10',
  o3: 'Ozone',
  no2: 'NO₂',
  so2: 'SO₂',
  co: 'CO',
  nh3: 'NH₃',
  no: 'NO',
};

// -- Wind ---------------------------------------------------------------------

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

/** Meteorological bearing → the 16-point compass name for the direction the wind blows *from*. */
export const compassPoint = (degrees) => COMPASS[Math.round(((degrees % 360) / 22.5)) % 16];

/** Beaufort-ish plain-English strength, so the number has a meaning next to it. */
export const windDescription = (metresPerSecond) => {
  if (metresPerSecond < 1.6) return 'Calm';
  if (metresPerSecond < 3.4) return 'Light breeze';
  if (metresPerSecond < 5.5) return 'Gentle breeze';
  if (metresPerSecond < 8) return 'Moderate breeze';
  if (metresPerSecond < 10.8) return 'Fresh breeze';
  if (metresPerSecond < 13.9) return 'Strong breeze';
  if (metresPerSecond < 17.2) return 'Near gale';
  return 'Gale';
};

// -- Time at the observed place ----------------------------------------------

/**
 * Shifts an instant so that reading its UTC fields gives the wall-clock time at the *observed*
 * place. Looking up Reykjavík from Pune should show Reykjavík's sunset, not what o'clock it was
 * here when the sun set there.
 */
const shifted = (epochSeconds, offsetSeconds) => new Date((epochSeconds + offsetSeconds) * 1000);

const pad = (n) => String(n).padStart(2, '0');

/** 24-hour `HH:MM` at the place. */
export const placeTime = (epochSeconds, offsetSeconds) => {
  const d = shifted(epochSeconds, offsetSeconds);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

/** `09h` style label for the hourly strip — compact enough for a 3-hour step to fit on a phone. */
export const placeHour = (epochSeconds, offsetSeconds) =>
  `${pad(shifted(epochSeconds, offsetSeconds).getUTCHours())}h`;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Weekday for an ISO date string, with the nearest two days named rather than numbered. */
export const dayLabel = (isoDate, todayIso, tomorrowIso) => {
  if (isoDate === todayIso) return 'Today';
  if (isoDate === tomorrowIso) return 'Tomorrow';
  // Parsed as UTC on purpose: a bare date has no zone, and letting the runtime read it as local
  // shifts it a day backwards for anyone west of Greenwich.
  return WEEKDAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()];
};

/** `29 Aug` for the secondary line of a forecast row. */
export const dateLabel = (isoDate) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/** Today and tomorrow at the observed place, as ISO dates, for {@link dayLabel}. */
export const placeDayKeys = (offsetSeconds) => {
  const nowAtPlace = shifted(Math.floor(Date.now() / 1000), offsetSeconds);
  const today = nowAtPlace.toISOString().slice(0, 10);
  const tomorrow = new Date(nowAtPlace.getTime() + 86400000).toISOString().slice(0, 10);
  return { today, tomorrow };
};
