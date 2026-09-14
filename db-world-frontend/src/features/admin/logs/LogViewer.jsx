import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, CircularProgress, useMediaQuery, useTheme } from '@mui/material';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import TerminalRoundedIcon from '@mui/icons-material/TerminalRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useT } from '@shared/theme';
import { AdminPage, EmptyState, ErrorState, TableSkeleton, adminSurface } from '@features/admin/adminUi';

import { fetchLogs, fetchAvailableDates, getSourceConfig, LOG_SOURCES_CONFIG } from './logApi';
import { viewMode, applyFilters, sortEntries, facets, isSlow, numStatus, levelOf } from './logUtils';
import useLiveLogs from './useLiveLogs';
import LogCommandBar from './LogCommandBar';
import LogFiltersSheet from './LogFiltersSheet';
import LogList from './LogList';
import LogDetailDrawer from './LogDetailDrawer';

const DEFAULT_FILTERS = {
  levels: [], methods: [], statusClasses: [], user: '', traceId: '', requestId: '', jobRunId: '',
  slow: false, dedupe: false, search: '',
};
const INITIAL_LIMIT = 500;
const LIMIT_STEP = 500;
const LIMIT_CAP = 10000;
/** Tail size when arriving via a ?jobRunId= deep link — see the note at its useState. */
const DEEP_LINK_LIMIT = 5000;

function Centered({ children }) {
  return <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>{children}</Box>;
}

