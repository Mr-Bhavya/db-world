import { useState } from 'react';
import {
  Box, Typography, Chip, LinearProgress,
  IconButton, Skeleton, useTheme, useMediaQuery, Checkbox,
} from '@mui/material';
import AddIcon                from '@mui/icons-material/Add';
import DeleteIcon             from '@mui/icons-material/Delete';
import LockIcon               from '@mui/icons-material/Lock';
import CheckBoxIcon           from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { SectionCard, AdminActionButton, adminSurface } from '@features/admin/adminUi';
import { getRecordsByTag, bulkRemoveTag } from '../api/adminApi';
import { useTagDefs } from '../records/useTagDefs';
import PaginationBar from './PaginationBar';
import BulkAddDialog from './BulkAddDialog';

// ── Tag record table ──────────────────────────────────────────────────────────
export default function TagRecordTable({ tagType }) {
  const T        = useT();
  const S        = adminSurface(T);
  const { autoTagTypes, tagLabel } = useTagDefs();
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [page, setPage]         = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState([]);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const qc                      = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['tagRecords', tagType, page, pageSize],
    queryFn:  () => getRecordsByTag(tagType, { page, size: pageSize }),
    placeholderData: prev => prev,
  });
  const rows       = data?.content ?? [];
  const totalEl    = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const { mutate: doRemove, isPending: removing } = useMutation({
    mutationFn: (ids) => bulkRemoveTag(tagType, ids),
    onSuccess: (res) => {
      notify.success(`Removed from ${res.removed} record(s)`);
      setSelected([]);
      qc.invalidateQueries({ queryKey: ['tagRecords', tagType] });
      qc.invalidateQueries({ queryKey: ['tagSummary'] });
    },
    onError: () => notify.error('Remove failed'),
  });

  const isAuto      = autoTagTypes.has(tagType);
  const allSelected = rows.length > 0 && rows.every(r => selected.includes(r.recordId));
  const toggleAll   = () => setSelected(allSelected ? [] : rows.map(r => r.recordId));
  const toggleOne   = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toolbar = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      {!isAuto && (
        <AdminActionButton variant="secondary" icon={AddIcon} onClick={() => setBulkAddOpen(true)}>
          Add Records
        </AdminActionButton>
      )}
      {selected.length > 0 && !isAuto && (
        <AdminActionButton variant="danger" icon={DeleteIcon} loading={removing} onClick={() => doRemove(selected)}>
          Remove {selected.length}
        </AdminActionButton>
      )}
      {isAuto && (
        <Chip label="Auto-managed" size="small" icon={<LockIcon sx={{ fontSize: '10px !important' }} />}
          sx={{ height: 22, fontSize: 10, color: T.textFaint, bgcolor: S.inset,
            border: `1px solid ${S.border}`, '& .MuiChip-icon': { color: `${T.textFaint} !important` } }} />
      )}
    </Box>
  );

  return (
    <SectionCard title={`${tagLabel(tagType)} · ${totalEl} records`} action={toolbar} padding={false} sx={{ mt: 2 }}>
      {isFetching && !isLoading && (
        <LinearProgress sx={{ height: 2, flexShrink: 0, bgcolor: T.tealBg, '& .MuiLinearProgress-bar': { bgcolor: T.teal } }} />
      )}

      {isLoading ? (
        <Box sx={{ px: 2, py: 1, display: 'flex', flexDirection: 'column', gap: .5 }}>
          {[...Array(8)].map((_, i) => <Skeleton key={i} variant="rectangular" height={38} sx={{ borderRadius: 1, bgcolor: S.inset }} />)}
        </Box>
      ) : isMobile ? (
        <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {rows.map(r => (
            <Box key={r.recordId} sx={{ p: 1.25, borderRadius: 1.5, border: `1px solid ${S.border}`, bgcolor: S.inset }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.25 }}>
                    <Typography sx={{ fontSize: 10, color: T.textFaint }}>#{r.recordId}</Typography>
                    <Typography sx={{ fontSize: 10, color: T.textFaint }}>{r.type}</Typography>
                    {r.year && <Typography sx={{ fontSize: 10, color: T.textFaint }}>{r.year}</Typography>}
                  </Box>
                </Box>
                {!isAuto && (
                  <IconButton size="small" onClick={() => doRemove([r.recordId])}
                    sx={{ color: T.textFaint, '&:hover': { color: T.error, bgcolor: T.errorBg }, ml: 1 }}>
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                )}
              </Box>
            </Box>
          ))}
          {rows.length === 0 && (
            <Typography sx={{ fontSize: 13, color: T.textFaint, textAlign: 'center', py: 3 }}>No records with this tag</Typography>
          )}
        </Box>
      ) : (
        <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <Box sx={{ minWidth: 600 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: isAuto ? '48px 1fr 100px 80px 160px 160px' : '48px 48px 1fr 100px 80px 160px 160px',
              px: 2, py: 0.75, borderBottom: `1px solid ${S.divider}`, bgcolor: S.inset }}>
              {!isAuto && (
                <Checkbox size="small" checked={allSelected} indeterminate={selected.length > 0 && !allSelected}
                  onChange={toggleAll}
                  icon={<CheckBoxOutlineBlankIcon sx={{ fontSize: 16, color: T.textFaint }} />}
                  checkedIcon={<CheckBoxIcon sx={{ fontSize: 16, color: T.teal }} />}
                  indeterminateIcon={<CheckBoxIcon sx={{ fontSize: 16, color: T.teal }} />} />
              )}
              {['#', 'Name', 'Type', 'Year', 'Added', 'Updated'].map(h => (
                <Typography key={h} sx={{ fontSize: 10, fontWeight: 700, color: T.textFaint, textTransform: 'uppercase', letterSpacing: .5 }}>{h}</Typography>
              ))}
            </Box>
            {rows.map(r => (
              <Box key={r.recordId}
                sx={{ display: 'grid', gridTemplateColumns: isAuto ? '48px 1fr 100px 80px 160px 160px' : '48px 48px 1fr 100px 80px 160px 160px',
                  px: 2, py: 1, borderBottom: `1px solid ${S.divider}`, alignItems: 'center', '&:hover': { bgcolor: T.tealBg } }}>
                {!isAuto && (
                  <Checkbox size="small" checked={selected.includes(r.recordId)} onChange={() => toggleOne(r.recordId)}
                    icon={<CheckBoxOutlineBlankIcon sx={{ fontSize: 16, color: T.textFaint }} />}
                    checkedIcon={<CheckBoxIcon sx={{ fontSize: 16, color: T.teal }} />} />
                )}
                <Typography sx={{ fontSize: 11, color: T.textFaint }}>{r.recordId}</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</Typography>
                <Chip label={r.type} size="small"
                  sx={{ height: 18, fontSize: 9, fontWeight: 700,
                    bgcolor: r.type === 'MOVIE' ? `${T.teal}18` : `${T.success}18`,
                    color: r.type === 'MOVIE' ? T.teal : T.success,
                    border: `1px solid ${r.type === 'MOVIE' ? T.teal : T.success}44` }} />
                <Typography sx={{ fontSize: 11, color: T.textMuted }}>{r.year ?? '—'}</Typography>
                <Typography sx={{ fontSize: 11, color: T.textFaint }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</Typography>
                <Typography sx={{ fontSize: 11, color: T.textFaint }}>{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '—'}</Typography>
              </Box>
            ))}
            {rows.length === 0 && (
              <Typography sx={{ fontSize: 13, color: T.textFaint, textAlign: 'center', py: 4 }}>No records with this tag</Typography>
            )}
          </Box>
        </Box>
      )}

      {totalEl > 0 && (
        <PaginationBar page={page} totalPages={totalPages} totalElements={totalEl}
          pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} isFetching={isFetching} />
      )}

      <BulkAddDialog tagType={tagType} open={bulkAddOpen}
        onClose={() => setBulkAddOpen(false)} onDone={() => setBulkAddOpen(false)} />
    </SectionCard>
  );
}
