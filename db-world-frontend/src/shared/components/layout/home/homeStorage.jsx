import { RECENT_KEY } from './homeData';

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