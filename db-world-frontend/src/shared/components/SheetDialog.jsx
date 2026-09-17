import { forwardRef, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Box, Dialog, Slide, useMediaQuery, useTheme } from '@mui/material';
import useOverlayBack from '@shared/hooks/useOverlayBack';

/** Slides up from the bottom edge, which is where a sheet lives. */
const SlideUp = forwardRef(function SlideUp(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

/** How much of the screen a sheet may take before its content starts scrolling instead. */
const MAX_SHEET = 0.92;

/** Long enough to read as movement, short enough not to be in the way. */
const RESIZE_MS = 220;

/**
 * Every dialog in the app, and a sheet on a phone.
 *
 * <h2>Why not full screen</h2>
 * Covering the whole screen makes a dialog <em>a page</em> as far as the reader is concerned, and
 * that caused two complaints that turn out to be one. They reach for Back rather than the ✕ — and
 * Back took them off the page underneath, losing whatever they had typed. And a dialog with three
 * fields in it left those three fields stranded at the top of an 812px screen with nothing below
 * them.
 *
 * <p>A sheet anchored to the bottom edge, sized to its content, answers both. A short form sits
 * under the thumb; a long one fills the screen; neither reads as somewhere you navigated to. Back
 * is handled too — see {@link useOverlayBack} — but the presentation is what stops the question
 * being asked in the first place.
 *
 * <h2>Why the height is measured rather than left to the content</h2>
 * A sheet that is sized by its content <em>jumps</em> the moment the content changes — switch the
 * split method inside an expense form, or a tab inside a picker, and it snaps to a new height
 * under the reader's thumb. So the content is measured and the height is animated between the two
 * sizes. Growing upward from a fixed bottom edge is the natural direction for a sheet and reads as
 * the thing making room for itself.
 *
 * <p>The measurement lives on an inner wrapper, not on the paper: observing an element whose size
 * you are setting is a feedback loop that never settles.
 *
 * <p>On a pointer device this is an ordinary centred dialog — nothing below is used.
 */
export default function SheetDialog({
  open, onClose, children, disableBack = false, sheetBreakpoint = 'sm',
  /*
   * Opt out of the sheet and stay a centred dialog at every width.
   *
   * <p>The rationale above is about FORMS: fields stranded at the top of an 812px screen, and
   * Back losing what you typed. An overlay that is not a form does not always share it -- a
   * promo card built as a floating card with a detached dismiss pill below it has no fields to
   * strand, and flattening it against the bottom edge puts its own all-round corner radius
   * against the screen while the sheet's top-only radius lands on a transparent wrapper nobody
   * can see.
   *
   * <p>Back is still handled, so opting out costs nothing but the geometry.
   */
  asSheet = true,
  sx, slotProps, PaperProps,
  // Swallowed, not forwarded. Callers wrote it as "is this a phone", which is the question this
  // component now answers for itself -- and letting it through would put a dialog back to
  // covering the whole screen, which is the thing being fixed.
  fullScreen: _phoneSignal,
  ...rest
}) {
  const theme = useTheme();
  // The hook runs either way -- it cannot be conditional -- and `asSheet` gates the result.
  const narrow = useMediaQuery(theme.breakpoints.down(sheetBreakpoint));
  const sheet = asSheet && narrow;

  useOverlayBack(open && !disableBack, onClose);

  const [height, setHeight] = useState(null);
  const [hasTabs, setHasTabs] = useState(false);

  /*
   * A callback ref held in STATE, not a `useRef`.
   *
   * MUI mounts a dialog's children in a later commit than the one where `open` becomes true, so
   * an effect keyed on `open` runs while the ref is still null -- and because its dependencies
   * have not changed, it never runs again. The measurement never happened and the observer was
   * never attached: the height code looked correct and did nothing at all.
   *
   * A state-backed ref re-renders when the node actually appears, which is the event we care
   * about.
   */
  const [contentNode, setContentNode] = useState(null);

  /*
   * How tall the frame should be.
   *
   * <p>Ordinarily it follows the content, animating between sizes as a section is revealed. A
   * dialog with TABS is the exception, and an important one: tabs are siblings of wildly
   * different lengths, so following the content resizes the frame on every switch, and flipping
   * between a short tab and a long one makes it pump. No desktop application with a tabbed dialog
   * does that.
   *
   * <p>So once tabs are present the height only ever grows: the frame settles at the tallest tab
   * the reader has opened and the shorter ones scroll inside it. Which tab is tallest cannot be
   * known in advance -- only the open one is rendered -- so it is learned rather than measured up
   * front, and the frame stops moving after the first visit to each tab.
   */
  const measure = useCallback(() => {
    const node = contentNode;
    if (!node) return;
    const cap = window.innerHeight * MAX_SHEET;
    const wanted = Math.min(node.scrollHeight, cap);
    const tabbed = Boolean(node.querySelector('.MuiTabs-root'));

    setHeight((previous) => (tabbed && previous ? Math.max(previous, wanted) : wanted));
    setHasTabs(tabbed);
  }, [contentNode]);

  useEffect(() => {
    if (!open) { setHeight(null); setHasTabs(false); return undefined; }
    if (!contentNode) return undefined;

    const observer = new ResizeObserver(measure);
    observer.observe(contentNode);
    measure();
    return () => observer.disconnect();
  }, [open, contentNode, measure]);

  /*
   * And again after every render, with no dependency list.
   *
   * The observer above catches changes React knows nothing about -- an image finishing, a font
   * swapping. It does NOT reliably catch a tab switch: that is a re-render, and a ResizeObserver
   * is a frame-timing mechanism that a background or non-compositing tab can simply not deliver.
   * Measuring on render covers exactly the case the observer is worst at, and the two together
   * mean the height is never left describing content that is no longer there.
   *
   * Cheap enough to do unconditionally: one scrollHeight read, and React bails out of the render
   * when the value has not changed.
   */
  useLayoutEffect(() => { if (open) measure(); });

  // Both APIs, because eighteen of the app's dialogs predate `slotProps` and still say
  // `PaperProps`. Merging here means migrating a dialog is renaming the tag and nothing else.
  const { sx: legacyPaperSx, ...legacyPaperRest } = PaperProps ?? {};
  const { sx: paperSx, ...paperRest } = slotProps?.paper ?? {};

  // Whatever the caller painted the paper, so a pinned tab strip sits on the same surface as the
  // dialog rather than letting its own content scroll through it. Falls back to the theme's paper
  // colour for the dialogs that never set one.
  const stickySurface = paperSx?.bgcolor ?? paperSx?.backgroundColor
    ?? legacyPaperSx?.bgcolor ?? legacyPaperSx?.backgroundColor
    ?? theme.palette.background.paper;

  /*
   * The measured height is an INLINE style, not part of `sx`.
   *
   * sx compiles to an emotion class, and a class generated from a value that changes on every
   * measurement is a class that has to be regenerated and swapped on every measurement. That did
   * not reliably happen here: the component re-rendered with the new number -- provably, a plain
   * data attribute alongside it updated -- while the paper kept the class from its first render
   * and stayed the size it was when it opened. An inline style has no cache to be stale.
   *
   * A tabbed dialog gets a `minHeight` floor rather than a fixed height. On a pointer device MUI
   * scrolls `DialogContent`, so pinning the paper's height constrains the content, which shrinks
   * what we measure, which shrinks the paper -- a loop that collapses the dialog. A floor cannot
   * feed back: the content keeps its natural height and simply has room to spare on short tabs.
   */
  const sizing = {};
  if (height) {
    if (hasTabs) {
      sizing.minHeight = `${height}px`;
      sizing.transition = `min-height ${RESIZE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    } else if (sheet) {
      sizing.height = `${height}px`;
      sizing.transition = `height ${RESIZE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      TransitionComponent={sheet ? SlideUp : undefined}
      // Styled through the container class rather than a `container` slot, which has moved
      // between MUI majors; the class has not.
      sx={sheet ? { '& .MuiDialog-container': { alignItems: 'flex-end' }, ...sx } : sx}
      slotProps={{
        ...slotProps,
        paper: {
          ...legacyPaperRest,
          ...paperRest,
          // The caller's own styling first, then the sheet geometry, and only in sheet mode.
          // The other order lets a dialog that sets its own border radius or margin -- plenty do
          // -- quietly undo the thing that makes it a sheet, while looking like it worked.
          sx: {
            overflowX: 'hidden',
            ...legacyPaperSx,
            ...paperSx,
            ...(sheet ? {
              m: 0,
              width: '100%',
              maxWidth: '100%',
              // dvh, not vh: with a phone browser's address bar showing, vh overshoots and the
              // sheet's own footer sits below the fold.
              maxHeight: `${MAX_SHEET * 100}dvh`,
              borderRadius: '20px 20px 0 0',
              borderBottom: 'none',
              overflowY: 'auto',
            } : {}),
            /*
             * Tabs pin under the title.
             *
             * MUI keeps the title and the actions outside the scrolling area and scrolls
             * `DialogContent`, so tabs that are the first thing inside it stick at its top edge
             * with nothing to clear. Without this, scrolling a long tab takes the tabs off screen
             * and switching means scrolling all the way back up -- across fifteen dialogs in this
             * app, none of which pinned them.
             *
             * The background is explicit, not `inherit`: DialogContent is transparent, so an
             * inherited background would let the rows scroll through the tab strip.
             */
            '& .MuiDialogContent-root > .MuiTabs-root': {
              position: 'sticky',
              top: 0,
              zIndex: 3,
              backgroundColor: stickySurface,
            },
          },
        },
      }}
      {...rest}
    >
      {/* The grab handle. Nothing drags yet, but it is the one mark that says "sheet" before
          anybody has read a word of what is in it. */}
      {sheet && (
        <Box sx={{
          flexShrink: 0, display: 'grid', placeItems: 'center', pt: 1, pb: 0.25,
        }}>
          <Box sx={{ width: 36, height: 4, borderRadius: 99, bgcolor: 'rgba(128,128,128,0.45)' }} />
        </Box>
      )}

      {/* `flex: 0 0 auto` so the paper's column layout cannot stretch this to the height we are
          setting on the paper -- which would make the measurement its own answer. */}
      {/* The sizing goes HERE, on an element this component owns outright, and not on the
          paper: MUI writes its own inline style onto the paper (the shadow variable) and an sx
          rule built from a value that changes every measurement did not reliably regenerate its
          class. The paper has no height of its own -- it grows to fit this -- so a floor here is
          a floor on the dialog, with nothing in between to drop it. */}
      <Box ref={setContentNode} style={sizing} sx={{ flex: '0 0 auto' }}>
        {children}
      </Box>
    </Dialog>
  );
}
