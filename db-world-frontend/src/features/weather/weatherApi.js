import { useQuery } from '@tanstack/react-query';

import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const unwrap = (response) => response.data?.data ?? response.data;

/**
 * ~110 m of precision. Rounding before the coordinates reach the query key means a GPS fix that
 * jitters by a few metres does not look like a new place and refetch, and it matches the rounding
 * the server caches on — so the home widget and the weather page share one cache entry.
 */
export const roundCoord = (value) => Math.round(value * 1000) / 1000;

const locationParams = ({ coords, city }) =>
  coords
    ? { lat: roundCoord(coords.latitude), lon: roundCoord(coords.longitude) }
    : { city };

/**
 * Current conditions, the hourly outlook, the multi-day outlook and air quality — one request.
 *
 * Public endpoint: it answers without a token, which is what lets the weather page and the home
 * tile work for a signed-out visitor. The OpenWeather key still never leaves the server.
 *
 * Coordinates win over a city name when both are known: the city is only the fallback label for
 * where the reader last looked.
 */
export function useWeather({ coords, city, enabled = true }) {
  const params = locationParams({ coords, city });

  return useQuery({
    queryKey: ['weather', 'bundle', params],
    queryFn: () => axiosInstance.get('/api/weather', { params }).then(unwrap),
    enabled: enabled && Boolean(coords || city),
    // Conditions move on the order of tens of minutes and the server caches upstream anyway, so a
    // remount inside five minutes should not spend a request.
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/**
 * Place suggestions for the search box.
 *
 * Only fires from three characters: shorter prefixes match half the planet, so the results are
 * noise and the request is waste. The caller debounces the keystrokes.
 */
export function usePlaceSearch(query) {
  const q = query.trim();

  return useQuery({
    queryKey: ['weather', 'places', q.toLowerCase()],
    queryFn: () => axiosInstance.get('/api/weather/search', { params: { q } }).then(unwrap),
    enabled: q.length >= 3,
    staleTime: 30 * 60_000,
    retry: false,
  });
}
