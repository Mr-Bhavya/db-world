// Picks the poster/backdrop a card should show, honoring the rail's image
// variant (WITH_TEXT / WITHOUT_TEXT) and otherwise the display-type default.
//
// landscape = card currently shows a 16:9 image (wide/continue/billboard, an
// expanded prime, or any card on a landscape tier). Otherwise a portrait poster.
export function resolveCardImage({ record, cfg, imageVariant, landscape }) {
  const forceClean = imageVariant === 'WITHOUT_TEXT';
  const useTextBackdrop = imageVariant === 'WITH_TEXT'
    ? true
    : forceClean
      ? false
      : (cfg.useTextBackdrop ?? false);

  const imgPath = landscape
    ? (useTextBackdrop
        ? (record.backdropPathText ?? record.backdropPath ?? record.posterPath)
        : (record.backdropPath ?? record.backdropPathText ?? record.posterPath))
    : (forceClean
        ? (record.posterPathClean ?? record.posterPath ?? record.backdropPath ?? record.backdropPathText)
        : (record.posterPath ?? record.posterPathClean ?? record.backdropPath ?? record.backdropPathText));

  return { useTextBackdrop, imgPath };
}
