import { useState, useCallback } from 'react';
import {
  Box, Typography, IconButton, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Alert,
} from '@mui/material';
import RefreshIcon            from '@mui/icons-material/Refresh';
import SyncIcon               from '@mui/icons-material/Sync';
import AddIcon                from '@mui/icons-material/Add';
import ArrowBackIcon          from '@mui/icons-material/ArrowBack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import {
  SectionCard, StickyBar, AdminActionButton, adminSurface,
} from '@features/admin/adminUi';
import {
  getTagSummary, recalculateTag, recalculateAllTags, deleteTagDefinition,
} from '../api/adminApi';
import { useTagDefs } from '../records/useTagDefs';
import TagCard from './TagCard';
import TagRecordTable from './TagRecordTable';
import TagDefinitionsPanel from './TagDefinitionsPanel';
import CreateTagDialog from './CreateTagDialog';

// ── Tags tab ──────────────────────────────────────────────────────────────────

export default function TagsTab() {
  const T                                   = useT();
  const S                                   = adminSurface(T);
  const { autoTagTypes, tagLabel }          = useTagDefs();
  const qc                                  = useQueryClient();
  const [selectedTag, setSelectedTag]       = useState(null);
  const [recalcingTag, setRecalcingTag]     = useState(null);
  const [creating, setCreating]             = useState(false);
  const [deleting, setDeleting]             = useState(null);   // summary row pending confirmation

  const { data: summary, isLoading, refetch } = useQuery({
    queryKey: ['tagSummary'],
    queryFn:  getTagSummary,
    staleTime: 30_000,
  });

  const { mutate: doRecalcAll, isPending: recalcingAll } = useMutation({
    mutationFn: recalculateAllTags,
    onSuccess: () => {
      notify.success('All tags recalculated');
      qc.invalidateQueries({ queryKey: ['tagSummary'] });
      if (selectedTag) qc.invalidateQueries({ queryKey: ['tagRecords', selectedTag] });
    },
    onError: () => notify.error('Recalculation failed'),
  });

  const { mutate: doDelete, isPending: deletingTag } = useMutation({
    mutationFn: () => deleteTagDefinition(deleting.tagType),
    onSuccess: (res) => {
      const n = res?.recordsUntagged ?? 0;
      notify.success(`Tag deleted${n ? ` — ${n} record${n === 1 ? '' : 's'} untagged` : ''}`);
      if (selectedTag === deleting.tagType) setSelectedTag(null);
      qc.invalidateQueries({ queryKey: ['tagSummary'] });
      qc.invalidateQueries({ queryKey: ['tagDefinitions'] });
      qc.invalidateQueries({ queryKey: ['railMetadata'] });
      setDeleting(null);
    },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Delete failed'),
  });

  const handleRecalcOne = useCallback(async (tagType) => {
    setRecalcingTag(tagType);
    try {
      await recalculateTag(tagType);
      notify.success(`${tagLabel(tagType)} recalculated`);
      qc.invalidateQueries({ queryKey: ['tagSummary'] });
      qc.invalidateQueries({ queryKey: ['tagRecords', tagType] });
    } catch {
      notify.error('Recalculation failed');
    } finally {
      setRecalcingTag(null);
    }
  }, [qc, tagLabel]);

  return (
    <>
      {/* Sticky sub-toolbar */}
      <StickyBar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {selectedTag && (
            <IconButton size="small" onClick={() => setSelectedTag(null)}
              sx={{ color: T.textFaint, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>
              <ArrowBackIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )}
          <Typography sx={{ fontSize: 12, color: T.textMuted, flex: 1, minWidth: 160 }}>
            {selectedTag
              ? `${tagLabel(selectedTag)} — ${autoTagTypes.has(selectedTag) ? 'Auto-managed · recalculated by scheduler' : 'Manually managed'}`
              : 'Click a tag card to view and manage its records'}
          </Typography>
          <AdminActionButton variant="secondary" icon={RefreshIcon} onClick={() => refetch()}>Refresh</AdminActionButton>
          <AdminActionButton variant="secondary" icon={AddIcon} onClick={() => setCreating(true)}>New Tag</AdminActionButton>
          <AdminActionButton variant="primary" icon={SyncIcon} loading={recalcingAll} onClick={() => doRecalcAll()}>
            Recalculate All
          </AdminActionButton>
        </Box>
      </StickyBar>

      {/* Tag cards */}
      <SectionCard sx={{ mb: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' }, gap: { xs: 1, sm: 1.5 } }}>
          {isLoading
            ? [...Array(6)].map((_, i) => <Skeleton key={i} variant="rectangular" height={90} sx={{ borderRadius: 2, bgcolor: S.inset }} />)
            : (summary ?? []).map(s => (
              <TagCard key={s.tagType} summary={s} selected={selectedTag === s.tagType}
                onClick={() => setSelectedTag(prev => prev === s.tagType ? null : s.tagType)}
                recalculating={recalcingTag === s.tagType}
                onRecalc={() => handleRecalcOne(s.tagType)}
                onDelete={() => setDeleting(s)} />
            ))
          }
        </Box>
      </SectionCard>

      {!selectedTag && !isLoading && (
        <>
          <Alert severity="info" sx={{ mb: 2, bgcolor: `${T.teal}12`, color: T.textMuted,
            border: `1px solid ${T.teal}30`, '& .MuiAlert-icon': { color: T.teal }, fontSize: 12 }}>
            <strong>AUTO</strong> tags are computed by the scheduler every 6 hours — records you add
            to one by hand are erased on its next run, so those are read-only here. <strong>MANUAL</strong>{' '}
            tags are yours: nothing recalculates them. Use <strong>New Tag</strong> to make your own
            (e.g. a festival or seasonal collection), add records to it, then point a rail at it.
          </Alert>
          <TagDefinitionsPanel />
        </>
      )}

      {selectedTag && <TagRecordTable tagType={selectedTag} />}

      <CreateTagDialog open={creating} onClose={() => setCreating(false)} />

      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} fullWidth maxWidth="xs"
        PaperProps={{ sx: { bgcolor: S.card, border: `1px solid ${S.border}`, color: T.textPrimary, borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>
          Delete &ldquo;{deleting?.displayName ?? deleting?.tagType}&rdquo;?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: T.textMuted }}>
            {deleting?.count
              ? `This removes the tag from ${deleting.count} record${deleting.count === 1 ? '' : 's'}. The records themselves are not deleted.`
              : 'This tag has no records. The records themselves are never deleted.'}
          </Typography>
          <Typography sx={{ fontSize: 12, color: T.warning, mt: 1 }}>
            Any rail pointing at this tag will render empty until you repoint or remove it.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <AdminActionButton variant="secondary" onClick={() => setDeleting(null)}>Cancel</AdminActionButton>
          <AdminActionButton variant="danger" loading={deletingTag} onClick={() => doDelete()}>Delete</AdminActionButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
