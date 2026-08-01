import React, { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, Button } from '@mui/material';
import { FixedSizeList } from 'react-window';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import {
  fmtTime, fmtTimeShort, numStatus, numDuration, levelColor, methodColor, statusColor,
  levelOf, shortLogger, isSlow, parseRawLine,
} from './logUtils';

const ROW_H = 40;

const TEMPLATES = {
  request: { full: '86px 58px 46px 66px minmax(0,1fr) 150px', compact: '66px 52px 42px minmax(0,1fr)' },
  app:     { full: '86px 52px minmax(0,1fr) 160px', compact: '66px 48px minmax(0,1fr)' },
  raw:     { full: 'minmax(0,1fr)', compact: 'minmax(0,1fr)' },
};

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

// Own the height measurement (deterministic) instead of relying on AutoSizer,
// which measured 0 inside the admin flex shell and left the list blank.
function useSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

function Tag({ text, color }) {
  return (
    <Box component="span" sx={{ ...cellSx, display: 'inline-block', px: 0.6, py: '1px', borderRadius: 0.75, fontSize: '0.66rem', fontWeight: 800, color, bgcolor: `${color}1f`, ...mono }}>
      {text}
    </Box>
  );
}

const Row = memo(({ index, style, data }) => {
  const { entries, mode, dark, compact, template, onSelect, T, S } = data;
  const e = entries[index];
  const isStr = typeof e === 'string';
  const timeFmt = compact ? fmtTimeShort : fmtTime;

  let stripe = T.textFaint;
  let cells = null;

  if (mode === 'raw' || isStr) {
    const line = isStr ? e : (e?.message ?? '');
    const p = parseRawLine(line);
    if (p && p.method && p.uri) {
      // Request line in RAW form → render like the request view (method/status/uri).
      const st = numStatus(p);
      stripe = statusColor(st, dark);
      cells = (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Box component="span" sx={{ ...mono, flexShrink: 0, fontSize: '0.7rem', color: T.textFaint }}>{timeFmt(p.timestamp)}</Box>
          <Box sx={{ flexShrink: 0 }}><Tag text={p.method} color={methodColor(p.method, dark)} /></Box>
          <Box component="span" sx={{ ...mono, flexShrink: 0, fontSize: '0.74rem', fontWeight: 800, color: statusColor(st, dark) }}>{st || '—'}</Box>
          <Box component="span" sx={{ ...cellSx, ...mono, flex: 1, fontSize: '0.76rem', color: T.text }}>{p.uri}</Box>
          {!compact && p.user && <Box component="span" sx={{ ...cellSx, flexShrink: 0, maxWidth: 190, fontSize: '0.7rem', color: T.textFaint }}>{p.user}</Box>}
        </Box>
      );
    } else if (p) {
      // Structured app line → lead with the message so it isn't truncated off-screen.
      stripe = levelColor(p.level, dark);
      cells = (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Box component="span" sx={{ ...mono, flexShrink: 0, fontSize: '0.7rem', color: T.textFaint }}>{timeFmt(p.timestamp)}</Box>
          <Box sx={{ flexShrink: 0 }}><Tag text={p.level.slice(0, 4)} color={levelColor(p.level, dark)} /></Box>
          <Box component="span" sx={{ ...cellSx, ...mono, flex: 1, fontSize: '0.76rem', color: T.text }}>{p.message}</Box>
          {!compact && <Box component="span" sx={{ ...cellSx, ...mono, flexShrink: 0, maxWidth: 190, fontSize: '0.68rem', color: T.textFaint }}>{shortLogger(p.logger)}</Box>}
        </Box>
      );
    } else {
      // Non-Java line (nginx/aria2) — content is at the start, read fine as-is.
      stripe = levelColor(levelOf(e), dark);
      cells = <Box component="span" sx={{ ...cellSx, ...mono, fontSize: '0.76rem', color: T.textMuted }}>{line}</Box>;
    }
  } else if (mode === 'request') {
    const st = numStatus(e);
    const dur = numDuration(e);
    stripe = statusColor(st, dark);
    cells = (
      <>
        <Box component="span" sx={{ ...cellSx, ...mono, fontSize: '0.7rem', color: T.textFaint }}>{timeFmt(e.timestamp)}</Box>
        <Box sx={cellSx}>{e.method ? <Tag text={e.method} color={methodColor(e.method, dark)} /> : null}</Box>
        <Box component="span" sx={{ ...cellSx, ...mono, fontSize: '0.74rem', fontWeight: 800, color: statusColor(st, dark) }}>{st || '—'}</Box>
        {!compact && (
          <Box component="span" sx={{ ...cellSx, ...mono, fontSize: '0.72rem', fontWeight: isSlow(e) ? 800 : 400, color: isSlow(e) ? T.warning : T.textMuted }}>
            {dur ? `${dur}ms` : ''}
          </Box>
        )}
        <Box component="span" sx={{ ...cellSx, ...mono, fontSize: '0.76rem', color: T.text }}>
          {e._burst ? <Box component="span" sx={{ color: T.teal, fontWeight: 800, mr: 0.5 }}>×{e._burst}</Box> : null}{e.uri}
        </Box>
        {!compact && <Box component="span" sx={{ ...cellSx, fontSize: '0.72rem', color: T.textFaint }}>{e.user && e.user !== '-' ? e.user : ''}</Box>}
      </>
    );
  } else {
    stripe = levelColor(levelOf(e), dark);
    cells = (
      <>
        <Box component="span" sx={{ ...cellSx, ...mono, fontSize: '0.7rem', color: T.textFaint }}>{timeFmt(e.timestamp)}</Box>
        <Box sx={cellSx}><Tag text={(levelOf(e) || 'INFO').slice(0, 4)} color={levelColor(levelOf(e), dark)} /></Box>
        <Box component="span" sx={{ ...cellSx, fontSize: '0.78rem', color: T.text }}>
          {e._burst ? <Box component="span" sx={{ color: T.teal, fontWeight: 800, mr: 0.5 }}>×{e._burst}</Box> : null}{e.message}
        </Box>
        {!compact && <Box component="span" sx={{ ...cellSx, ...mono, fontSize: '0.7rem', color: T.textFaint }}>{shortLogger(e.logger)}</Box>}
      </>
    );
  }

  return (
    <Box
      style={style}
      onClick={() => onSelect?.(e, index)}
      sx={{
        display: 'grid', gridTemplateColumns: template, alignItems: 'center', gap: 1,
        px: 1.25, borderLeft: `3px solid ${stripe}`, borderBottom: `1px solid ${S.divider}`,
        cursor: 'pointer', boxSizing: 'border-box', '&:hover': { bgcolor: S.cardHover },
      }}
    >
      {cells}
    </Box>
  );
});
Row.displayName = 'LogRow';

