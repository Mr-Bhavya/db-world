import { useState } from 'react';
import { Box, Chip, Popover, MenuItem, MenuList, IconButton, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LockIcon from '@mui/icons-material/Lock';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { addRecordTag, removeRecordTag } from '../api/adminApi';
import { useTagDefs } from './useTagDefs';

const parseTags = (tags) =>
  tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

export default function RecordTagsInline({ record }) {
  const T = useT();
  const [anchor, setAnchor] = useState(null);
  const [pendingTag, setPendingTag] = useState(null);
  const qc = useQueryClient();
  const { autoTagTypes, manualTagDefs, tagColor, tagLabel } = useTagDefs();

  const currentTagTypes = parseTags(record.tags);
  const addableTags = manualTagDefs.filter(d => !currentTagTypes.includes(d.tagType));

  const addMutation = useMutation({
    mutationFn: ({ recordId, tagType }) => addRecordTag(recordId, { tagType }),
    onMutate: ({ tagType }) => setPendingTag(tagType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['records'] });
      notify.success('Tag added', { duration: 1500 });
    },
    onError: () => notify.error('Failed to add tag'),
    onSettled: () => { setPendingTag(null); setAnchor(null); },
  });

  const removeMutation = useMutation({
    mutationFn: ({ recordId, tagType }) => removeRecordTag(recordId, tagType),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['records'] }),
    onError: () => notify.error('Failed to remove tag'),
  });

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .5, alignItems: 'center' }}>
      {currentTagTypes.map(tagType => {
        const isAuto = autoTagTypes.has(tagType);
        const color  = tagColor(tagType);
        return (
          <Chip
            key={tagType}
            label={tagLabel(tagType)}
            size="small"
            onDelete={isAuto ? undefined : () => removeMutation.mutate({ recordId: record.recordId, tagType })}
            icon={isAuto ? <LockIcon sx={{ fontSize: '10px !important', color: `${color} !important` }} /> : undefined}
            sx={{
              height: 18, fontSize: 10, fontWeight: 700,
              bgcolor: `${color}18`, color,
              border: `1px solid ${color}44`,
              '& .MuiChip-deleteIcon': { color, fontSize: 12 },
              '& .MuiChip-icon': { ml: '4px' },
            }}
          />
        );
      })}

      {addableTags.length > 0 && (
        <>
          <IconButton size="small" onClick={e => setAnchor(e.currentTarget)}
            sx={{ width: 18, height: 18, bgcolor: T.glass, color: T.textFaint, '&:hover': { bgcolor: T.tealBg, color: T.teal } }}>
            {pendingTag ? <CircularProgress size={10} color="inherit" /> : <AddIcon sx={{ fontSize: 12 }} />}
          </IconButton>
          <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)}
            PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, color: T.textPrimary, minWidth: 180, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' } }}>
            <MenuList dense>
              {addableTags.map(def => (
                <MenuItem key={def.tagType}
                  onClick={() => addMutation.mutate({ recordId: record.recordId, tagType: def.tagType })}
                  sx={{ fontSize: 12, color: T.textPrimary, '&:hover': { bgcolor: T.tealBg } }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tagColor(def.tagType), mr: 1, flexShrink: 0 }} />
                  {def.displayName ?? tagLabel(def.tagType)}
                </MenuItem>
              ))}
            </MenuList>
          </Popover>
        </>
      )}
    </Box>
  );
}
