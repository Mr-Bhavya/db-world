import { useState, useMemo, useEffect } from 'react';
import {
  Box, Typography, Button, CircularProgress, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Tabs, Tab, Divider,
} from '@mui/material';
import AddIcon                from '@mui/icons-material/Add';
import PlaylistPlayIcon       from '@mui/icons-material/PlaylistPlay';
import { Reorder, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import {
  SectionCard, StickyBar, AdminActionButton, EmptyState, adminSurface,
} from '@features/admin/adminUi';
import {
  getRails, createRail, updateRail, deleteRail, reorderRails,
} from '../api/adminApi';
import { BLANK_RAIL, RAIL_SCOPE_TABS } from './railConstants';
import { railPageTypes, railOnPage } from './tagsUtils';
import { DraggableRailRow } from './RailRow';
import RailDialog from './RailDialog';

// ── Rails tab ─────────────────────────────────────────────────────────────────
export default function RailsTab() {
  const T                   = useT();
  const S                   = adminSurface(T);
  const qc                  = useQueryClient();
  const [railDialog,   setRailDialog]   = useState({ open: false, data: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, rail: null });
  const [scope,        setScope]        = useState('HOME'); // sub-tab key

  const { data: rails = [], isLoading } = useQuery({
    queryKey: ['adminRails'],
    queryFn:  getRails,
    staleTime: 30_000,
  });

  // Local ordered state for drag-to-reorder (full list, globally ordered by priority)
  const [orderedRails, setOrderedRails] = useState([]);
  const [orderDirty,   setOrderDirty]   = useState(false);

  useEffect(() => {
    if (rails.length > 0 && !orderDirty) {
      setOrderedRails([...rails].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)));
    }
  }, [rails, orderDirty]);

  // Sub-tab counts — drives the chip on each tab label. A multi-page rail counts
  // toward every page it's on.
  const scopeCounts = useMemo(() => {
    const counts = { HOME: 0, MOVIES: 0, SERIES: 0 };
    for (const r of orderedRails) {
      for (const p of railPageTypes(r)) {
        if (counts[p] !== undefined) counts[p]++;
      }
    }
    return counts;
  }, [orderedRails]);

  // Rails visible in the current sub-tab = those whose pageTypes include it.
  // Maintains the globally-sorted order so drag-reorder yields sensible priority deltas.
  const visibleRails = useMemo(
    () => orderedRails.filter(r => railOnPage(r, scope)),
    [orderedRails, scope],
  );

  /**
   * Drag-reorder only rearranges within the current sub-tab. We splice the reordered
   * subset back into the global list at the same positions the visible rails occupied,
   * so off-tab rails keep their priority untouched.
   */
  const handleReorder = (newSubset) => {
    const visibleIndexes = [];
    orderedRails.forEach((r, idx) => { if (railOnPage(r, scope)) visibleIndexes.push(idx); });
    const next = [...orderedRails];
    visibleIndexes.forEach((globalIdx, i) => { next[globalIdx] = newSubset[i]; });
    setOrderedRails(next);
    setOrderDirty(true);
  };

  const { mutate: doSave, isPending: saving } = useMutation({
    mutationFn: (d) => d.id ? updateRail(d.id, d) : createRail(d),
    onSuccess: (_, vars) => {
      notify.success(`Rail ${vars.id ? 'updated' : 'created'}`);
      qc.invalidateQueries({ queryKey: ['adminRails'] });
      setRailDialog({ open: false, data: null });
    },
    onError: () => notify.error('Save failed'),
  });

  const { mutate: doDelete, isPending: deleting } = useMutation({
    mutationFn: (rail) => deleteRail(rail.id),
    onSuccess: () => {
      notify.success('Rail deleted');
      setOrderDirty(false);
      qc.invalidateQueries({ queryKey: ['adminRails'] });
      setDeleteDialog({ open: false, rail: null });
    },
    onError: () => notify.error('Delete failed'),
  });

  const { mutate: doToggle } = useMutation({
    mutationFn: (rail) => updateRail(rail.id, { ...rail, active: !rail.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminRails'] }),
    onError: () => notify.error('Toggle failed'),
  });

  const { mutate: doReorder, isPending: reordering } = useMutation({
    mutationFn: () => reorderRails(orderedRails),
    onSuccess: () => {
      notify.success('Order saved', { duration: 1500 });
      setOrderDirty(false);
      qc.invalidateQueries({ queryKey: ['adminRails'] });
    },
    onError: () => notify.error('Failed to save order'),
  });

  // A new rail seeds with the current sub-tab's page; add more pages in the editor's
  // "Pages — select one or more" picker to make it span tabs.
  const newRailSeed = () => ({
    ...BLANK_RAIL,
    pageTypes: [scope],
  });

  const scopeLabel = RAIL_SCOPE_TABS.find(t => t.key === scope)?.label;

  return (
    <>
      {/* Sticky sub-tabs + actions */}
      <StickyBar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Tabs value={scope} onChange={(_, v) => setScope(v)} variant="scrollable" scrollButtons={false}
            sx={{ minHeight: 36, flex: 1,
              '& .MuiTab-root': { fontSize: 12, color: T.textMuted, textTransform: 'none', minHeight: 36, px: 1.75 },
              '& .Mui-selected': { color: `${T.teal} !important` },
              '& .MuiTabs-indicator': { bgcolor: T.teal } }}>
            {RAIL_SCOPE_TABS.map(t => (
              <Tab key={t.key} value={t.key}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {t.label}
                    <Box component="span" sx={{ fontSize: 10, color: T.textFaint, bgcolor: S.inset,
                      px: 0.6, py: 0.1, borderRadius: 1, minWidth: 18, textAlign: 'center' }}>
                      {scopeCounts[t.key] ?? 0}
                    </Box>
                  </Box>
                } />
            ))}
          </Tabs>
          {orderDirty && (
            <AdminActionButton variant="primary" loading={reordering} onClick={() => doReorder()}>
              Save Order
            </AdminActionButton>
          )}
          <AdminActionButton variant="primary" icon={AddIcon}
            onClick={() => setRailDialog({ open: true, data: newRailSeed() })}>
            {`New ${scopeLabel} Rail`}
          </AdminActionButton>
        </Box>
      </StickyBar>

      {isLoading ? (
        <SectionCard padding={false}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 1 }}>
            {[...Array(5)].map((_, i) => <Skeleton key={i} variant="rectangular" height={52} sx={{ borderRadius: 1.5, bgcolor: S.inset }} />)}
          </Box>
        </SectionCard>
      ) : visibleRails.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={PlaylistPlayIcon}
            title={`No rails configured for ${scopeLabel}`}
            message="Create a rail to start curating this page."
            action={
              <AdminActionButton variant="secondary" icon={AddIcon}
                onClick={() => setRailDialog({ open: true, data: newRailSeed() })}>
                Create first rail
              </AdminActionButton>
            }
          />
        </SectionCard>
      ) : (
        <SectionCard padding={false}>
          <Reorder.Group axis="y" values={visibleRails} onReorder={handleReorder}
            style={{ padding: 0, margin: 0 }}>
            <AnimatePresence>
              {visibleRails.map((rail, i) => (
                <Box key={rail.id ?? i}>
                  {i > 0 && <Divider sx={{ borderColor: S.divider }} />}
                  <DraggableRailRow
                    rail={rail}
                    onEdit={(r) => setRailDialog({ open: true, data: { ...r } })}
                    onDelete={(r) => setDeleteDialog({ open: true, rail: r })}
                    onToggle={doToggle}
                  />
                </Box>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        </SectionCard>
      )}

      <RailDialog open={railDialog.open} data={railDialog.data}
        onClose={() => setRailDialog({ open: false, data: null })}
        onSave={doSave} saving={saving} />

      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, rail: null })}
        PaperProps={{ sx: { bgcolor: S.card, border: `1px solid ${S.border}`, borderRadius: 2 } }}>
        <DialogTitle sx={{ color: T.textPrimary, fontSize: '1rem', fontWeight: 700 }}>Delete Rail</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: T.textMuted, fontSize: '0.9rem' }}>
            Delete <Box component="strong" sx={{ color: T.textPrimary }}>{deleteDialog.rail?.title}</Box>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialog({ open: false, rail: null })} sx={{ color: T.textMuted }}>Cancel</Button>
          <Button variant="contained" color="error" disabled={deleting}
            onClick={() => doDelete(deleteDialog.rail)}>
            {deleting ? <CircularProgress size={18} color="inherit" /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
