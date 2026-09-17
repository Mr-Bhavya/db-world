import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { addBackInterceptor } from '@platform/android/backInterceptors';

/**
 * Makes Back close an overlay instead of leaving the page underneath it.
 *
 * <h2>Why an overlay has to own a history entry</h2>
 * A dialog is, to the reader, a place they went — especially on a phone, where it covers most of
 * the screen. Back is how you leave a place. But a dialog is not a route, so pressing Back leaves
 * the <em>page</em>, losing both the dialog and everything they had typed into it, and landing
 * them somewhere they did not ask to be. The only way to make Back mean "close this" is to give
 * the overlay something for Back to pop.
 *
 * <p>Two mechanisms, because there are two kinds of Back:
 * <ul>
 *   <li><b>In the installed app</b> the hardware key comes through Capacitor and never touches
 *       history, so it is claimed through the existing interceptor stack — which already runs
 *       innermost-first, so a sheet opened over a sheet closes one at a time.</li>
 *   <li><b>In a browser</b> — including the phone's gesture — Back is a {@code popstate} the
 *       router acts on, so the overlay pushes an entry of its own on open and watches for it
 *       disappearing.</li>
 * </ul>
 *
 * <h2>A stack, not a marker</h2>
 * This used to record one id. That works until a dialog opens another one — a category picker
 * from inside an expense form, an icon picker from inside an edit dialog — and then the inner
 * one's marker replaces the outer one's, the outer one sees a marker that is not its own,
 * concludes Back was pressed, and closes itself underneath the dialog it just opened. Both then
 * unwind history entries neither of them owns, and the page goes with them.
 *
 * <p>So the entry carries the whole stack and an overlay is open while its id is <em>in</em> it.
 * Opening appends, Back pops the last one, and closing from inside removes exactly its own.
 *
 * <p>The pushed entry keeps the same path and only adds to {@code state}, so the router re-renders
 * the page it was already on. {@code ScrollMemory} deliberately ignores a same-path navigation,
 * which is what stops the page behind the sheet jumping to the top as it opens.
 *
 * @param open    whether the overlay is on screen.
 * @param onClose called when Back is pressed. Should be the same thing the ✕ does.
 */
let nextOverlayId = 0;

export default function useOverlayBack(open, onClose) {
  const navigate = useNavigate();
  const location = useLocation();

  // Read through a ref so the listeners below never capture a stale closure, and so neither
  // effect has to re-run — re-running the history effect would push a second entry.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // The router's location, not `window.location`. They differ by the basename, and `navigate`
  // adds the basename back — so pushing window.location.pathname produces "/app/app/page" and
  // lands on a route that does not exist.
  const locationRef = useRef(location);
  locationRef.current = location;

  const idRef = useRef(null);
  const poppedRef = useRef(false);
  // Whether the pushed entry has actually landed. Without it the watcher below fires in the same
  // commit that requests the push -- the location it reads is still the old one, this overlay's
  // id is not in the stack yet, and every overlay closes itself the instant it opens.
  const armedRef = useRef(false);

  // ── the installed app ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return undefined;
    return addBackInterceptor(() => { closeRef.current?.(); return true; });
  }, [open]);

  // ── the browser ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return undefined;

    nextOverlayId += 1;
    const id = nextOverlayId;
    idRef.current = id;
    poppedRef.current = false;
    armedRef.current = false;

    const { pathname, search, state } = locationRef.current;
    const stack = [...(state?.overlayStack ?? []), id];
    navigate(`${pathname}${search}`, { state: { ...(state ?? {}), overlayStack: stack } });

    return () => {
      // Popped already means Back did the work; popping again would eat the entry underneath,
      // which is either the overlay that opened this one or the page the reader was on.
      if (idRef.current === id && !poppedRef.current) navigate(-1);
      idRef.current = null;
    };
  }, [open, navigate]);

  // ── our id left the stack, so Back was pressed ─────────────────────────────
  useEffect(() => {
    if (!open || idRef.current == null) return;

    const stack = location.state?.overlayStack;
    if (stack?.includes(idRef.current)) { armedRef.current = true; return; }
    // Absent before it was ever present means the push has not arrived, not that Back was
    // pressed.
    if (!armedRef.current) return;

    poppedRef.current = true;
    closeRef.current?.();
  }, [open, location]);
}
