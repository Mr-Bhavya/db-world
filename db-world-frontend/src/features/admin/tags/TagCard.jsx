import {
  Box, Typography, Chip, CircularProgress, IconButton, Tooltip,
} from '@mui/material';
import SyncIcon               from '@mui/icons-material/Sync';
import DeleteIcon             from '@mui/icons-material/Delete';
import LockIcon               from '@mui/icons-material/Lock';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import { useTagDefs } from '../records/useTagDefs';

// ── Tag summary card ──────────────────────────────────────────────────────────
export default function TagCard({ summary, selected, onClick, recalculating, onRecalc, onDelete }) {
  const T     = useT();
  const S     = adminSurface(T);
  const { tagColor, tagLabel } = useTagDefs();
  const color = tagColor(summary.tagType) ?? T.teal;
  const label = tagLabel(summary.tagType);
  return (
    <Box onClick={onClick}
      sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, border: `1px solid ${selected ? color : S.border}`,
        bgcolor: selected ? `${color}12` : S.card, cursor: 'pointer', transition: 'all .15s',
        '&:hover': { borderColor: color, bgcolor: `${color}10` },
        display: 'flex', flexDirection: 'column', gap: 1, position: 'relative', minHeight: 90 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
            <Typography sx={{ fontSize: { xs: 12, sm: 13 }, fontWeight: 700, color: T.textPrimary }}>{label}</Typography>
          </Box>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{summary.count}</Typography>
          <Typography sx={{ fontSize: 10, color: T.textFaint }}>records</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
          <Chip label={summary.automatic ? 'AUTO' : 'MANUAL'} size="small"
            icon={summary.automatic ? <LockIcon sx={{ fontSize: '10px !important' }} /> : undefined}
            sx={{ height: 18, fontSize: 9, fontWeight: 700,
              bgcolor: summary.automatic ? `${T.teal}18` : `${T.success}18`,
              color: summary.automatic ? T.teal : T.success,
              border: `1px solid ${summary.automatic ? T.teal : T.success}44`,
              '& .MuiChip-icon': { ml: '3px', color: `${T.teal} !important` } }} />
          {summary.active === false && (
            <Chip label="OFF" size="small"
              sx={{ height: 16, fontSize: 8, fontWeight: 700,
                bgcolor: `${T.error}18`, color: T.error, border: `1px solid ${T.error}44` }} />
          )}
        </Box>
      </Box>
      {summary.automatic && (
        <Tooltip title={`Recalculate ${label}`}>
          <IconButton size="small" onClick={e => { e.stopPropagation(); onRecalc(); }}
            disabled={recalculating}
            sx={{ position: 'absolute', bottom: 6, right: 6, width: 24, height: 24,
              color: T.textFaint, '&:hover': { color, bgcolor: `${color}18` } }}>
            {recalculating ? <CircularProgress size={12} color="inherit" /> : <SyncIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Tooltip>
      )}
      {/* Only admin-created tags can be deleted — a built-in would just be re-seeded on the
          next boot, leaving a half-deleted tag. Those use the Active toggle instead. */}
      {!summary.builtIn && (
        <Tooltip title={`Delete ${label}`}>
          <IconButton size="small" onClick={e => { e.stopPropagation(); onDelete(); }}
            sx={{ position: 'absolute', bottom: 6, right: 6, width: 24, height: 24,
              color: T.textFaint, '&:hover': { color: T.error, bgcolor: `${T.error}18` } }}>
            <DeleteIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
