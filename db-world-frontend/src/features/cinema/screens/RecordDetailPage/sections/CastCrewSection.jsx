import React, { useState } from 'react';
import { Avatar, Box, Button, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme/ThemeContext';
import { tmdbImg } from '../../../api/cinemaApi';
import SectionHeading from '../shared/SectionHeading';
import SectionCard from '../shared/SectionCard';

const CREW_VISIBLE_DEFAULT = 8;

/* A blockbuster credits 15+ departments and several hundred people. Showing
   every department card at once buries the ones anyone actually looks for
   (Directing, Writing, Production), so the tail collapses behind a toggle. */
const DEPTS_VISIBLE_DEFAULT = 6;

/* Cast rails run long too — a Marvel film lists 100+ speaking parts. */
const CAST_VISIBLE_DEFAULT = 20;

// ─── Per-department card (with show more / show less) ────────────────────────
function CrewDept({ dept, members, onPersonClick }) {
  const T = useT();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? members : members.slice(0, CREW_VISIBLE_DEFAULT);
  const overflow = members.length - CREW_VISIBLE_DEFAULT;

  return (
    <SectionCard sx={{ alignSelf: 'start', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
        <Typography sx={{
          color: T.teal, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 800,
          fontSize: { xs: '0.68rem', xl: '0.76rem' },
        }}>
          {dept}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{
          color: T.textFaint, fontVariantNumeric: 'tabular-nums',
          fontSize: { xs: '0.68rem', xl: '0.76rem' },
        }}>
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
            <Typography sx={{
              color: T.text, fontWeight: 600,
              fontSize: { xs: '0.82rem', xl: '0.9rem' },
            }}>
              {m.person?.name}
            </Typography>
            <Typography sx={{
              color: T.textFaint, textAlign: 'right', flexShrink: 0, maxWidth: '55%',
              fontSize: { xs: '0.75rem', xl: '0.82rem' },
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
          sx={{ mt: 1, alignSelf: 'flex-start', color: T.teal, textTransform: 'none', fontWeight: 700, fontSize: '0.78rem', p: 0, minWidth: 0 }}
        >
          {expanded ? 'Show less' : `Show ${overflow} more`}
        </Button>
      )}
    </SectionCard>
  );
}

// ─── CastCrewSection ─────────────────────────────────────────────────────────
/* Departments people look for first, regardless of how many names each holds.
   Sorting purely by size buries Directing (2 people) under Art (60). */
const DEPT_PRIORITY = ['Directing', 'Writing', 'Production', 'Camera', 'Editing', 'Sound', 'Art'];

export default function CastCrewSection({ record, onPersonClick }) {
  const T = useT();
  const [allCast, setAllCast] = useState(false);
  const [allDepts, setAllDepts] = useState(false);
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

  const sortedDepts = Object.entries(crewByDept).sort((a, b) => {
    const ai = DEPT_PRIORITY.indexOf(a[0]);
    const bi = DEPT_PRIORITY.indexOf(b[0]);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return b[1].length - a[1].length;
  });

  const visibleCast  = allCast ? cast : cast.slice(0, CAST_VISIBLE_DEFAULT);
  const visibleDepts = allDepts ? sortedDepts : sortedDepts.slice(0, DEPTS_VISIBLE_DEFAULT);
  const hiddenDepts  = sortedDepts.length - visibleDepts.length;

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
          <SectionHeading action={cast.length > CAST_VISIBLE_DEFAULT ? `${visibleCast.length} of ${cast.length}` : null}>
            Cast
          </SectionHeading>
          <Box sx={{
            display: 'flex', gap: 2, overflowX: 'auto', pb: 1.5, mb: 4,
            scrollbarWidth: 'thin', scrollbarColor: `${alpha(T.text, 0.2)} transparent`,
            '&::-webkit-scrollbar': { height: 5 },
            '&::-webkit-scrollbar-thumb': { background: alpha(T.text, 0.2), borderRadius: 3 },
          }}>
            {visibleCast.map((c, i) => {
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
                  onClick={clickable ? () => onPersonClick?.(personId) : undefined}
                  sx={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    flexShrink: 0, gap: 0.75,
                    width: { xs: 92, xl: 112 },
                    '@media (min-width:1920px)': { width: 136 },
                    cursor: clickable ? 'pointer' : 'default',
                  }}
                >
                  <Box sx={{ position: 'relative' }}>
                    <Avatar
                      src={imgUrl ?? undefined}
                      alt={c.person?.name}
                      // Twenty cast portraits and eight crew ones, all decoded on the main
                      // thread at mount by default. Neither list is above the fold.
                      slotProps={{ img: { loading: 'lazy', decoding: 'async' } }}
                      sx={{
                        width: { xs: 76, xl: 96 }, height: { xs: 76, xl: 96 },
                        '@media (min-width:1920px)': { width: 120, height: 120 },
                        bgcolor: alpha(T.teal, 0.3), fontSize: '1rem', fontWeight: 700,
                        border: `2px solid ${alpha(T.text, 0.1)}`,
                        transition: 'border-color .15s, box-shadow .15s',
                        '&:hover': clickable ? { borderColor: alpha(T.teal, 0.6), boxShadow: `0 0 0 4px ${alpha(T.teal, 0.15)}` } : undefined,
                      }}
                    >
                      {!imgUrl && initials}
                    </Avatar>
                  </Box>
                  <Typography sx={{
                    color: T.text, fontWeight: 700, textAlign: 'center', lineHeight: 1.3,
                    fontSize: { xs: '0.75rem', xl: '0.85rem' },
                    '@media (min-width:1920px)': { fontSize: '1rem' },
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {c.person?.name}
                  </Typography>
                  <Typography sx={{
                    color: T.textFaint, textAlign: 'center', lineHeight: 1.25,
                    fontSize: { xs: '0.68rem', xl: '0.76rem' },
                    '@media (min-width:1920px)': { fontSize: '0.9rem' },
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {c.character}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {cast.length > CAST_VISIBLE_DEFAULT && (
            <Button
              size="small"
              onClick={() => setAllCast((v) => !v)}
              sx={{ mb: 3, mt: -1.5, color: T.teal, textTransform: 'none', fontWeight: 700, fontSize: '0.82rem', p: 0, minWidth: 0 }}
            >
              {allCast ? 'Show fewer' : `Show all ${cast.length} cast`}
            </Button>
          )}
        </>
      )}

      {sortedDepts.length > 0 && (
        <>
          <SectionHeading action={hiddenDepts > 0 ? `${visibleDepts.length} of ${sortedDepts.length} depts` : null}>
            Crew
          </SectionHeading>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(auto-fill, minmax(280px, 1fr))',
              xl: 'repeat(auto-fill, minmax(330px, 1fr))',
            },
            gap: { xs: 1.5, sm: 2, xl: 2.5 },
            alignItems: 'start',
          }}>
            {visibleDepts.map(([dept, members]) => (
              <CrewDept key={dept} dept={dept} members={members} onPersonClick={onPersonClick} />
            ))}
          </Box>

          {(hiddenDepts > 0 || allDepts) && (
            <Button
              size="small"
              onClick={() => setAllDepts((v) => !v)}
              sx={{ mt: 2, color: T.teal, textTransform: 'none', fontWeight: 700, fontSize: '0.82rem', p: 0, minWidth: 0 }}
            >
              {allDepts ? 'Show fewer departments' : `Show ${hiddenDepts} more department${hiddenDepts === 1 ? '' : 's'}`}
            </Button>
          )}
        </>
      )}

      {cast.length === 0 && sortedDepts.length === 0 && (
        <Typography variant="body2" sx={{ color: T.textFaint }}>No cast or crew information available.</Typography>
      )}
    </Box>
  );
}
