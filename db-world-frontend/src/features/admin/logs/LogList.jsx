import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, Button } from '@mui/material';
import { FixedSizeList } from 'react-window';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import { useT } from '@shared/theme';
import { adminSurface, TableSkeleton } from '@features/admin/adminUi';
import {
  fmtTime, fmtTimeShort, numStatus, numDuration, levelColor, methodColor, statusColor,
  levelOf, shortLogger, isSlow, parseRawLine,
} from './logUtils';

/** One-line row. */
const ROW_H = 40;
/** Stacked row: a meta line plus two clamped lines of message. */
const ROW_H_STACKED = 72;

/**
 * Below this MEASURED list width a row stacks — meta on one line, the message on the next two.
 *
 * <p>Measured on the list, not read off a media query, and that distinction is the whole point.
 * A breakpoint gets this wrong in both directions here: the admin sidebar takes 240px from
 * `md` up, so a 900px window has *less* room for a log line than an 899px one, and collapsing
 * that sidebar to its 60px rail hands back 180px no media query will ever know about.
 */
const STACK_W = 520;

/** What the `1fr` column needs before the wide template's extra columns are worth their width. */
const MIN_FLEX = 260;

/** The row's own `gap: 1`, in px — needed to price a template. */
const GAP = 8;
/** The row's `px: 1.25` (20px) plus its 3px level stripe. */
const ROW_CHROME = 23;

const TEMPLATES = {
  request: { full: '86px 58px 46px 66px minmax(0,1fr) 150px', compact: '66px 52px 42px minmax(0,1fr)' },
  app:     { full: '86px 52px minmax(0,1fr) 160px', compact: '66px 48px minmax(0,1fr)' },
  raw:     { full: 'minmax(0,1fr)', compact: 'minmax(0,1fr)' },
};

/**
 * Px a grid template spends before its `1fr` track gets anything, gaps included.
 *
 * <p>Derived from the template string rather than written down next to it. The two drifting
 * apart is precisely how nobody noticed that switching off compact mode at 600px costs 262px
 * of fixed columns on a screen that just gained one pixel.
 */
function fixedWidth(template) {
  const tracks = template.trim().split(/\s+/);
  // `minmax(0,1fr)` parses to NaN and contributes nothing, which is the point.
  return tracks.reduce((n, t) => n + (parseFloat(t) || 0), 0) + GAP * (tracks.length - 1);
}

const REQ_COLS = [
  { key: 'time', label: 'Time' },
  { key: 'method', label: 'Method' },
  { key: 'status', label: 'Status' },
  { key: 'duration', label: 'Duration', hideCompact: true },
  { key: 'uri', label: 'URI' },
  { key: 'user', label: 'User', hideCompact: true },
];

const cellSx = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' };

/** The message, on two wrapped lines. Only used stacked — one-line rows ellipsize instead. */
const clampSx = {
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
  overflow: 'hidden', wordBreak: 'break-word', minWidth: 0,
};

/** How long the width has to hold still before the layout is allowed to follow it. */
const SETTLE_MS = 150;

/*
 * Own the height measurement (deterministic) instead of relying on AutoSizer, which measured 0
 * inside the admin flex shell and left the list blank.
 *
 * <h2>Two widths, because the consumers want opposite things</h2>
 * `size` is live. react-window sizes its own element from the `width` it is handed, so a stale
 * one stops the list filling the card -- during a resize that is a visible strip of empty card,
 * every time.
 *
 * <p>`layoutWidth` settles. It is the width the ROW TEMPLATE is chosen from, and the admin
 * sidebar tweens its own width over 220ms: let the template follow that frame by frame and the
 * rows restack somewhere in the middle of the animation, then maybe again before it ends. Held
 * still, the geometry tracks the animation and the layout changes once, at rest.
 *
 * <p>The first measurement is exempt from the delay. It runs in a layout effect, before paint,
 * and debouncing it would trade a template snap for a blank list -- which is the flash this was
 * put here to remove.
 */
function useSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [layoutWidth, setLayoutWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let timer = null;

    const read = (immediate) => {
      const width = el.clientWidth;
      setSize({ width, height: el.clientHeight });
      if (immediate) { setLayoutWidth(width); return; }
      // Re-read inside the timer rather than closing over `width`: by the time it fires the
      // element has stopped moving, and its width then is the one worth laying out for.
      clearTimeout(timer);
      timer = setTimeout(() => setLayoutWidth(el.clientWidth), SETTLE_MS);
    };

    read(true);
    // ResizeObserver delivers one callback on observe(); that one is a no-op against the
    // reading just taken, and React bails out of the re-render.
    const ro = new ResizeObserver(() => read(false));
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(timer); };
  }, []);

  return [ref, size, layoutWidth];
}

function Tag({ text, color }) {
  return (
    <Box component="span" sx={{ ...cellSx, display: 'inline-block', px: 0.6, py: '1px', borderRadius: 0.75, fontSize: '0.66rem', fontWeight: 800, color, bgcolor: `${color}1f`, ...mono }}>
      {text}
    </Box>
  );
}

const Row = memo(({ index, style, data }) => {
  const { entries, mode, dark, compact, stacked, template, onSelect, T, S } = data;
  const e = entries[index];
  const isStr = typeof e === 'string';
  const timeFmt = compact ? fmtTimeShort : fmtTime;

  /*
   * A raw source — or a line inside a structured view that the parser could not make sense of,
   * which `applyFilters` explicitly allows through — is ONE cell, not the mode's columns. The
   * grid template has to be overridden to match, or a single child lands in the mode's first
   * track: 86px wide, with the whole line inside it.
   */
  const single = mode === 'raw' || isStr;

  let stripe = T.textFaint;
  let meta = null;   // time, level/method, status, duration — the narrow leading bits
  let body = null;   // what the line actually says: its message or its URI
  let trail = null;  // logger / user — dropped when compact
  let label = '';    // accessible name for the row

  const burst = (b) => (b ? <Box component="span" sx={{ color: T.teal, fontWeight: 800, mr: 0.5 }}>×{b}</Box> : null);

  if (single) {
    const line = isStr ? e : (e?.message ?? '');
    const p = parseRawLine(line);
    if (p && p.method && p.uri) {
      // Request line in RAW form → render like the request view (method/status/uri).
      const st = numStatus(p);
      stripe = statusColor(st, dark);
      label = `${p.method} ${st || ''} ${p.uri}`;
      meta = (
        <>
          <Box component="span" sx={{ ...mono, flexShrink: 0, fontSize: '0.7rem', color: T.textFaint }}>{timeFmt(p.timestamp)}</Box>
          <Box sx={{ flexShrink: 0 }}><Tag text={p.method} color={methodColor(p.method, dark)} /></Box>
          <Box component="span" sx={{ ...mono, flexShrink: 0, fontSize: '0.74rem', fontWeight: 800, color: statusColor(st, dark) }}>{st || '—'}</Box>
        </>
      );
      body = <Box component="span" sx={{ ...(stacked ? clampSx : cellSx), ...mono, flex: 1, fontSize: '0.76rem', color: T.text }}>{p.uri}</Box>;
      if (!compact && p.user) trail = <Box component="span" sx={{ ...cellSx, flexShrink: 0, maxWidth: 190, fontSize: '0.7rem', color: T.textFaint }}>{p.user}</Box>;
    } else if (p) {
      // Structured app line → lead with the message so it isn't truncated off-screen.
      stripe = levelColor(p.level, dark);
      label = `${p.level} ${p.message}`;
      meta = (
        <>
          <Box component="span" sx={{ ...mono, flexShrink: 0, fontSize: '0.7rem', color: T.textFaint }}>{timeFmt(p.timestamp)}</Box>
          <Box sx={{ flexShrink: 0 }}><Tag text={p.level.slice(0, 4)} color={levelColor(p.level, dark)} /></Box>
        </>
      );
      body = <Box component="span" sx={{ ...(stacked ? clampSx : cellSx), ...mono, flex: 1, fontSize: '0.76rem', color: T.text }}>{p.message}</Box>;
      if (!compact) trail = <Box component="span" sx={{ ...cellSx, ...mono, flexShrink: 0, maxWidth: 190, fontSize: '0.68rem', color: T.textFaint }}>{shortLogger(p.logger)}</Box>;
    } else {
      // Non-Java line (nginx/aria2) — content is at the start, reads fine as-is.
      stripe = levelColor(levelOf(e), dark);
      label = String(line);
      body = <Box component="span" sx={{ ...(stacked ? clampSx : cellSx), ...mono, flex: 1, fontSize: '0.76rem', color: T.textMuted }}>{line}</Box>;
    }
  } else if (mode === 'request') {
    const st = numStatus(e);
    const dur = numDuration(e);
    stripe = statusColor(st, dark);
    label = `${e.method || ''} ${st || ''} ${e.uri || ''}`;
    meta = (
      <>
        <Box component="span" sx={{ ...cellSx, ...mono, fontSize: '0.7rem', color: T.textFaint }}>{timeFmt(e.timestamp)}</Box>
        <Box sx={cellSx}>{e.method ? <Tag text={e.method} color={methodColor(e.method, dark)} /> : null}</Box>
        <Box component="span" sx={{ ...cellSx, ...mono, fontSize: '0.74rem', fontWeight: 800, color: statusColor(st, dark) }}>{st || '—'}</Box>
        {!compact && (
          <Box component="span" sx={{ ...cellSx, ...mono, fontSize: '0.72rem', fontWeight: isSlow(e) ? 800 : 400, color: isSlow(e) ? T.warning : T.textMuted }}>
            {dur ? `${dur}ms` : ''}
          </Box>
        )}
      </>
    );
    body = (
      <Box component="span" sx={{ ...(stacked ? clampSx : cellSx), ...mono, fontSize: '0.76rem', color: T.text }}>
        {burst(e._burst)}{e.uri}
      </Box>
    );
    if (!compact) trail = <Box component="span" sx={{ ...cellSx, fontSize: '0.72rem', color: T.textFaint }}>{e.user && e.user !== '-' ? e.user : ''}</Box>;
  } else {
    stripe = levelColor(levelOf(e), dark);
    label = `${levelOf(e) || 'INFO'} ${e.message || ''}`;
    meta = (
      <>
        <Box component="span" sx={{ ...cellSx, ...mono, fontSize: '0.7rem', color: T.textFaint }}>{timeFmt(e.timestamp)}</Box>
        <Box sx={cellSx}><Tag text={(levelOf(e) || 'INFO').slice(0, 4)} color={levelColor(levelOf(e), dark)} /></Box>
      </>
    );
    body = (
      <Box component="span" sx={{ ...(stacked ? clampSx : cellSx), fontSize: '0.78rem', lineHeight: stacked ? 1.4 : undefined, color: T.text }}>
        {burst(e._burst)}{e.message}
      </Box>
    );
    if (!compact) trail = <Box component="span" sx={{ ...cellSx, ...mono, fontSize: '0.7rem', color: T.textFaint }}>{shortLogger(e.logger)}</Box>;
  }

  const open = () => onSelect?.(e, index);

  return (
    <Box
      style={style}
      role="button"
      tabIndex={0}
      aria-label={label ? `Open log entry: ${label}` : 'Open log entry'}
      onClick={open}
      // The list was mouse-only: a div with an onClick and nothing else. Virtualization means
      // only the rendered window is reachable, which is a real limit, but it beats no keyboard
      // route into an entry at all.
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); }
      }}
      sx={{
        display: stacked ? 'flex' : 'grid',
        ...(stacked
          ? { flexDirection: 'column', justifyContent: 'center', gap: 0.25, py: 0.75 }
          : { gridTemplateColumns: single ? 'minmax(0,1fr)' : template, alignItems: 'center', gap: 1 }),
        px: 1.25, borderLeft: `3px solid ${stripe}`, borderBottom: `1px solid ${S.divider}`,
        cursor: 'pointer', boxSizing: 'border-box',
        '&:hover': { bgcolor: S.cardHover },
        '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: '-2px' },
      }}
    >
      {stacked ? (
        <>
          {meta && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>{meta}</Box>}
          {body}
        </>
      ) : single ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          {meta}{body}{trail}
        </Box>
      ) : (
        <>{meta}{body}{trail}</>
      )}
    </Box>
  );
});
Row.displayName = 'LogRow';

