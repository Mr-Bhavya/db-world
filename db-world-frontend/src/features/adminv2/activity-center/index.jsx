import React, { useState } from 'react';
import {
  Box, Typography, Card, IconButton,
  Tooltip, TextField, MenuItem,
} from '@mui/material';
import HttpIcon        from '@mui/icons-material/Http';
import RefreshIcon     from '@mui/icons-material/Refresh';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import { useQueryClient } from '@tanstack/react-query';
import { useT }        from '@shared/theme/ThemeContext';
import { ACTIVITY_TYPES, TIME_RANGES } from './activityApi';
import CinemaFeed  from './CinemaFeed';
import ApiLogsFeed from './ApiLogsFeed';

// ─── Section tab button ───────────────────────────────────────────────────────
function SectionTab({ id, icon, label, active, onClick }) {
  const T = useT();
  return (
    <Box
      onClick={() => onClick(id)}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: { xs: 1.5, sm: 2.5 }, py: { xs: 1.5, sm: 2 },
        cursor: 'pointer', userSelect: 'none',
        borderBottom: active ? '2px solid #0d9488' : '2px solid transparent',
        color: active ? '#0d9488' : T.textMuted,
        fontWeight: active ? 700 : 500,
        fontSize: { xs: 12, sm: 14 },
        transition: 'all .15s',
        '&:hover': { color: '#0d9488' },
        whiteSpace: 'nowrap',
      }}
    >
      {React.cloneElement(icon, { sx: { fontSize: { xs: 16, sm: 18 } } })}
      {label}
    </Box>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ActivityCenter() {
  const T   = useT();
  const qc  = useQueryClient();

  const [section,      setSection]      = useState('cinema');
  const [hours,        setHours]        = useState(24);
  const [activityType, setActivityType] = useState('');

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['cinema-dashboard'] });
    qc.invalidateQueries({ queryKey: ['cinema-recent'] });
    qc.invalidateQueries({ queryKey: ['cinema-users'] });
  };

  return (
    <Box sx={{ bgcolor: T.bg, minHeight: '100%', p: { xs: 1.5, sm: 2, md: 3 }, color: T.text }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 18, md: 22 }, color: T.text, lineHeight: 1.2 }}>
            Activity Center
          </Typography>
          <Typography sx={{ fontSize: 12, color: T.textFaint, mt: 0.2 }}>
            Cinema · API logs · parallel connections merged
          </Typography>
        </Box>
        {section === 'cinema' && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField select size="small" value={hours} onChange={e => setHours(Number(e.target.value))} sx={{ minWidth: 120 }}>
              {TIME_RANGES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <TextField select size="small" value={activityType} onChange={e => setActivityType(e.target.value)} sx={{ minWidth: 110 }}>
              {ACTIVITY_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
          </Box>
        )}
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={handleRefresh}
            sx={{ color: T.textFaint, border: `1px solid ${T.border}`, '&:hover': { color: '#0d9488' } }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Section card ── */}
      <Card elevation={0} sx={{ border: `1px solid ${T.border}`, borderRadius: 2, bgcolor: T.glass, overflow: 'hidden' }}>

        {/* Section tabs */}
        <Box sx={{
          display: 'flex', borderBottom: `1px solid ${T.border}`,
          overflowX: 'auto', px: { xs: 0.5, sm: 1 },
          '&::-webkit-scrollbar': { display: 'none' },
        }}>
          <SectionTab
            id="cinema"
            icon={<MovieFilterIcon />}
            label="Cinema Activity"
            active={section === 'cinema'}
            onClick={setSection}
          />
          <SectionTab
            id="api"
            icon={<HttpIcon />}
            label="API Logs"
            active={section === 'api'}
            onClick={setSection}
          />
        </Box>

        {/* Section content */}
        {section === 'cinema' && (
          <CinemaFeed
            hours={hours}
            activityType={activityType}
            onHoursChange={setHours}
            onTypeChange={setActivityType}
          />
        )}
        {section === 'api' && <ApiLogsFeed />}
      </Card>
    </Box>
  );
}