/** The virtualized log stream + (request mode) sortable column header + live jump-to-latest. */
export default function LogList({ entries, mode, sortKey, sortDir, onSort, onSelect, live, compact, canLoadMore, onReachOlderEdge }) {
  const T = useT();
  const S = adminSurface(T);
  const dark = T.bg === '#000000';
  const listRef = useRef(null);
  const outerRef = useRef(null);
  const atBottom = useRef(true);
  const scrollOffsetRef = useRef(0);
  const anchorRef = useRef(null); // { prevCount, offset } while an oldest-first (top) load is in flight
  const [showJump, setShowJump] = useState(false);
  const [sizeRef, size] = useSize();

  const template = compact ? TEMPLATES[mode].compact : TEMPLATES[mode].full;

  // Live tail: stick to the bottom unless the user scrolled up.
  useEffect(() => {
    if (live && atBottom.current && listRef.current && entries.length) {
      listRef.current.scrollToItem(entries.length - 1, 'end');
    }
  }, [entries.length, live]);

  const handleScroll = ({ scrollOffset, scrollUpdateWasRequested }) => {
    scrollOffsetRef.current = scrollOffset;
    if (scrollUpdateWasRequested) return;
    const el = outerRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    setShowJump(live && !atBottom.current);
  };

  // Oldest-first loads OLDER rows at the top, which would keep us at the trigger
  // edge and loop forever. When the older rows arrive, scroll down by their height
  // so our view stays put and we're no longer at the top edge.
  useEffect(() => {
    const a = anchorRef.current;
    if (a && entries.length > a.prevCount) {
      const added = entries.length - a.prevCount;
      listRef.current?.scrollTo(a.offset + added * ROW_H);
      anchorRef.current = null;
    }
  }, [entries.length]);

  const jump = () => {
    atBottom.current = true;
    setShowJump(false);
    listRef.current?.scrollToItem(entries.length - 1, 'end');
  };

  // Infinite "load older" when the visible window reaches the older edge. Which
  // edge is "older" depends on the sort: time-asc = top, otherwise bottom.
  const handleItemsRendered = ({ visibleStartIndex, visibleStopIndex }) => {
    if (live || !canLoadMore || !onReachOlderEdge || anchorRef.current) return;
    const count = entries.length;
    // Don't auto-load when everything already fits (nothing to scroll toward).
    if (count * ROW_H <= size.height + ROW_H) return;
    const ascTop = sortKey === 'time' && sortDir === 'asc';
    const older = ascTop ? visibleStartIndex <= 8 : visibleStopIndex >= count - 8;
    if (!older) return;
    if (ascTop) anchorRef.current = { prevCount: count, offset: scrollOffsetRef.current };
    onReachOlderEdge();
  };

  const itemData = { entries, mode, dark, compact, template, onSelect, T, S };

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {mode === 'request' && (
        <Box sx={{
          flexShrink: 0, display: 'grid', gridTemplateColumns: template, alignItems: 'center', gap: 1,
          px: 1.25, pl: 1.6, py: 0.85, bgcolor: S.inset, borderBottom: `1px solid ${S.border}`,
        }}>
          {REQ_COLS.filter((c) => !(compact && c.hideCompact)).map((c) => {
            const active = (sortKey || 'time') === c.key;
            return (
              <Box
                key={c.key} component="button" type="button" onClick={() => onSort(c.key)}
                sx={{
                  appearance: 'none', border: 'none', bgcolor: 'transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 0.25, p: 0, minWidth: 0,
                  fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
                  color: active ? T.teal : T.textMuted, '&:hover': { color: T.teal },
                }}
              >
                <Box component="span" sx={cellSx}>{c.label}</Box>
                {active && (sortDir === 'asc' ? <ArrowUpwardRoundedIcon sx={{ fontSize: 12 }} /> : <ArrowDownwardRoundedIcon sx={{ fontSize: 12 }} />)}
              </Box>
            );
          })}
        </Box>
      )}

      <Box ref={sizeRef} sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {size.width > 0 && (
          <FixedSizeList
            ref={listRef} outerRef={outerRef} height={size.height || 320} width={size.width}
            itemCount={entries.length} itemSize={ROW_H} itemData={itemData}
            onScroll={handleScroll} onItemsRendered={handleItemsRendered} overscanCount={12}
            style={{ overflowX: 'hidden' }}
          >
            {Row}
          </FixedSizeList>
        )}

        {showJump && (
          <Button
            onClick={jump} size="small" startIcon={<ArrowDownwardRoundedIcon />}
            sx={{
              position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
              bgcolor: T.teal, color: '#fff', textTransform: 'none', fontWeight: 800, fontSize: '0.74rem',
              borderRadius: 999, px: 1.75, boxShadow: `0 8px 22px ${T.tealGlow}`, '&:hover': { bgcolor: T.tealHover },
            }}
          >
            Jump to latest
          </Button>
        )}
      </Box>
    </Box>
  );
}
