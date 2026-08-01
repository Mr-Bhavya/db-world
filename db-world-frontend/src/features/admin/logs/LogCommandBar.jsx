import React, { useEffect, useRef, useState } from 'react';
import {
  Box, Button, Chip, CircularProgress, InputAdornment, MenuItem,
  Select, TextField, Tooltip, IconButton, Badge,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import SwapVertRoundedIcon from '@mui/icons-material/SwapVertRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';

const liveTone = (status, T) => {
  switch (status) {
    case 'live': return T.success;
    case 'connecting':
    case 'reconnecting': return T.warning;
    case 'error': return T.error;
    default: return T.textFaint;
  }
};

/**
 * The always-visible command bar (source · subtype · search · order · filters ·
 * live). Rendered at the top of the page shell so it never scrolls away.
 */
export default function LogCommandBar({
  sources, source, onSource,
  subTypes, subType, onSubType,
  supportsJson, format, onFormat,
  live, liveStatus, onToggleLive,
  order, onOrder,
  search, onSearch,
  onOpenFilters, activeFilterCount,
  summary,
}) {
  const T = useT();
  const S = adminSurface(T);

  // Local, debounced search so typing stays snappy.
  const [text, setText] = useState(search);
  const firstRef = useRef(true);
  useEffect(() => { setText(search); }, [search]);
  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; return undefined; }
    const t = setTimeout(() => onSearch(text), 250);
    return () => clearTimeout(t);
  }, [text, onSearch]);

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: S.inset, borderRadius: 2, fontSize: '0.82rem', color: T.text,
      '& fieldset': { borderColor: S.border },
      '&:hover fieldset': { borderColor: T.borderHover },
      '&.Mui-focused fieldset': { borderColor: T.teal },
    },
    '& .MuiSelect-select': { py: 0.85 },
    '& .MuiSvgIcon-root': { color: T.textMuted },
  };

  return (
    <Box sx={{
      flexShrink: 0, bgcolor: S.card, border: `1px solid ${S.border}`,
      borderRadius: 3, p: { xs: 1, sm: 1.25 }, display: 'flex', flexDirection: 'column', gap: 1,
    }}>
      {/* Row 1 — source + subtypes + live */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Select
          value={source} onChange={(e) => onSource(e.target.value)} size="small"
          sx={{ ...fieldSx, minWidth: 118, flexShrink: 0, '& .MuiOutlinedInput-notchedOutline': { borderColor: S.border } }}
          MenuProps={{ PaperProps: { sx: { bgcolor: S.card, color: T.text, border: `1px solid ${S.border}` } } }}
        >
          {sources.map((s) => <MenuItem key={s.id} value={s.id} sx={{ fontSize: '0.85rem' }}>{s.label}</MenuItem>)}
        </Select>

        <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', flex: 1, minWidth: 0, py: 0.25,
          '&::-webkit-scrollbar': { height: 0 } }}>
          {subTypes.map((st) => {
            const active = st.id === subType;
            return (
              <Chip
                key={st.id} label={st.label} size="small" onClick={() => onSubType(st.id)}
                sx={{
                  flexShrink: 0, fontWeight: 700, fontSize: '0.74rem', height: 28, borderRadius: 1.5,
                  border: `1px solid ${active ? 'transparent' : S.border}`,
                  bgcolor: active ? T.tealBg : 'transparent',
                  color: active ? T.teal : T.textMuted,
                  '&:hover': { bgcolor: active ? T.tealBgHover : S.inset },
                }}
              />
            );
          })}
        </Box>

        <Button
          onClick={onToggleLive}
          startIcon={
            liveStatus === 'connecting' || liveStatus === 'reconnecting'
              ? <CircularProgress size={13} sx={{ color: 'inherit' }} />
              : live ? <StopRoundedIcon /> : <PlayArrowRoundedIcon />
          }
          sx={{
            flexShrink: 0, minHeight: 34, px: 1.5, borderRadius: 2, textTransform: 'none', fontWeight: 800,
            fontSize: '0.78rem', color: live ? '#fff' : T.text,
            bgcolor: live ? liveTone(liveStatus, T) : 'transparent',
            border: `1px solid ${live ? 'transparent' : S.border}`,
            '&:hover': { bgcolor: live ? liveTone(liveStatus, T) : S.inset },
          }}
        >
          {live ? (liveStatus === 'reconnecting' ? 'Reconnecting' : liveStatus === 'connecting' ? 'Connecting' : 'Live') : 'Live'}
        </Button>
      </Box>

      {/* Row 2 — search + controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <TextField
          value={text} onChange={(e) => setText(e.target.value)} size="small" placeholder="Search message, URI, trace…"
          sx={{ ...fieldSx, flex: '1 1 200px', minWidth: 150 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ fontSize: 18 }} /></InputAdornment>,
            endAdornment: text ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setText('')} aria-label="Clear search"><ClearRoundedIcon sx={{ fontSize: 16 }} /></IconButton>
              </InputAdornment>
            ) : null,
          }}
        />

        {supportsJson && (
          <Box sx={{ display: 'flex', flexShrink: 0, border: `1px solid ${S.border}`, borderRadius: 2, overflow: 'hidden' }}>
            {['JSON', 'RAW'].map((f) => (
              <Box
                key={f} component="button" type="button" onClick={() => onFormat(f)}
                sx={{
                  appearance: 'none', cursor: 'pointer', px: 1.25, py: 0.7, fontSize: '0.74rem', fontWeight: 800,
                  border: 'none', bgcolor: format === f ? T.tealBg : 'transparent', color: format === f ? T.teal : T.textMuted,
                }}
              >{f}</Box>
            ))}
          </Box>
        )}

        <Tooltip title={order === 'desc' ? 'Newest first' : 'Oldest first'}>
          <Button
            onClick={() => onOrder(order === 'desc' ? 'asc' : 'desc')} startIcon={<SwapVertRoundedIcon />}
            sx={{ flexShrink: 0, minHeight: 34, px: 1.25, borderRadius: 2, textTransform: 'none', fontWeight: 700,
              fontSize: '0.76rem', color: T.textMuted, border: `1px solid ${S.border}`, '&:hover': { bgcolor: S.inset } }}
          >
            {order === 'desc' ? 'Newest' : 'Oldest'}
          </Button>
        </Tooltip>

        <Badge badgeContent={activeFilterCount} color="primary" overlap="circular"
          sx={{ '& .MuiBadge-badge': { bgcolor: T.teal, color: '#fff', fontWeight: 800 } }}>
          <Button
            onClick={onOpenFilters} startIcon={<TuneRoundedIcon />}
            sx={{ flexShrink: 0, minHeight: 34, px: 1.25, borderRadius: 2, textTransform: 'none', fontWeight: 700,
              fontSize: '0.76rem', color: activeFilterCount ? T.teal : T.textMuted,
              border: `1px solid ${activeFilterCount ? T.teal : S.border}`, '&:hover': { bgcolor: S.inset } }}
          >
            Filters
          </Button>
        </Badge>

        {summary && (
          <Box sx={{ ml: 'auto', display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1, fontSize: '0.74rem', color: T.textFaint, whiteSpace: 'nowrap' }}>
            <span>{summary.shown} shown</span>
            {summary.errors > 0 && <span style={{ color: T.error }}>· {summary.errors} err</span>}
            {summary.slow > 0 && <span style={{ color: T.warning }}>· {summary.slow} slow</span>}
          </Box>
        )}
      </Box>
    </Box>
  );
}
