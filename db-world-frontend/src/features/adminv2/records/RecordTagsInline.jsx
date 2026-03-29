import { useState } from 'react';
import { Box, Chip, Popover, MenuItem, MenuList, IconButton, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { addRecordTag, removeRecordTag } from '../api/adminApi';
import { ALL_TAGS, TAG_COLORS } from './tagConstants';

const parseTags = (tags) =>
  tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

export default function RecordTagsInline({ record }) {
  const T = useT();
  const [anchor, setAnchor] = useState(null);
  const [pendingTag, setPendingTag] = useState(null);
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const currentTagTypes = parseTags(record.tags);
  const availableTags = ALL_TAGS.filter(t => !currentTagTypes.includes(t));

  const addMutation = useMutation({
    mutationFn: ({ recordId, tagType }) => addRecordTag(recordId, { tagType }),
    onMutate: ({ tagType }) => setPendingTag(tagType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['records'] });
      enqueueSnackbar('Tag added', { variant: 'success', autoHideDuration: 1500 });
    },
    onError: () => enqueueSnackbar('Failed to add tag', { variant: 'error' }),
    onSettled: () => { setPendingTag(null); setAnchor(null); },
  });

  const removeMutation = useMutation({
    mutationFn: ({ recordId, tagType }) => removeRecordTag(recordId, tagType),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['records'] }),
    onError: () => enqueueSnackbar('Failed to remove tag', { variant: 'error' }),
  });

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .5, alignItems: 'center' }}>
      {currentTagTypes.map(tagType => (
        <Chip
          key={tagType}
          label={tagType.replace(/_/g, ' ')}
          size="small"
          onDelete={() => removeMutation.mutate({ recordId: record.recordId, tagType })}
          sx={{
            height: 18, fontSize: 10, fontWeight: 700,
            bgcolor: `${TAG_COLORS[tagType] ?? T.teal}18`,
            color: TAG_COLORS[tagType] ?? T.teal,
            border: `1px solid ${TAG_COLORS[tagType] ?? T.teal}44`,
            '& .MuiChip-deleteIcon': { color: TAG_COLORS[tagType] ?? T.teal, fontSize: 12 },
          }}
        />
      ))}

      {availableTags.length > 0 && (
        <>
          <IconButton size="small" onClick={e => setAnchor(e.currentTarget)}
            sx={{ width: 18, height: 18, bgcolor: T.glass, color: T.textFaint, '&:hover': { bgcolor: T.tealBg, color: T.teal } }}>
            {pendingTag ? <CircularProgress size={10} color="inherit" /> : <AddIcon sx={{ fontSize: 12 }} />}
          </IconButton>
          <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)}
            PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, color: T.textPrimary, minWidth: 160, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' } }}>
            <MenuList dense>
              {availableTags.map(t => (
                <MenuItem key={t} onClick={() => addMutation.mutate({ recordId: record.recordId, tagType: t })}
                  sx={{ fontSize: 12, color: T.textPrimary, '&:hover': { bgcolor: T.tealBg } }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: TAG_COLORS[t], mr: 1, flexShrink: 0 }} />
                  {t.replace(/_/g, ' ')}
                </MenuItem>
              ))}
            </MenuList>
          </Popover>
        </>
      )}
    </Box>
  );
}
