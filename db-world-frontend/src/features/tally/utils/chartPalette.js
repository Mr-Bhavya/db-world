import { useMemo } from 'react';
import { useThemeMode } from '@shared/theme';

/**
 * The categorical colours the report's charts draw with.
 *
 * <h2>Why these, and why in this order</h2>
 * Chart colour is the one part of a chart that can be checked rather than judged, so it was:
 * both rows below were run through the data-viz validator against this app's own chart surfaces
 * — near-black under the dark theme, white under the light one — and both pass the lightness
 * band, the chroma floor, colour-blind separation between neighbouring slots and the
 * normal-vision floor. The <em>order</em> is the colour-blind safety mechanism, not decoration:
 * neighbouring slots are the pairs a reader compares, so reshuffling this list means re-running
 * that check.
 *
 * <p>Slot 1 is the app's own teal in both modes, so the first and largest slice of any chart is
 * the colour the rest of db-tally already uses. The remaining hues are stepped per mode — dark
 * is not the light row dimmed, it is its own set chosen against a black surface.
 *
 * <p>Under the light theme, yellow and magenta land under 3:1 against white. That is allowed
 * only where the chart carries visible labels rather than leaving identity to colour alone,
 * which is why the donut is never shown without the ranked list beside it.
 *
 * <p>Past seven, colours are <b>not</b> generated — the tail folds into one grey "other" slice.
 * An eighth invented hue is one a reader cannot tell from the seven above it.
 */
const SERIES = {
  light: ['#0d9488', '#eb6834', '#2a78d6', '#eda100', '#e87ba4', '#4a3aa7', '#e34948'],
  dark: ['#0d9488', '#d95926', '#3987e5', '#c98500', '#d55181', '#9085e9', '#e66767'],
};

/** Everything past the last slot, and never one of the hues above. */
const OTHER = { light: '#6b7280', dark: '#9ca3af' };

/** How many categories get a colour of their own before the rest become "other". */
export const SERIES_SLOTS = SERIES.light.length;

export function useChartPalette() {
  const { mode } = useThemeMode();

  return useMemo(() => {
    const series = SERIES[mode === 'dark' ? 'dark' : 'light'];
    const other = OTHER[mode === 'dark' ? 'dark' : 'light'];
    return {
      series,
      other,
      /** Colour for rank `index`, with everything past the last slot sharing the grey. */
      at: (index) => series[index] ?? other,
    };
  }, [mode]);
}
