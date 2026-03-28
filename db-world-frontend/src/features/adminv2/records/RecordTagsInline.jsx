// db-world-frontend/src/features/adminv2/records/RecordTagsInline.jsx
import { useState } from 'react';
import { Box, Chip, Popover, MenuItem, MenuList, IconButton, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { addRecordTag, removeRecordTag } from '../api/adminApi';

const ALL_TAGS = ['FEATURED','NEW_RELEASE','TRENDING','EDITOR_PICK','SHOW_ON_TOP','RECENTLY_ADDED','TOP_10'];

const TAG_COLORS = {
  FEATURED:       '#f59e0b',
  NEW_RELEASE:    '#10b981',
  TRENDING:       '#ef4444',
  EDITOR_PICK:    '#8b5cf6',
  SHOW_ON_TOP:    '#6366f1',
  RECENTLY_ADDED: '#06b6d4',
  TOP_10:         '#ec4899',
};

export default function RecordTagsInline({ record, queryKey }) {
  const [anchor, setAnchor] = useState(null);
  const [pendingTag, setPendingTag] = useState(null);
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const currentTagTypes = (record.tags ?? []).map(t => t.tagType);
  const availableTags = ALL_TAGS.filter(t => !currentTagTypes.includes(t));

  const addMutation = useMutation({
    mutationFn: ({ recordId, tagType }) => addRecordTag(recordId, { tagType }),
    onMutate: ({ tagType }) => {
      setPendingTag(tagType);
      // Optimistic update
      qc.setQueryData(queryKey, old => {
        if (!old) return old;
        return {
          ...old,
          content: old.content.map(r => r.recordId === record.recordId
            ? { ...r, tags: [...(r.tags ?? []), { tagType, priority: 0 }] }
            : r
          ),
        };
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); enqueueSnackbar('Tag added', { variant:'success', autoHideDuration:1500 }); },
    onError: (_, { tagType }) => {
      // Rollback
      qc.setQueryData(queryKey, old => ({
        ...old,
        content: old.content.map(r => r.recordId === record.recordId
          ? { ...r, tags: (r.tags ?? []).filter(t => t.tagType !== tagType) }
          : r
        ),
      }));
      enqueueSnackbar('Failed to add tag', { variant:'error' });
    },
    onSettled: () => { setPendingTag(null); setAnchor(null); },
  });

  const removeMutation = useMutation({
    mutationFn: ({ recordId, tagType }) => removeRecordTag(recordId, tagType),
    onMutate: ({ tagType }) => {
      qc.setQueryData(queryKey, old => ({
        ...old,
        content: old.content.map(r => r.recordId === record.recordId
          ? { ...r, tags: (r.tags ?? []).filter(t => t.tagType !== tagType) }
          : r
        ),
      }));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); },
    onError: () => { qc.invalidateQueries({ queryKey }); enqueueSnackbar('Failed to remove tag', { variant:'error' }); },
  });

  return (
    <Box sx={{ display:'flex', flexWrap:'wrap', gap:.5, alignItems:'center' }}>
      {(record.tags ?? []).map(tag => (
        <Chip
          key={tag.tagType}
          label={tag.tagType.replace(/_/g,' ')}
          size="small"
          onDelete={() => removeMutation.mutate({ recordId: record.recordId, tagType: tag.tagType })}
          sx={{ height:18, fontSize:10, fontWeight:700, bgcolor:`${TAG_COLORS[tag.tagType] ?? '#6366f1'}22`, color: TAG_COLORS[tag.tagType] ?? '#6366f1', border:`1px solid ${TAG_COLORS[tag.tagType] ?? '#6366f1'}44`, '& .MuiChip-deleteIcon':{ color: TAG_COLORS[tag.tagType] ?? '#6366f1', fontSize:12 } }}
        />
      ))}

      {availableTags.length > 0 && (
        <>
          <IconButton size="small" onClick={e => setAnchor(e.currentTarget)}
            sx={{ width:18, height:18, bgcolor:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.4)', '&:hover':{ bgcolor:'rgba(99,102,241,0.2)', color:'#6366f1' } }}>
            {pendingTag ? <CircularProgress size={10} color="inherit" /> : <AddIcon sx={{ fontSize:12 }} />}
          </IconButton>
          <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)}
            PaperProps={{ sx:{ bgcolor:'#1a1a2e', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', minWidth:160 } }}>
            <MenuList dense>
              {availableTags.map(t => (
                <MenuItem key={t} onClick={() => addMutation.mutate({ recordId: record.recordId, tagType: t })}
                  sx={{ fontSize:12, '&:hover':{ bgcolor:'rgba(99,102,241,0.15)' } }}>
                  <Box sx={{ width:8, height:8, borderRadius:'50%', bgcolor: TAG_COLORS[t], mr:1, flexShrink:0 }} />
                  {t.replace(/_/g,' ')}
                </MenuItem>
              ))}
            </MenuList>
          </Popover>
        </>
      )}
    </Box>
  );
}
