import { useMemo } from 'react';
import {
  Box, Typography, CircularProgress, IconButton, Tooltip, Select, MenuItem,
} from '@mui/material';
import FirstPageIcon          from '@mui/icons-material/FirstPage';
import LastPageIcon           from '@mui/icons-material/LastPage';
import ChevronLeftIcon        from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon       from '@mui/icons-material/ChevronRight';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';

// ── Pagination bar ────────────────────────────────────────────────────────────
export default function PaginationBar({ page, totalPages, totalElements, pageSize, onPage, onPageSize, isFetching }) {
  const T     = useT();
  const S     = adminSurface(T);
  const start = totalElements === 0 ? 0 : page * pageSize + 1;
  const end   = Math.min((page + 1) * pageSize, totalElements);
  const _pageButtons = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
    const set    = new Set([0, totalPages - 1, page, page - 1, page + 1].filter(p => p >= 0 && p < totalPages));
    const sorted = [...set].sort((a, b) => a - b);
    const result = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) result.push('…');
      result.push(p);
    });
    return result;
  }, [page, totalPages]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: { xs: 0.5, sm: 1 },
      px: { xs: 1.5, sm: 2.5 }, py: 1, borderTop: `1px solid ${S.divider}`, bgcolor: S.inset, flexShrink: 0 }}>
      <Typography sx={{ fontSize: 12, color: T.textMuted }}>{start}–{end} of {totalElements}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography sx={{ fontSize: 11, color: T.textFaint }}>per page</Typography>
        <Select value={pageSize} size="small"
          onChange={e => { onPageSize(Number(e.target.value)); onPage(0); }}
          sx={{ height: 28, fontSize: 11, color: T.textPrimary,
            '.MuiOutlinedInput-notchedOutline': { borderColor: S.border }, bgcolor: S.card,
            '.MuiSvgIcon-root': { color: T.textFaint } }}>
          {[10, 25, 50].map(n => <MenuItem key={n} value={n} sx={{ fontSize: 12 }}>{n}</MenuItem>)}
        </Select>
      </Box>
      <Box sx={{ flex: 1 }} />
      {isFetching && <CircularProgress size={14} sx={{ color: T.teal }} />}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        {[
          { icon: <FirstPageIcon sx={{ fontSize: 18 }} />, disabled: page === 0,              onClick: () => onPage(0),            title: 'First' },
          { icon: <ChevronLeftIcon sx={{ fontSize: 18 }} />, disabled: page === 0,            onClick: () => onPage(page - 1),     title: 'Prev'  },
          { icon: <ChevronRightIcon sx={{ fontSize: 18 }} />, disabled: page >= totalPages-1, onClick: () => onPage(page + 1),     title: 'Next'  },
          { icon: <LastPageIcon sx={{ fontSize: 18 }} />, disabled: page >= totalPages-1,     onClick: () => onPage(totalPages-1), title: 'Last'  },
        ].map(({ icon, disabled, onClick, title }) => (
          <Tooltip key={title} title={title}>
            <span>
              <IconButton size="small" disabled={disabled} onClick={onClick}
                sx={{ color: T.textFaint, '&:not(:disabled):hover': { color: T.teal, bgcolor: T.tealBg } }}>
                {icon}
              </IconButton>
            </span>
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
}
