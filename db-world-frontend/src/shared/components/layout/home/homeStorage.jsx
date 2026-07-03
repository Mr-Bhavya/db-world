import { FAVORITES_KEY, RECENT_KEY } from './homeData';

export const safeJsonParse = (raw, fallback) => {
  try {
    return JSON.parse(raw || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

export const getRecent = () => {
  if (typeof window === 'undefined') return [];

  return safeJsonParse(localStorage.getItem(RECENT_KEY), []);
};

export const saveRecent = (appId, route) => {
  if (typeof window === 'undefined') return;

  const previous = getRecent().filter((entry) => entry.appId !== appId);

  const next = [
    {
      appId,
      route,
      ts: Date.now(),
    },
    ...previous,
  ].slice(0, 6);

  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
};

export const getFavorites = () => {
  if (typeof window === 'undefined') return [];

  return safeJsonParse(localStorage.getItem(FAVORITES_KEY), []);
};

export const toggleFavorite = (appId) => {
  if (typeof window === 'undefined') return [];

  const favorites = getFavorites();

  const index = favorites.indexOf(appId);

  if (index > -1) {
    favorites.splice(index, 1);
  } else {
    favorites.push(appId);
  }

  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));

  return favorites;
};

export const timeAgo = (ts) => {
  if (!ts) return 'recently';

  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'just now';

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
};