/** The virtualized log stream + (request mode) sortable column header + live jump-to-latest. */
export default function LogList({ entries, mode, sortKey, sortDir, onSort, onSelect, live, loading, canLoadMore, onReachOlderEdge, viewKey }) {
  const T = useT();
  const S = adminSurface(T);
  const dark = T.bg === '#000000';
  const listRef = useRef(null);
  const outerRef = useRef(null);
  const atTop = useRef(true);
  const atBottom = useRef(true);
  const scrollOffsetRef = useRef(0);
  const anchorRef = useRef(null);           // { edge:'top'|'bottom', offset } while a load-older is in flight
  const prevCountRef = useRef(entries.length);
  const inited = useRef(false);
  const [showJump, setShowJump] = useState(false);
  const [sizeRef, size, layoutWidth] = useSize();

  /*
   * Layout from the measured width, not from a viewport breakpoint.
   *
   * `stacked` gives the message its own lines; `compact` drops the Duration and User columns
   * and shortens the clock. Stacking always implies compact — STACK_W is far below the width
   * at which the wide template's fixed columns fit — but saying so explicitly keeps `raw`
   * mode, whose template has no fixed columns to price, in line with the others.
   */
  // The settled width, not the live one -- see useSize. Row geometry below still reads
  // `size` so the list keeps filling the card while the sidebar animates.
  const w = layoutWidth;
  const stacked = w > 0 && w < STACK_W;
  const compact = stacked || (w > 0 && w - ROW_CHROME - fixedWidth(TEMPLATES[mode].full) < MIN_FLEX);
  const template = compact ? TEMPLATES[mode].compact : TEMPLATES[mode].full;
  const rowH = stacked ? ROW_H_STACKED : ROW_H;

  // desc = newest first → newest at the TOP; asc = oldest first → newest at the BOTTOM.
  const newestAtTop = sortDir === 'desc';

  const scrollToNewest = useCallback(() => {
    if (!listRef.current || !entries.length) return;
    if (newestAtTop) listRef.current.scrollTo(0);
    else listRef.current.scrollToItem(entries.length - 1, 'end');
    atTop.current = newestAtTop;
    atBottom.current = !newestAtTop;
    setShowJump(false);
  }, [newestAtTop, entries.length]);

  // Fresh context (source/subtype/date/format) → jump to the newest edge once data lands.
  useEffect(() => { inited.current = false; }, [viewKey]);
  useEffect(() => {
    if (!size.height || !entries.length || inited.current) return;
    inited.current = true;
    scrollToNewest();
  }, [size.height, entries.length, scrollToNewest]);
  // Direction flip → jump to wherever the newest logs now are.
  useEffect(() => { if (inited.current) scrollToNewest(); }, [newestAtTop]); // eslint-disable-line react-hooks/exhaustive-deps

  // New rows arrived. A load-older keeps its place (anchored) and doesn't follow;
  // newer logs (live tail / refresh) follow the newest edge when we're parked there,
  // otherwise the view is preserved so it doesn't jump under the reader.
  useEffect(() => {
    const prev = prevCountRef.current;
    const curr = entries.length;
    prevCountRef.current = curr;
    if (curr <= prev) return;
    const added = curr - prev;

    if (anchorRef.current) {
      const a = anchorRef.current;
      anchorRef.current = null;
      if (a.edge === 'top') listRef.current?.scrollTo(a.offset + added * rowH); // older prepended → keep place
      return; // edge 'bottom': older appended below the view, top unchanged
    }

    if (newestAtTop) {
      if (atTop.current) listRef.current?.scrollTo(0);                          // follow (newest at top)
      else listRef.current?.scrollTo(scrollOffsetRef.current + added * rowH);   // preserve (prepended)
    } else if (atBottom.current) {
      listRef.current?.scrollToItem(curr - 1, 'end');                          // follow (newest at bottom)
    }
  }, [entries.length, newestAtTop, rowH]);

  const handleScroll = ({ scrollOffset, scrollUpdateWasRequested }) => {
    scrollOffsetRef.current = scrollOffset;
    if (scrollUpdateWasRequested) return;
    const el = outerRef.current;
    if (!el) return;
    atTop.current = scrollOffset <= 4;
    atBottom.current = el.scrollHeight - scrollOffset - el.clientHeight < 48;
    setShowJump(!(newestAtTop ? atTop.current : atBottom.current));
  };

  // Infinite "load older" when the visible window reaches the OLDER edge. Which edge
  // is older depends on the sort: time-asc = top, otherwise bottom.
  const handleItemsRendered = ({ visibleStartIndex, visibleStopIndex }) => {
    if (live || !canLoadMore || !onReachOlderEdge || anchorRef.current) return;
    const count = entries.length;
    if (count * rowH <= size.height + rowH) return; // everything fits → nothing to scroll toward
    const olderAtTop = sortKey === 'time' && sortDir === 'asc';
    const older = olderAtTop ? visibleStartIndex <= 8 : visibleStopIndex >= count - 8;
    if (!older) return;
    anchorRef.current = { edge: olderAtTop ? 'top' : 'bottom', offset: scrollOffsetRef.current };
    onReachOlderEdge();
  };

  const jump = () => scrollToNewest();

  const itemData = { entries, mode, dark, compact, stacked, template, onSelect, T, S };

  const sortButtons = REQ_COLS.filter((c) => !(compact && c.hideCompact)).map((c) => {
    const active = (sortKey || 'time') === c.key;
    return (
      <Box
        key={c.key} component="button" type="button" onClick={() => onSort(c.key)}
        sx={{
          appearance: 'none', border: 'none', bgcolor: 'transparent', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 0.25, p: 0, minWidth: 0,
          // Stacked means a phone, where a 12px glyph on a text baseline is not a target.
          minHeight: stacked ? 32 : 'auto',
          fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
          color: active ? T.teal : T.textMuted, '&:hover': { color: T.teal },
        }}
      >
        <Box component="span" sx={cellSx}>{c.label}</Box>
        {active && (sortDir === 'asc' ? <ArrowUpwardRoundedIcon sx={{ fontSize: 12 }} /> : <ArrowDownwardRoundedIcon sx={{ fontSize: 12 }} />)}
      </Box>
    );
  });

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Waits on the measurement too. Unguarded, it laid out as the wide six-column grid for
          one render before the width landed -- a visible snap to the stacked sort row. */}
      {mode === 'request' && w > 0 && (
        /*
         * Stacked rows have no columns for a column header to label, so the same sort controls
         * become a plain wrapped row. Dropping the header there instead would have quietly
         * removed sorting by method, status and URI on every phone.
         */
        <Box sx={{
          flexShrink: 0, alignItems: 'center', gap: stacked ? 2 : 1,
          ...(stacked
            ? { display: 'flex', flexWrap: 'wrap' }
            : { display: 'grid', gridTemplateColumns: template }),
          px: 1.25, pl: 1.6, py: 0.85, bgcolor: S.inset, borderBottom: `1px solid ${S.border}`,
        }}>
          {sortButtons}
        </Box>
      )}

      <Box ref={sizeRef} sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {w > 0 && loading && (
          /*
           * The placeholder has to share the row height, not carry its own.
           *
           * It used to be a fixed 34px bar on a 6px gap -- a 40px pitch, which is exactly the
           * one-line row height. Under 72px stacked rows that reads as the OLD layout flashing
           * up and being replaced, because that is literally what it is. `rowH - 6` keeps the
           * pitch equal to `rowH` through TableSkeleton's own gap.
           */
          <Box sx={{ p: 1.25 }}>
            <TableSkeleton rows={Math.max(3, Math.floor(size.height / rowH))} height={rowH - 6} />
          </Box>
        )}

        {w > 0 && !loading && (
          <FixedSizeList
            ref={listRef} outerRef={outerRef} height={size.height || 320} width={size.width}
            itemCount={entries.length} itemSize={rowH} itemData={itemData}
            onScroll={handleScroll} onItemsRendered={handleItemsRendered} overscanCount={12}
            style={{ overflowX: 'hidden' }}
          >
            {Row}
          </FixedSizeList>
        )}

        {showJump && (
          <Button
            onClick={jump} size="small"
            startIcon={newestAtTop ? <ArrowUpwardRoundedIcon /> : <ArrowDownwardRoundedIcon />}
            sx={{
              position: 'absolute', left: '50%', transform: 'translateX(-50%)',
              ...(newestAtTop ? { top: 14 } : { bottom: 14 }),
              minHeight: { xs: 44, sm: 'auto' },
              bgcolor: T.teal, color: '#fff', textTransform: 'none', fontWeight: 800, fontSize: '0.74rem',
              borderRadius: 999, px: 1.75, boxShadow: `0 8px 22px ${T.tealGlow}`, '&:hover': { bgcolor: T.tealHover },
            }}
          >
            Jump to newest
          </Button>
        )}
      </Box>
    </Box>
  );
}
