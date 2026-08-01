import React from 'react';
import {
  Box, Button, Chip, Divider, Drawer, MenuItem, Popover, Select,
  Switch, TextField, Typography,
} from '@mui/material';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import { levelColor, methodColor, statusColor } from './logUtils';

const STANDARD_LEVELS = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
const STATUS_CLASSES = ['2xx', '3xx', '4xx', '5xx'];

const toggle = (arr = [], v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

function Section({ title, children }) {
  const T = useT();
  return (
    <Box sx={{ py: 1.25 }}>
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.textFaint, mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function TogChip({ label, active, color, onClick }) {
  const T = useT();
  const S = adminSurface(T);
  return (
    <Chip
      label={label} size="small" onClick={onClick}
      sx={{
        fontWeight: 800, fontSize: '0.72rem', height: 27, borderRadius: 1.5,
        border: `1px solid ${active ? (color || T.teal) : S.border}`,
        bgcolor: active ? `${color || T.teal}1f` : 'transparent',
        color: active ? (color || T.teal) : T.textMuted,
        '&:hover': { bgcolor: active ? `${color || T.teal}2b` : S.inset },
      }}
    />
  );
}

function FiltersBody({ mode, facets, filters, onChange, onClearAll, supportsHistory, dates, date, onDate }) {
  const T = useT();
  const S = adminSurface(T);
  const dark = T.bg === '#000000';
  const isReq = mode === 'request';
  const isJson = mode !== 'raw';
  const today = new Date().toISOString().slice(0, 10);

  const fieldSx = {
    '& .MuiOutlinedInput-root': { bgcolor: S.inset, borderRadius: 2, fontSize: '0.82rem', color: T.text,
      '& fieldset': { borderColor: S.border }, '&:hover fieldset': { borderColor: T.borderHover }, '&.Mui-focused fieldset': { borderColor: T.teal } },
    '& .MuiSelect-select': { py: 0.85 },
  };

  const dateSection = supportsHistory ? (
    <>
      <Section title="Date">
        <Select
          fullWidth size="small" value={date || 'today'} onChange={(e) => onDate(e.target.value === 'today' ? '' : e.target.value)}
          sx={fieldSx}
          MenuProps={{ PaperProps: { sx: { bgcolor: S.card, color: T.text, border: `1px solid ${S.border}`, maxHeight: 320 } } }}
        >
          <MenuItem value="today" sx={{ fontSize: '0.82rem' }}>Today (live file)</MenuItem>
          {(dates || []).filter((d) => d !== today).map((d) => <MenuItem key={d} value={d} sx={{ fontSize: '0.82rem' }}>{d}</MenuItem>)}
        </Select>
      </Section>
      <Divider sx={{ borderColor: S.divider }} />
    </>
  ) : null;

  if (!isJson) {
    return (
      <Box sx={{ px: 2, pb: 1 }}>
        {dateSection}
        <Box sx={{ py: 1.25 }}>
          <Typography sx={{ fontSize: '0.85rem', color: T.textMuted }}>
            These are raw text logs — use the search box to filter them. Structured filters apply to Application (JSON) logs.
          </Typography>
        </Box>
      </Box>
    );
  }

  const levels = STANDARD_LEVELS.filter((l) => facets.levels.includes(l) || l === 'INFO' || l === 'ERROR');

  return (
    <Box sx={{ px: 2, pb: 1 }}>
      {dateSection}
      <Section title="Level">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {levels.map((l) => (
            <TogChip key={l} label={l} active={filters.levels.includes(l)} color={levelColor(l, dark)}
              onClick={() => onChange({ levels: toggle(filters.levels, l) })} />
          ))}
        </Box>
      </Section>

      {isReq && (
        <>
          <Divider sx={{ borderColor: S.divider }} />
          <Section title="Method">
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {(facets.methods.length ? facets.methods : ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).map((m) => (
                <TogChip key={m} label={m} active={filters.methods.includes(m)} color={methodColor(m, dark)}
                  onClick={() => onChange({ methods: toggle(filters.methods, m) })} />
              ))}
            </Box>
          </Section>

          <Divider sx={{ borderColor: S.divider }} />
          <Section title="Status">
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {STATUS_CLASSES.map((c) => (
                <TogChip key={c} label={c} active={filters.statusClasses.includes(c)} color={statusColor(c === '2xx' ? 200 : c === '3xx' ? 300 : c === '4xx' ? 400 : 500, dark)}
                  onClick={() => onChange({ statusClasses: toggle(filters.statusClasses, c) })} />
              ))}
              <TogChip label="Slow only" active={filters.slow} color={T.warning} onClick={() => onChange({ slow: !filters.slow })} />
            </Box>
          </Section>
        </>
      )}

      {facets.users.length > 0 && (
        <>
          <Divider sx={{ borderColor: S.divider }} />
          <Section title="User">
            <Select
              fullWidth size="small" displayEmpty value={filters.user} onChange={(e) => onChange({ user: e.target.value })}
              sx={fieldSx}
              MenuProps={{ PaperProps: { sx: { bgcolor: S.card, color: T.text, border: `1px solid ${S.border}`, maxHeight: 320 } } }}
            >
              <MenuItem value="" sx={{ fontSize: '0.82rem', color: T.textMuted }}>Any user</MenuItem>
              {facets.users.map((u) => <MenuItem key={u} value={u} sx={{ fontSize: '0.82rem' }}>{u}</MenuItem>)}
            </Select>
          </Section>
        </>
      )}

      <Divider sx={{ borderColor: S.divider }} />
      <Section title="Trace / Request ID">
        <Box sx={{ display: 'grid', gap: 1 }}>
          <TextField size="small" placeholder="Trace ID" value={filters.traceId} onChange={(e) => onChange({ traceId: e.target.value.trim() })} sx={fieldSx} />
          <TextField size="small" placeholder="Request ID" value={filters.requestId} onChange={(e) => onChange({ requestId: e.target.value.trim() })} sx={fieldSx} />
        </Box>
      </Section>

      <Divider sx={{ borderColor: S.divider }} />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1 }}>
        <Typography sx={{ fontSize: '0.82rem', color: T.text }}>Collapse duplicate bursts</Typography>
        <Switch checked={filters.dedupe} onChange={(e) => onChange({ dedupe: e.target.checked })} size="small"
          sx={{ '& .Mui-checked': { color: T.teal }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${T.teal} !important` } }} />
      </Box>

      <Divider sx={{ borderColor: S.divider }} />
      <Box sx={{ pt: 1.5, pb: 0.5 }}>
        <Button fullWidth onClick={onClearAll} sx={{ color: T.error, textTransform: 'none', fontWeight: 700, border: `1px solid ${S.border}`, borderRadius: 2, '&:hover': { bgcolor: T.errorBg } }}>
          Clear all filters
        </Button>
      </Box>
    </Box>
  );
}

/** Advanced filters — Popover on desktop, bottom sheet on mobile. */
export default function LogFiltersSheet({ open, anchorEl, onClose, isMobile, ...body }) {
  const T = useT();
  const S = adminSurface(T);

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom" open={open} onClose={onClose}
        PaperProps={{ sx: { bgcolor: S.card, color: T.text, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '82vh', backgroundImage: 'none' } }}
      >
        <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: S.border, mx: 'auto', mt: 1.25, mb: 0.5 }} />
        <Typography sx={{ px: 2, py: 1, fontWeight: 800, fontSize: '1rem' }}>Filters</Typography>
        <FiltersBody {...body} />
      </Drawer>
    );
  }

  return (
    <Popover
      open={open} anchorEl={anchorEl} onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      PaperProps={{ sx: { bgcolor: S.card, color: T.text, border: `1px solid ${S.border}`, borderRadius: 3, width: 320, mt: 0.5, backgroundImage: 'none' } }}
    >
      <FiltersBody {...body} />
    </Popover>
  );
}
