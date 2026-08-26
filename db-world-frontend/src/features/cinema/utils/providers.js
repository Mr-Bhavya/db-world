/**
 * "Where to watch" — TMDB/JustWatch provider selection.
 *
 * A record carries providers for every country TMDB knows about, which is far more than
 * anyone wants to see: the list has to be narrowed to one region before it means
 * anything. The hero strip and the Overview panel now pick that region the same way,
 * because two surfaces disagreeing about which country you're in is worse than either
 * of them being wrong.
 *
 * Provider shape: `{ regionCode, providerType, provider: { name, logoPath, displayPriority } }`
 * where providerType is FLATRATE | NETWORK | RENT | BUY.
 */

/** Streaming beats renting: what you can watch now comes before what you can pay for. */
const TYPE_ORDER = ['FLATRATE', 'NETWORK', 'RENT', 'BUY'];

/**
 * Best-effort region from the browser. `navigator.language` gives "en-IN" / "en-US";
 * take the country half. Falls back to IN, this library's audience.
 */
export function detectUserRegion() {
  try {
    const lang = navigator.language || (navigator.languages && navigator.languages[0]) || '';
    const region = lang.split('-')[1]?.toUpperCase();
    if (region && region.length === 2) return region;
  } catch { /* non-browser or locked-down environment */ }
  return 'IN';
}

/**
 * Which region to show for this record: the viewer's own if the title is offered there,
 * then India, then the US, then whatever the title has. Null when it has none at all.
 */
export function pickProviderRegion(providers, userRegion = detectUserRegion()) {
  const available = new Set((providers ?? []).map((p) => p?.regionCode).filter(Boolean));
  if (available.has(userRegion)) return userRegion;
  if (available.has('IN')) return 'IN';
  if (available.has('US')) return 'US';
  return available.values().next().value ?? null;
}

/** The record's providers for one region, untouched otherwise. */
export function providersForRegion(providers, region) {
  return region ? (providers ?? []).filter((p) => p?.regionCode === region) : [];
}

/**
 * A short, ordered list for a compact strip — streaming first, then rent/buy, each
 * group in TMDB's own display priority, de-duplicated by provider name (the same
 * service routinely appears under both RENT and BUY).
 *
 * @returns `{ region, items, kind }` — `kind` is the type of the first item, which is
 *          what the strip's label should describe ("Streaming on" vs "Available on").
 */
export function providerStrip(providers, limit = 4, userRegion = detectUserRegion()) {
  const region = pickProviderRegion(providers, userRegion);
  const regional = providersForRegion(providers, region);

  const ordered = [...regional].sort((a, b) => {
    const byType = typeRank(a?.providerType) - typeRank(b?.providerType);
    if (byType !== 0) return byType;
    return (a?.provider?.displayPriority ?? 99) - (b?.provider?.displayPriority ?? 99);
  });

  const seen = new Set();
  const items = [];
  for (const p of ordered) {
    const name = p?.provider?.name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    items.push(p);
  }

  return {
    region,
    // `total` counts the de-duplicated set, so a "+2" never promises a Netflix that is
    // really the same Prime Video listed twice.
    total: items.length,
    items: items.slice(0, limit),
    kind: items[0]?.providerType ?? null,
  };
}

function typeRank(type) {
  const i = TYPE_ORDER.indexOf(type);
  return i === -1 ? TYPE_ORDER.length : i;
}
