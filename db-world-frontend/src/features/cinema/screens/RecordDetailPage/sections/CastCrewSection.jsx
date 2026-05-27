import React, { useState } from 'react';
import { Avatar, Box, Button, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme/ThemeContext';
import { tmdbImg } from '../../../api/cinemaApi';
import SectionHeading from '../shared/SectionHeading';
import PersonDetailModal from '../PersonDetailModal';

const CREW_VISIBLE_DEFAULT = 8;

// ─── Per-department card (with show more / show less) ────────────────────────
function CrewDept({ dept, members, onPersonClick }) {
  const T = useT();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? members : members.slice(0, CREW_VISIBLE_DEFAULT);
  const overflow = members.length - CREW_VISIBLE_DEFAULT;

  return (
    <Box
      sx={{
        alignSelf: 'start',
        bgcolor: T.glass,
        border: `1px solid ${alpha(T.text, 0.06)}`,
        borderRadius: 1.5,
        p: { xs: 1.5, sm: 2 },
        display: 'flex', flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
        <Typography variant="caption" sx={{ color: T.teal, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
          {dept}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" sx={{ color: T.textFaint, fontVariantNumeric: 'tabular-nums' }}>
          {members.length}
        </Typography>
      </Box>

      {visible.map((m, i) => {
        const personId = m.person?.id;
        const clickable = Boolean(personId);
        return (
          <Box
            key={m.creditId ?? i}
            onClick={clickable ? () => onPersonClick(personId) : undefined}
            sx={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              gap: 1.5, py: 0.55,
              borderBottom: `1px solid ${alpha(T.text, 0.05)}`,
              '&:last-of-type': { borderBottom: 'none' },
              cursor: clickable ? 'pointer' : 'default',
              transition: 'background-color .12s',
              borderRadius: 0.75,
              mx: -0.5, px: 0.5,
              '&:hover': clickable ? { bgcolor: alpha(T.teal, 0.08) } : undefined,
            }}
          >
            <Typography variant="body2" sx={{ color: T.textMuted, fontSize: '0.85rem' }}>
              {m.person?.name}
            </Typography>
            <Typography variant="body2" sx={{
              color: T.textFaint, fontSize: '0.78rem', textAlign: 'right',
              flexShrink: 0, maxWidth: '55%',
            }}>
              {m.job}
            </Typography>
          </Box>
        );
      })}

      {overflow > 0 && (
        <Button
          size="small"
          onClick={() => setExpanded((v) => !v)}
          sx={{ mt: 1, alignSelf: 'flex-start', color: T.teal, textTransform: 'none', fontSize: '0.78rem', p: 0, minWidth: 0 }}
        >
          {expanded ? 'Show less' : `Show ${overflow} more`}
        </Button>
      )}
    </Box>
  );
}

// ─── CastCrewSection ─────────────────────────────────────────────────────────
export default function CastCrewSection({ record }) {
  const T = useT();
  const [openPersonId, setOpenPersonId] = useState(null);
  const tmdb = record?.tmdb ?? {};
  const credits = tmdb.credits ?? [];

  const cast = [...(Array.isArray(credits) ? credits.filter((c) => c.creditType === 'CAST') : [])]
    .sort((a, b) => (a.castOrder ?? 999) - (b.castOrder ?? 999));

  const crew = Array.isArray(credits) ? credits.filter((c) => c.creditType === 'CREW') : [];
  const crewByDept = crew.reduce((acc, c) => {
    const dept = c.department ?? 'Other';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(c);
    return acc;
  }, {});

  const sortedDepts = Object.entries(crewByDept)
    .sort((a, b) => b[1].length - a[1].length);

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.4 }}
      sx={{ py: 3 }}
    >
      {cast.length > 0 && (
        <>
          <SectionHeading>Cast</SectionHeading>
          <Box sx={{
            display: 'flex', gap: 2, overflowX: 'auto', pb: 1.5, mb: 4,
            scrollbarWidth: 'thin', scrollbarColor: `${alpha(T.text, 0.2)} transparent`,
            '&::-webkit-scrollbar': { height: 5 },
            '&::-webkit-scrollbar-thumb': { background: alpha(T.text, 0.2), borderRadius: 3 },
          }}>
            {cast.map((c, i) => {
              const imgUrl = tmdbImg(c.person?.profilePath, 'w185');
              const initials = (c.person?.name ?? '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
              const personId = c.person?.id;
              const clickable = Boolean(personId);
              return (
                <Box
                  key={c.creditId ?? i}
                  component={motion.div}
                  whileHover={clickable ? { y: -3 } : undefined}
                  transition={{ duration: 0.15 }}
                  onClick={clickable ? () => setOpenPersonId(personId) : undefined}
                  sx={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    flexShrink: 0, width: 92, gap: 0.75,
                    cursor: clickable ? 'pointer' : 'default',
                  }}
                >
                  <Box sx={{ position: 'relative' }}>
                    <Avatar
                      src={imgUrl ?? undefined}
                      alt={c.person?.name}
                      sx={{
                        width: 76, height: 76,
                        bgcolor: alpha(T.teal, 0.3), fontSize: '1rem', fontWeight: 700,
                        border: `2px solid ${alpha(T.text, 0.1)}`,
                        transition: 'border-color .15s, box-shadow .15s',
                        '&:hover': clickable ? { borderColor: alpha(T.teal, 0.6), boxShadow: `0 0 0 4px ${alpha(T.teal, 0.15)}` } : undefined,
                      }}
                    >
                      {!imgUrl && initials}
                    </Avatar>
                  </Box>
                  <Typography variant="caption" sx={{ color: T.text, fontWeight: 600, textAlign: 'center', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {c.person?.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: T.textFaint, textAlign: 'center', lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: '0.68rem' }}>
                    {c.character}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </>
      )}

      {sortedDepts.length > 0 && (
        <>
          <SectionHeading>Crew</SectionHeading>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(280px, 1fr))' },
            gap: { xs: 1.5, sm: 2 },
            alignItems: 'start',
          }}>
            {sortedDepts.map(([dept, members]) => (
              <CrewDept key={dept} dept={dept} members={members} onPersonClick={setOpenPersonId} />
            ))}
          </Box>
        </>
      )}

      {cast.length === 0 && sortedDepts.length === 0 && (
        <Typography variant="body2" sx={{ color: T.textFaint }}>No cast or crew information available.</Typography>
      )}

      <PersonDetailModal personId={openPersonId} onClose={() => setOpenPersonId(null)} />
    </Box>
  );
}
