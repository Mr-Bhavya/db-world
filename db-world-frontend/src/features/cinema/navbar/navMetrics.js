/**
 * The cinema navbar's own dimensions, in one place.
 *
 * These were duplicated as literals across three files and had already drifted: the
 * mobile Toolbar and its spacer are 52px, while both heroes reserved
 * `calc(56px + env(safe-area-inset-top, 0px))` for the same band. So the hero pushed
 * itself down by 4px more than the bar occupies — plus the whole safe-area inset, which
 * the AppBar never consumes — and the difference showed as a gap between the header and
 * the top of the card deck.
 *
 * It read as intermittent because the inset is: the app hides the status bar
 * (`StatusBar.hide()` in App.jsx) and declares no overlay, so most of the time
 * `env(safe-area-inset-top)` resolves to 0 and the gap is only the 4px. On an Android
 * with a display cutout the WebView can still report a real inset, and the gap jumps to
 * 30px or so. Same code, different device — which is why it came and went.
 *
 * The inset term is gone rather than corrected. The AppBar does not offset for it, and
 * neither does the spacer every non-hero page already sits under, so adding it in the
 * hero alone could only ever disagree with the rest of the app.
 */

/** Mobile (`xs`) toolbar height. Must equal the Toolbar's minHeight AND its spacer. */
export const MOBILE_TOOLBAR_H = 52;

/**
 * What a hero must reserve at the top to clear the fixed navbar on mobile.
 *
 * A hero runs its artwork UNDER the bar and reserves the band itself, which is why the
 * navbar drops its spacer when one is present (`bleedUnderTop`). The two numbers are
 * therefore the same number and must stay that way.
 */
export const HERO_TOP_INSET = `${MOBILE_TOOLBAR_H}px`;