export default function LogViewer() {
  const T = useT();
  const S = adminSurface(T);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Deep links land here — the admin Scheduler page sends ?jobRunId=&date= to open this
  // viewer already narrowed to one background-job run. Read once, as the initial state: after
  // that the controls own it, so changing a filter doesn't fight the URL.
  const [searchParams] = useSearchParams();
  const initial = useRef({
    source:   searchParams.get('source') || 'app',
    // A run's lines are INFO and above, so land on info rather than the usual request tab.
    subType:  searchParams.get('type') || (searchParams.get('jobRunId') ? 'info' : 'request'),
    date:     searchParams.get('date') || '',
    jobRunId: searchParams.get('jobRunId') || '',
  }).current;

  const [source, setSource] = useState(initial.source);
  const [subType, setSubType] = useState(initial.subType);
  const [formatState, setFormatState] = useState('JSON');
  // A run that happened earlier in the day can sit well beyond the default 500-line tail, so a
  // deep link starts with a wider window than a manual visit.
  const [limit, setLimit] = useState(initial.jobRunId ? DEEP_LINK_LIMIT : INITIAL_LIMIT);
  const [date, setDate] = useState(initial.date);
  const [live, setLive] = useState(false);
  const [filters, setFilters] = useState(
    initial.jobRunId ? { ...DEFAULT_FILTERS, jobRunId: initial.jobRunId } : DEFAULT_FILTERS,
  );
  const [sort, setSort] = useState({ key: 'time', dir: 'desc' });
  const [selected, setSelected] = useState(null);
  const [filtersAnchor, setFiltersAnchor] = useState(null);

  const srcCfg = getSourceConfig(source) || LOG_SOURCES_CONFIG[0];
  const supportsJson = !!srcCfg.supportsJson;
  const supportsHistory = !!srcCfg.supportsHistory;
  const format = supportsJson ? formatState : 'RAW';
  const mode = viewMode(source, subType, format);

  // ── Data ───────────────────────────────────────────────────────────────────
  const {
    data: staticData, isLoading, isError, isFetching, refetch,
  } = useQuery({
    queryKey: ['admin-logs', source, subType, format, limit, date],
    queryFn: () => fetchLogs({ source, type: subType, format, lines: limit, date: date || undefined }),
    enabled: !live,
    staleTime: 0,
    placeholderData: keepPreviousData, // keep the list on screen while loading a bigger tail
  });

  const { data: dates } = useQuery({
    queryKey: ['admin-log-dates', source, subType, format],
    queryFn: () => fetchAvailableDates({ source, type: subType, format }),
    enabled: supportsHistory && !live,
    staleTime: 60_000,
  });

  const { lines: liveLines, status: liveStatus, error: liveError, clear: clearLive } = useLiveLogs({
    source, type: subType, format, enabled: live,
  });

  // ── Pipeline (tolerant of {entries} envelope OR a bare array) ─────────────────
  const rawEntries = useMemo(
    () => (live ? liveLines : (Array.isArray(staticData) ? staticData : (staticData?.entries ?? []))),
    [live, liveLines, staticData],
  );
  const fileFound = Array.isArray(staticData) ? true : staticData?.fileFound;

  const dataFacets = useMemo(() => facets(rawEntries), [rawEntries]);
  const filtered = useMemo(() => applyFilters(rawEntries, filters), [rawEntries, filters]);
  // Respect the Newest/Oldest toggle in both modes. Live always orders by time
  // (newest at top for desc, bottom for asc) so the tail follows the chosen end.
  const displayed = useMemo(
    () => sortEntries(filtered, live ? 'time' : sort.key, sort.dir),
    [filtered, live, sort.key, sort.dir],
  );

  const summary = useMemo(() => ({
    shown: displayed.length,
    errors: displayed.filter((e) => typeof e === 'object' && (levelOf(e) === 'ERROR' || e.errorStatus || numStatus(e) >= 500)).length,
    slow: displayed.filter((e) => typeof e === 'object' && isSlow(e)).length,
  }), [displayed]);

  const activeFilterCount =
    (filters.levels.length ? 1 : 0) + (filters.methods.length ? 1 : 0) + (filters.statusClasses.length ? 1 : 0) +
    (filters.user ? 1 : 0) + (filters.traceId ? 1 : 0) + (filters.requestId ? 1 : 0) +
    (filters.jobRunId ? 1 : 0) + (filters.slow ? 1 : 0) + (filters.dedupe ? 1 : 0);

  // ── Infinite "load older" on scroll (backend re-tails a bigger window) ────────
  const pendingRef = useRef(false);
  useEffect(() => { pendingRef.current = false; }, [staticData]);
  const loadMore = useCallback(() => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setLimit((n) => Math.min(LIMIT_CAP, n + LIMIT_STEP));
  }, []);
  const canLoadMore = !live && limit < LIMIT_CAP && rawEntries.length >= limit;

  // ── Handlers ────────────────────────────────────────────────────────────────
  const changeSource = useCallback((id) => {
    const cfg = getSourceConfig(id);
    setSource(id);
    setSubType(cfg?.subTypes?.[0]?.id ?? 'main');
    setLive(false); setDate(''); setLimit(INITIAL_LIMIT);
  }, []);
  const changeSubType = useCallback((t) => { setSubType(t); setLimit(INITIAL_LIMIT); }, []);
  const changeDate = useCallback((d) => { setDate(d); setLimit(INITIAL_LIMIT); }, []);

  const onSort = useCallback((key) => {
    setSort((prev) => (prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'time' || key === 'status' || key === 'duration' ? 'desc' : 'asc' }));
  }, []);

  const patchFilters = useCallback((patch) => setFilters((f) => ({ ...f, ...patch })), []);
  const clearFilters = useCallback(() => setFilters((f) => ({ ...DEFAULT_FILTERS, search: f.search })), []);
  const handleSearch = useCallback((v) => patchFilters({ search: v }), [patchFilters]);
  const onRefresh = useCallback(() => { if (live) clearLive(); else refetch(); }, [live, clearLive, refetch]);

  // ── Fill-height: the list scrolls internally so the command bar never scrolls away ──
  const fillRef = useRef(null);
  const [fillH, setFillH] = useState(520);
  useLayoutEffect(() => {
    const el = fillRef.current;
    if (!el) return undefined;
    const recompute = () => {
      const top = el.getBoundingClientRect().top;
      setFillH(Math.max(300, Math.round(window.innerHeight - top - (isMobile ? 8 : 14))));
    };
    recompute();
    const id = setTimeout(recompute, 250);
    window.addEventListener('resize', recompute);
    return () => { window.removeEventListener('resize', recompute); clearTimeout(id); };
  }, [isMobile]);

  const loadingOlder = !live && isFetching && !isLoading && limit > INITIAL_LIMIT;

  let body;
  if (!live && isError) {
    body = <Centered><ErrorState message="Failed to load logs" onRetry={refetch} /></Centered>;
  } else if (!live && isLoading) {
    body = <Box sx={{ p: 2 }}><TableSkeleton rows={12} height={34} /></Box>;
  } else if (!live && fileFound === false) {
    body = <Centered><EmptyState icon={TerminalRoundedIcon} title="Log file not found" message="This log file doesn't exist yet on the server." /></Centered>;
  } else if (displayed.length === 0) {
    body = (
      <Centered>
        <EmptyState
          icon={TerminalRoundedIcon}
          title={rawEntries.length ? 'No matching entries' : (live ? 'Waiting for log lines…' : 'No entries')}
          message={
            // A run filter that matches nothing almost always means the run is older than the
            // tail being read, not that the run produced no output — say so, because "clear
            // the filters" is the wrong advice here.
            rawEntries.length && filters.jobRunId
              ? `No lines from run ${filters.jobRunId} in the last ${limit.toLocaleString()} lines of this log. Load more, or pick the run's own date above.`
              : rawEntries.length ? 'Try clearing the filters or search.'
              : (live ? 'New lines will appear here as they arrive.' : 'Nothing in this log yet.')
          }
          action={rawEntries.length ? <Button onClick={clearFilters} sx={{ color: T.teal, fontWeight: 700, textTransform: 'none' }}>Clear filters</Button> : undefined}
        />
      </Centered>
    );
  } else {
    body = (
      <LogList
        entries={displayed} mode={mode} sortKey={sort.key} sortDir={sort.dir}
        onSort={onSort} onSelect={(e) => setSelected(e)} live={live} compact={isMobile}
        canLoadMore={canLoadMore} onReachOlderEdge={loadMore}
        viewKey={`${source}|${subType}|${format}|${date}|${live}`}
      />
    );
  }

  return (
    <AdminPage
      title="Log Viewer"
      subtitle="Application, request, nginx and system logs"
      icon={TerminalRoundedIcon}
      onRefresh={onRefresh}
      refreshing={isFetching}
    >
      <Box ref={fillRef} sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, height: fillH }}>
        <LogCommandBar
          sources={LOG_SOURCES_CONFIG} source={source} onSource={changeSource}
          subTypes={srcCfg.subTypes} subType={subType} onSubType={changeSubType}
          supportsJson={supportsJson} format={format} onFormat={setFormatState}
          live={live} liveStatus={liveStatus} onToggleLive={() => setLive((v) => !v)}
          order={sort.key === 'time' ? sort.dir : 'desc'} onOrder={(dir) => setSort({ key: 'time', dir })}
          search={filters.search} onSearch={handleSearch}
          onOpenFilters={(e) => setFiltersAnchor(e.currentTarget)} activeFilterCount={activeFilterCount}
          summary={summary}
        />

        <Box sx={{
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
          bgcolor: S.card, border: `1px solid ${S.border}`, borderRadius: { xs: 2, sm: 3 }, overflow: 'hidden',
        }}>
          {live && liveStatus !== 'live' && liveError && (
            <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.85, bgcolor: T.warningBg, borderBottom: `1px solid ${S.divider}`, color: T.warning, fontSize: '0.76rem', fontWeight: 600 }}>
              <WarningAmberRoundedIcon sx={{ fontSize: 16 }} />
              <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {liveStatus === 'error' ? liveError : `Reconnecting — ${liveError}`}
              </Box>
            </Box>
          )}
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {body}
          </Box>
          {loadingOlder && (
            <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 0.85, borderTop: `1px solid ${S.divider}`, color: T.textMuted, fontSize: '0.76rem', fontWeight: 600 }}>
              <CircularProgress size={13} sx={{ color: T.teal }} /> Loading older logs…
            </Box>
          )}
        </Box>
      </Box>

      <LogFiltersSheet
        open={!!filtersAnchor} anchorEl={filtersAnchor} onClose={() => setFiltersAnchor(null)} isMobile={isMobile}
        mode={mode} facets={dataFacets} filters={filters} onChange={patchFilters} onClearAll={clearFilters}
        supportsHistory={supportsHistory && !live} dates={dates} date={date} onDate={changeDate}
      />

      <LogDetailDrawer entry={selected} onClose={() => setSelected(null)} />
    </AdminPage>
  );
}
