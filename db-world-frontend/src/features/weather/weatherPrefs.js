export const WEATHER_CITY_KEY = 'dbworld_weather_city';

/** The weather page's own default, shared so the home widget starts on the same place. */
export const DEFAULT_WEATHER_CITY = 'Pune';

/**
 * The last city the user actually looked at.
 *
 * Persisted so the home dashboard's weather tile shows their place rather than the app default —
 * a tile that always says "Pune" to someone in Ahmedabad is worse than no tile. Only the city
 * name is stored; coordinates from a geolocation prompt are deliberately not, since that is
 * precise location data the app has no reason to keep.
 */
export const getWeatherCity = () => {
  if (typeof window === 'undefined') return DEFAULT_WEATHER_CITY;

  const stored = localStorage.getItem(WEATHER_CITY_KEY);
  return stored && stored.trim() ? stored : DEFAULT_WEATHER_CITY;
};

export const saveWeatherCity = (city) => {
  if (typeof window === 'undefined' || !city || !String(city).trim()) return;

  try {
    localStorage.setItem(WEATHER_CITY_KEY, String(city).trim());
  } catch {
    // Quota / private mode — the widget just falls back to the default city.
  }
};
