import React, { useCallback, useMemo, useState } from 'react';
import {
  Box, Typography, TextField, InputAdornment, IconButton, Button,
  useMediaQuery, useTheme, CircularProgress,
} from '@mui/material';
import {
  TuneRounded, SearchRounded, CloseRounded, FilterAltRounded, FilterAltOffRounded,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import {
  AdminPage, SectionCard, LoadingState, ErrorState, EmptyState, adminSurface,
} from '@features/admin/adminUi';
import settingsApi from './api';
import CategoryRail, { ALL } from './CategoryRail';
import SettingRow from './SettingRow';
import {
  allSettings, asText, filterCategories, isModified, pendingChanges,
} from './settingsUtils';

/**
 * Runtime configuration.
 *
 * Two panes: a sticky category rail and ONE settings column. The page previously
 * packed the categories into CSS multi-columns (`columnCount` up to 3), which put
 * every row inside a ~400px track while its internal breakpoints went on measuring
 * the VIEWPORT — so the label column collapsed and long config keys wrapped one
 * character per line. A single content column removes that class of bug entirely:
 * there is no longer a container whose width the breakpoints can disagree with.
 *
 * At 52 settings across 10 categories the rail also does real work — search,
 * per-category counts and a dot for categories holding non-default values.
 */
const SettingsPanel = () => {
  const T = useT();
  const S = adminSurface(T);
  const qc = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [query, setQuery] = useState('');
  const [modifiedOnly, setModifiedOnly] = useState(false);
  const [selected, setSelected] = useState(ALL);
  /** key → draft value. Only committed when the save bar is used. */
  const [drafts, setDrafts] = useState({});

  const { data: categories = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: settingsApi.list,
  });

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = useMemo(
    () => filterCategories(categories, { query, modifiedOnly }),
    [categories, query, modifiedOnly],
  );

  /** Rail counts follow the active filter, so it never offers an empty category. */
  const counts = useMemo(() => {
    const out = { [ALL]: { total: 0, modified: 0 } };
    for (const cat of filtered) {
      const modified = cat.settings.filter(isModified).length;
      out[cat.category] = { total: cat.settings.length, modified };
      out[ALL].total += cat.settings.length;
      out[ALL].modified += modified;
    }
    return out;
  }, [filtered]);

  const visible = useMemo(
    () => (selected === ALL ? filtered : filtered.filter((c) => c.category === selected)),
    [filtered, selected],
  );

  const railCategories = useMemo(() => filtered.map((c) => c.category), [filtered]);
  const totalModified = useMemo(
    () => allSettings(categories).filter(isModified).length,
    [categories],
  );

  // ── Drafts ─────────────────────────────────────────────────────────────────
  const pending = useMemo(() => pendingChanges(categories, drafts), [categories, drafts]);

  const setDraft = useCallback((key, value) => {
    setDrafts((d) => ({ ...d, [key]: value }));
  }, []);

  const revertDraft = useCallback((key) => {
    setDrafts((d) => {
      const { [key]: _dropped, ...rest } = d;
      return rest;
    });
  }, []);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    // Sequential, not Promise.all: this runs against a Raspberry Pi, and a handful
    // of config writes is not worth opening N connections at once.
    mutationFn: async (changes) => {
      for (const { key, value } of changes) {
        await settingsApi.update(key, value);
      }
      return changes.length;
    },
    onSuccess: (n) => {
      notify.success(n === 1 ? 'Saved 1 setting' : `Saved ${n} settings`);
      setDrafts({});
      qc.invalidateQueries({ queryKey: ['admin', 'config'] });
    },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Save failed'),
  });

  const resetMut = useMutation({
    mutationFn: (key) => settingsApi.reset(key),
    onSuccess: (_r, key) => {
      notify.info(`Reset ${key}`);
      revertDraft(key);
      qc.invalidateQueries({ queryKey: ['admin', 'config'] });
    },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Reset failed'),
  });

  const busy = saveMut.isPending || resetMut.isPending;

  const onSearch = (v) => {
    setQuery(v);
    // Searching inside one category is a good way to conclude a setting does not
    // exist, so the first keystroke widens the scope to everything.
    if (v && selected !== ALL) setSelected(ALL);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const body = () => {
    if (isLoading) return <LoadingState label="Loading settings…" />;
    if (isError) return <ErrorState message="Failed to load settings." onRetry={refetch} />;
    if (visible.length === 0) {
      return (
        <SectionCard>
          <EmptyState
            icon={SearchRounded}
            title="Nothing matches"
            message={modifiedOnly && !query
              ? 'Every setting is currently at its default value.'
              : `No setting matches “${query}”.`}
            action={(
              <Button
                onClick={() => { setQuery(''); setModifiedOnly(false); }}
                sx={{ color: T.teal, fontWeight: 700, textTransform: 'none' }}
              >
                Clear filters
              </Button>
            )}
          />
        </SectionCard>
      );
    }
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {visible.map((cat) => (
          <SectionCard key={cat.category} padding={false} sx={{ overflow: 'hidden' }}>
            <Box sx={{
              display: 'flex', alignItems: 'baseline', gap: 1,
              px: { xs: 1.5, sm: 2 }, py: 1.5,
              borderBottom: `1px solid ${S.divider}`, bgcolor: S.inset,
            }}>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: T.text }}>
                {cat.category}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: T.textFaint }}>
                {cat.settings.length} setting{cat.settings.length === 1 ? '' : 's'}
              </Typography>
            </Box>
            {cat.settings.map((s, i) => (
              <SettingRow
                key={s.key}
                s={s}
                draft={drafts[s.key]}
                dirty={Object.hasOwn(drafts, s.key) && asText(drafts[s.key]) !== asText(s.value)}
                onDraft={setDraft}
                onRevert={revertDraft}
                onReset={(key) => resetMut.mutate(key)}
                busy={busy}
                last={i === cat.settings.length - 1}
              />
            ))}
          </SectionCard>
        ))}
      </Box>
    );
  };

  return (
    <AdminPage
      title="Settings"
      subtitle="Runtime configuration — changes apply live unless a setting is flagged as restart-required."
      icon={TuneRounded}
      onRefresh={refetch}
      refreshing={isLoading}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2,
      }}>
        <TextField
          size="small"
          placeholder="Search settings, keys or descriptions…"
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          sx={{ flex: 1, minWidth: 220 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded sx={{ fontSize: 18, color: T.textFaint }} />
              </InputAdornment>
            ),
            endAdornment: query ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setQuery('')} sx={{ color: T.textFaint }}>
                  <CloseRounded sx={{ fontSize: 16 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
        <Button
          size="small"
          onClick={() => setModifiedOnly((v) => !v)}
          startIcon={modifiedOnly
            ? <FilterAltRounded sx={{ fontSize: 16 }} />
            : <FilterAltOffRounded sx={{ fontSize: 16 }} />}
          sx={{
            textTransform: 'none', fontWeight: 700, fontSize: '0.78rem',
            borderRadius: 2, px: 1.5,
            border: `1px solid ${modifiedOnly ? T.teal : S.border}`,
            color: modifiedOnly ? T.teal : T.textMuted,
            bgcolor: modifiedOnly ? S.inset : 'transparent',
            '&:hover': { bgcolor: S.cardHover },
          }}
        >
          Changed only ({totalModified})
        </Button>
      </Box>

      {/* ── Unsaved-changes bar ─────────────────────────────────────────── */}
      {pending.length > 0 && (
        <Box sx={{
          position: 'sticky', top: 0, zIndex: 5, mb: 2,
          display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
          px: 2, py: 1.25, borderRadius: 3,
          bgcolor: S.card, border: `1px solid ${T.teal}`,
          boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
        }}>
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: '0.82rem', fontWeight: 700, color: T.text }}>
            {pending.length} unsaved change{pending.length === 1 ? '' : 's'}
          </Typography>
          <Button
            size="small"
            disabled={busy}
            onClick={() => setDrafts({})}
            sx={{ textTransform: 'none', fontWeight: 700, color: T.textMuted }}
          >
            Discard
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={busy}
            onClick={() => saveMut.mutate(pending)}
            startIcon={saveMut.isPending ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : null}
            sx={{
              textTransform: 'none', fontWeight: 700, px: 2,
              bgcolor: T.teal, '&:hover': { bgcolor: '#0f766e' },
            }}
          >
            Save {pending.length === 1 ? 'change' : 'all'}
          </Button>
        </Box>
      )}

      {/* ── Two panes ───────────────────────────────────────────────────── */}
      <Box sx={{
        display: 'grid',
        // minmax(0, 1fr), not 1fr: a bare `1fr` track has min-width:auto and refuses
        // to shrink below its content, which is how the old layout pushed its
        // overflow onto the label column instead of onto the track.
        gridTemplateColumns: { xs: '1fr', md: '224px minmax(0, 1fr)' },
        gap: 2,
        alignItems: 'start',
      }}>
        {!isLoading && !isError && (
          <CategoryRail
            categories={railCategories}
            counts={counts}
            selected={selected}
            onSelect={setSelected}
            isMobile={isMobile}
          />
        )}
        <Box sx={{ minWidth: 0 }}>{body()}</Box>
      </Box>
    </AdminPage>
  );
};

export default SettingsPanel;
