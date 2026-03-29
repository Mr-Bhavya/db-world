// db-world-frontend/src/features/adminv2/records/RecordTagsInline.jsx
import { useState } from 'react';
import { Box, Chip, Popover, MenuItem, MenuList, IconButton, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { addRecordTag, removeRecordTag } from '../api/adminApi';
import { ALL_TAGS, TAG_COLORS } from './tagConstants';

// tags comes from backend as a comma-separated string e.g. "FEATURED,TRENDING" or null
const parseTags = (tags) =>
  tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

export default function RecordTagsInline({ record, queryKey }) {
  const [anchor, setAnchor] = useState(null);
  const [pendingTag, setPendingTag] = useState(null);
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const currentTagTypes = parseTags(record.tags);
  const availableTags = ALL_TAGS.filter(t => !currentTagTypes.includes(t));

  const addMutation = useMutation({
    mutationFn: ({ recordId, tagType }) => addRecordTag(recordId, { tagType }),
    onMutate: async ({ tagType }) => {
      setPendingTag(tagType);
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData(queryKey);
      qc.setQueryData(queryKey, old => {
        if (!old) return old;
        return {
          ...old,
          content: old.content.map(r => r.recordId === record.recordId
            ? { ...r, tags: r.tags ? `${r.tags},${tagType}` : tagType }
            : r
          ),
        };
      });
      return { previous };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); enqueueSnackbar('Tag added', { variant:'success', autoHideDuration:1500 }); },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKey, context.previous);
      enqueueSnackbar('Failed to add tag', { variant:'error' });
    },
    onSettled: () => { setPendingTag(null); setAnchor(null); },
  });

  const removeMutation = useMutation({
    mutationFn: ({ recordId, tagType }) => removeRecordTag(recordId, tagType),
    onMutate: async ({ tagType }) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData(queryKey);
      qc.setQueryData(queryKey, old => ({
        ...old,
        content: old.content.map(r => r.recordId === record.recordId
          ? { ...r, tags: parseTags(r.tags).filter(t => t !== tagType).join(',') || null }
          : r
        ),
      }));
      return { previous };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKey, context.previous);
      enqueueSnackbar('Failed to remove tag', { variant:'error' });
    },
  });

  return (
    <Box sx={{ display:'flex', flexWrap:'wrap', gap:.5, alignItems:'center' }}>
      {currentTagTypes.map(tagType => (
        <Chip
          key={tagType}
          label={tagType.replace(/_/g,' ')}
          size="small"
          onDelete={() => removeMutation.mutate({ recordId: record.recordId, tagType })}
          sx={{ height:18, fontSize:10, fontWeight:700, bgcolor:`${TAG_COLORS[tagType] ?? '#0d9488'}18`, color: TAG_COLORS[tagType] ?? '#0d9488', border:`1px solid ${TAG_COLORS[tagType] ?? '#0d9488'}44`, '& .MuiChip-deleteIcon':{ color: TAG_COLORS[tagType] ?? '#0d9488', fontSize:12 } }}
        />
      ))}

      {availableTags.length > 0 && (
        <>
          <IconButton size="small" onClick={e => setAnchor(e.currentTarget)}
            sx={{ width:18, height:18, bgcolor:'rgba(0,0,0,0.06)', color:'rgba(15,23,42,0.4)', '&:hover':{ bgcolor:'rgba(13,148,136,0.12)', color:'#0d9488' } }}>
            {pendingTag ? <CircularProgress size={10} color="inherit" /> : <AddIcon sx={{ fontSize:12 }} />}
          </IconButton>
          <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)}
            PaperProps={{ sx:{ bgcolor:'#ffffff', border:'1px solid rgba(0,0,0,0.1)', color:'#0f172a', minWidth:160, boxShadow:'0 4px 20px rgba(0,0,0,0.12)' } }}>
            <MenuList dense>
              {availableTags.map(t => (
                <MenuItem key={t} onClick={() => addMutation.mutate({ recordId: record.recordId, tagType: t })}
                  sx={{ fontSize:12, color:'#0f172a', '&:hover':{ bgcolor:'rgba(13,148,136,0.08)' } }}>
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
