import { useState } from 'react';
import {
  Box, Typography, Button, CircularProgress, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Checkbox,
} from '@mui/material';
import CheckBoxIcon           from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import { getRecordsTable, bulkAddTag } from '../api/adminApi';
import { useTagDefs } from '../records/useTagDefs';

// ── Bulk add dialog ───────────────────────────────────────────────────────────
export default function BulkAddDialog({ tagType, open, onClose, onDone }) {
  const T                       = useT();
  const S                       = adminSurface(T);
  const { tagColor, tagLabel }  = useTagDefs();
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(0);
  const [selected, setSelected] = useState([]);
  const [priority, setPriority] = useState(50);
  const qc                      = useQueryClient();

  const { data, isFetching } = useQuery({
    queryKey: ['tagBulkSearch', search, page],
    queryFn:  () => getRecordsTable({ name: search || undefined, page, size: 10 }),
    enabled: open,
    placeholderData: prev => prev,
  });
  const rows = data?.content ?? [];

  const { mutate: doAdd, isPending: adding } = useMutation({
    mutationFn: () => bulkAddTag(tagType, selected, priority),
    onSuccess: (res) => {
      notify.success(`Added tag to ${res.added} record(s)`);
      qc.invalidateQueries({ queryKey: ['tagRecords', tagType] });
      qc.invalidateQueries({ queryKey: ['tagSummary'] });
      onDone();
    },
    onError: () => notify.error('Bulk add failed'),
  });

  const toggle = (id) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const fieldSx = {
    '& .MuiOutlinedInput-root': { bgcolor: T.inputBg, color: T.textPrimary,
      '& fieldset': { borderColor: S.border }, '&:hover fieldset': { borderColor: T.teal } },
    '& .MuiInputBase-input::placeholder': { color: T.textFaint },
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
      PaperProps={{ sx: { bgcolor: S.card, border: `1px solid ${S.border}`, color: T.textPrimary, borderRadius: 2 } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>
        Bulk Add — <Box component="span" sx={{ color: tagColor(tagType), fontWeight: 800 }}>{tagLabel(tagType)}</Box>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
        <TextField placeholder="Search records…" size="small" fullWidth value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }} sx={fieldSx} />
        {isFetching && <LinearProgress sx={{ height: 2, bgcolor: T.tealBg, '& .MuiLinearProgress-bar': { bgcolor: T.teal } }} />}
        <Box sx={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: .5,
          '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 2 } }}>
          {rows.map(r => (
            <Box key={r.recordId} onClick={() => toggle(r.recordId)}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, cursor: 'pointer',
                bgcolor: selected.includes(r.recordId) ? T.tealBg : 'transparent',
                border: `1px solid ${selected.includes(r.recordId) ? T.teal + '44' : S.border}`,
                '&:hover': { bgcolor: T.tealBg } }}>
              <Checkbox size="small" checked={selected.includes(r.recordId)}
                icon={<CheckBoxOutlineBlankIcon sx={{ fontSize: 16, color: T.textFaint }} />}
                checkedIcon={<CheckBoxIcon sx={{ fontSize: 16, color: T.teal }} />} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, color: T.textPrimary, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</Typography>
                <Typography sx={{ fontSize: 10, color: T.textFaint }}>{r.type} · {r.year ?? '—'}</Typography>
              </Box>
            </Box>
          ))}
          {rows.length === 0 && !isFetching && (
            <Typography sx={{ fontSize: 12, color: T.textFaint, textAlign: 'center', py: 2 }}>No records found</Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11, color: T.textFaint }}>Priority:</Typography>
          <TextField type="number" size="small" value={priority} onChange={e => setPriority(Number(e.target.value))}
            inputProps={{ min: 0, max: 999, step: 10 }}
            sx={{ width: 80, '& .MuiOutlinedInput-root': { bgcolor: T.inputBg, color: T.textPrimary,
              '& fieldset': { borderColor: S.border }, '&:hover fieldset': { borderColor: T.teal } } }} />
          <Typography sx={{ fontSize: 11, color: T.textMuted }}>{selected.length} selected</Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
        <Button variant="contained" disabled={selected.length === 0 || adding} onClick={() => doAdd()}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600 }}>
          {adding ? <CircularProgress size={18} color="inherit" /> : `Add to ${selected.length} Record${selected.length !== 1 ? 's' : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
