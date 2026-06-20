import { useEffect, useRef } from 'react';
import { extractDominantColor, darken, updateThemeColor } from './heroUtils';

// Module-level cache so the same image isn't re-processed repeatedly
const colorCache = new Map();

/**
 * Extract dominant color from an image and apply it to:
 *  - CSS variable `--hero-color`
 *  - <meta name="theme-color">
 *  - optional onChange callback (e.g. setHeroColor in parent)
 *
 * @param {string|null|undefined} imageUrl - image source
 * @param {object} options
 *  - darkenFactor: number (default 0.45)
 *  - onChange: (rgbString) => void
 *  - debounceMs: number (default 220)
 *  - skipUpdateDom: boolean - if true, only fires callback
 */
export function useHeroColor(imageUrl, options = {}) {
    const {
        darkenFactor = 0.45,
        onChange,
        debounceMs = 220,
        skipUpdateDom = false,
    } = options;

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const lastUrlRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        if (!imageUrl) return;
        if (lastUrlRef.current === imageUrl) return;
        lastUrlRef.current = imageUrl;

        // Cache hit — apply immediately
        if (colorCache.has(imageUrl)) {
            const cached = colorCache.get(imageUrl);

            if (!skipUpdateDom) updateThemeColor(cached);
            onChangeRef.current?.(cached);
            return;
        }

        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(async () => {
            const dominant = await extractDominantColor(imageUrl);
            if (!dominant) return;

            const darkened = darken(dominant, darkenFactor);

            colorCache.set(imageUrl, darkened);

            if (!skipUpdateDom) updateThemeColor(darkened);
            onChangeRef.current?.(darkened);
        }, debounceMs);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [imageUrl, darkenFactor, debounceMs, skipUpdateDom]);
}

/**
 * Imperative version — useful inside event handlers or non-React contexts.
 */
export async function applyHeroColorFromImage(imageUrl, options = {}) {
    const {
        darkenFactor = 0.45,
        onChange,
        skipUpdateDom = false,
    } = options;

    if (!imageUrl) return null;

    if (colorCache.has(imageUrl)) {
        const cached = colorCache.get(imageUrl);
        if (!skipUpdateDom) updateThemeColor(cached);
        onChange?.(cached);
        return cached;
    }

    const dominant = await extractDominantColor(imageUrl);
    if (!dominant) return null;

    const darkened = darken(dominant, darkenFactor);
    colorCache.set(imageUrl, darkened);

    if (!skipUpdateDom) updateThemeColor(darkened);
    onChange?.(darkened);
    return darkened;
}