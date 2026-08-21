import {
  Box, Typography, Chip, IconButton, Tooltip, Switch,
} from '@mui/material';
import DeleteIcon             from '@mui/icons-material/Delete';
import EditIcon               from '@mui/icons-material/Edit';
import DragIndicatorIcon      from '@mui/icons-material/DragIndicator';
import { Reorder, useDragControls } from 'framer-motion';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import { useTagDefs } from '../records/useTagDefs';
import { useRailMeta } from './useRailMeta';
import { railPageTypes, sortLabelFrom } from './tagsUtils';

// ── Rail row ──────────────────────────────────────────────────────────────────
export default function RailRow({ rail, onEdit, onDelete, onToggle, dragControls }) {
  const T   = useT();
  const S   = adminSurface(T);
  const { tagLabel } = useTagDefs();
  const { sortFields } = useRailMeta();
  const rule = rail.rule ?? {};

  const ruleChip = () => {
    switch (rule.type) {
      case 'tag':               return tagLabel(rule.tag) ?? rule.tag ?? '—';
      case 'genre':             return `Genre ${rule.genreId ?? '?'}`;
      case 'language':          return (rule.languages ?? []).join(', ') || '—';
      case 'filter':            return `${rule.field ?? '?'} ${rule.value ?? ''}`.trim();
      case 'manual':            return 'Manual list';
      case 'watchlist':         return 'User watchlist';
      case 'continueWatching':  return 'User progress';
      case 'becauseYouWatched': return 'Recommended (same genre)';
      default:                  return rule.type ?? '—';
    }
  };

  const pages = railPageTypes(rail);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.2, px: 1.5,
      '&:hover': { bgcolor: S.cardHover } }}>
      <DragIndicatorIcon
        onPointerDown={dragControls ? e => dragControls.start(e) : undefined}
        sx={{ fontSize: 16, color: T.textFaint, cursor: 'grab', flexShrink: 0, touchAction: 'none',
          '&:active': { cursor: 'grabbing' } }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: T.textPrimary,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rail.title}
          </Typography>
          {!(rail.active ?? true) && (
            <Chip label="Off" size="small" sx={{ height: 14, fontSize: '0.55rem', bgcolor: S.inset, color: T.textFaint }} />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, mt: 0.3, flexWrap: 'wrap' }}>
          <Chip label={rule.type ?? '?'} size="small"
            sx={{ height: 16, fontSize: '0.6rem', bgcolor: `${T.teal}18`, color: T.teal, fontWeight: 700 }} />
          <Chip label={ruleChip()} size="small"
            sx={{ height: 16, fontSize: '0.6rem', bgcolor: S.inset, color: T.textMuted }} />
          {pages.map(p => (
            <Chip key={p} label={p} size="small"
              sx={{ height: 16, fontSize: '0.6rem', bgcolor: S.inset, color: T.textFaint }} />
          ))}
          {rule.sort && (
            <Chip label={`${sortLabelFrom(sortFields, rule.sort)} ${rule.direction ?? 'DESC'}`} size="small"
              sx={{ height: 16, fontSize: '0.6rem', bgcolor: S.inset, color: T.textFaint }} />
          )}
          {rail.limitSize && (
            <Chip label={`×${rail.limitSize}`} size="small"
              sx={{ height: 16, fontSize: '0.6rem', bgcolor: S.inset, color: T.textFaint }} />
          )}
        </Box>
      </Box>
      <Switch size="small" checked={rail.active ?? true} onChange={() => onToggle(rail)}
        sx={{ '& .MuiSwitch-thumb': { bgcolor: (rail.active ?? true) ? T.teal : undefined },
          '& .MuiSwitch-track': { bgcolor: (rail.active ?? true) ? `${T.teal}66 !important` : undefined } }} />
      <Tooltip title="Edit rail">
        <IconButton size="small" onClick={() => onEdit(rail)}
          sx={{ color: T.textFaint, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>
          <EditIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete rail">
        <IconButton size="small" onClick={() => onDelete(rail)}
          sx={{ color: T.textFaint, '&:hover': { color: T.error, bgcolor: T.errorBg } }}>
          <DeleteIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// ── Draggable rail row wrapper ────────────────────────────────────────────────
export function DraggableRailRow({ rail, onEdit, onDelete, onToggle }) {
  const dragControls = useDragControls();
  return (
    <Reorder.Item value={rail} dragListener={false} dragControls={dragControls} style={{ listStyle: 'none' }} layout>
      <RailRow rail={rail} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} dragControls={dragControls} />
    </Reorder.Item>
  );
}
