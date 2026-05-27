import React, { useState } from 'react';
import {
  Box, Typography, Card, IconButton,
  Tooltip, TextField, MenuItem,
} from '@mui/material';
import HttpIcon         from '@mui/icons-material/Http';
import RefreshIcon      from '@mui/icons-material/Refresh';
import MovieFilterIcon  from '@mui/icons-material/MovieFilter';
import InsightsIcon     from '@mui/icons-material/Insights';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useT }         from '@shared/theme/ThemeContext';
import { ACTIVITY_TYPES, TIME_RANGES } from './activityApi';
import OverviewFeed     from './OverviewFeed';
import CinemaFeed       from './CinemaFeed';
import ApiLogsFeed      from './ApiLogsFeed';

// ─── Section tab button ───────────────────────────────────────────────────────
function SectionTab({ id, icon, label, active, onClick }) {
  const T = useT();
  return (
    <Box
      onClick={() => onClick(id)}
      sx={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 1,
        px: { xs: 1.5, sm: 2.5 }, py: { xs: 1.5, sm: 2 },
        cursor: 'pointer', userSelect: 'none',
        color: active ? T.teal : T.textMuted,
        fontWeight: active ? 700 : 500,
        fontSize: { xs: 12, sm: 14 },
        transition: 'color .15s',
        '&:hover': { color: T.teal },
        whiteSpace: 'nowrap',
      }}
    >
      {React.cloneElement(icon, { sx: { fontSize: { xs: 16, sm: 18 } } })}
      {label}
      {active && (
        <Box
          component={motion.div}
          layoutId="activity-center-tab-underline"
          sx={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            height: 2, bgcolor: T.teal, borderRadius: 2,
          }}
        />
      )}
    </Box>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ActivityCenter() {
  const T  = useT();
  const qc = useQueryClient();

  const [section,      setSection]      = useState('overview');
  const [hours,        setHours]        = useState(24);
  const [activityType, setActivityType] = useState('');

  const handleRefresh = () => {
    if (section === 'overview') {
      qc.invalidateQueries({ queryKey: ['admin', 'analytics'] });
    } else if (section === 'cinema') {
      qc.invalidateQueries({ queryKey: ['cinema-dashboard'] });
      qc.invalidateQueries({ queryKey: ['cinema-recent'] });
      qc.invalidateQueries({ queryKey: ['cinema-users'] });
    } else {
      qc.invalidateQueries({ queryKey: ['admin', 'activity-logs'] });
    }
  };

  const SECTIONS = [
    { id: 'overview', icon: <InsightsIcon />,    label: 'Overview' },
    { id: 'cinema',   icon: <MovieFilterIcon />, label: 'Cinema Activity' },
    { id: 'api',      icon: <HttpIcon />,        label: 'API Logs' },
  ];

  return (
    <Box sx={{
      bgcolor: T.bg, minHeight: '100%',
      p: { xs: 1.5, sm: 2, md: 3 }, color: T.text,
    }}>
      {/* ── Header ── */}
      <Box sx={{
        display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' },
        mb: 2, gap: 1, flexWrap: 'wrap',
      }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{
            fontWeight: 800, fontSize: { xs: 18, md: 22 },
            color: T.text, lineHeight: 1.2,
          }}>
            Activity &amp; Insights
          </Typography>
          <Typography sx={{ fontSize: 12, color: T.textFaint, mt: 0.2 }}>
            Site-wide analytics · cinema activity · API logs — unified view
          </Typography>
        </Box>

        {section === 'cinema' && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField select size="small" value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              sx={{ minWidth: 120 }}
            >
              {TIME_RANGES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </TextField>
            <TextField select size="small" value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              sx={{ minWidth: 110 }}
            >
              {ACTIVITY_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </TextField>
          </Box>
        )}

        <Tooltip title="Refresh">
          <IconButton
            size="small" onClick={handleRefresh}
            sx={{
              color: T.textFaint, border: `1px solid ${T.border}`,
              '&:hover': { color: T.teal, borderColor: T.teal },
            }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Section card ── */}
      <Card elevation={0} sx={{
        border: `1px solid ${T.border}`, borderRadius: 2,
        bgcolor: T.glass, overflow: 'hidden',
      }}>
        {/* Section tabs */}
        <Box sx={{
          display: 'flex', borderBottom: `1px solid ${T.border}`,
          overflowX: 'auto', px: { xs: 0.5, sm: 1 },
          '&::-webkit-scrollbar': { display: 'none' },
        }}>
          {SECTIONS.map((s) => (
            <SectionTab
              key={s.id}
              id={s.id}
              icon={s.icon}
              label={s.label}
              active={section === s.id}
              onClick={setSection}
            />
          ))}
        </Box>

        {/* Section content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {section === 'overview' && <OverviewFeed onJumpToSection={setSection} />}
            {section === 'cinema'   && (
              <CinemaFeed
                hours={hours}
                activityType={activityType}
                onHoursChange={setHours}
                onTypeChange={setActivityType}
              />
            )}
            {section === 'api' && <ApiLogsFeed />}
          </motion.div>
        </AnimatePresence>
      </Card>
    </Box>
  );
}
