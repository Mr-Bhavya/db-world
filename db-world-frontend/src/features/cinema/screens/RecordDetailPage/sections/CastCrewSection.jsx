import React from 'react';
import { Avatar, Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme/ThemeContext';
import { tmdbImg } from '../../../api/cinemaApi';
import SectionHeading from '../shared/SectionHeading';

export default function CastCrewSection({ record }) {
  const T = useT();
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
              return (
                <Box
                  key={c.creditId ?? i}
                  component={motion.div}
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.15 }}
                  sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 92, gap: 0.75, cursor: 'default' }}
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
                        '&:hover': { borderColor: alpha(T.teal, 0.6), boxShadow: `0 0 0 4px ${alpha(T.teal, 0.15)}` },
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

      {Object.keys(crewByDept).length > 0 && (
        <>
          <SectionHeading>Crew</SectionHeading>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
            {Object.entries(crewByDept).map(([dept, members]) => (
              <Box key={dept}>
                <Typography variant="caption" sx={{ color: T.teal, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, display: 'block', mb: 1 }}>
                  {dept}
                </Typography>
                {members.map((m, i) => (
                  <Box key={m.creditId ?? i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: `1px solid ${alpha(T.text, 0.05)}` }}>
                    <Typography variant="body2" sx={{ color: T.textMuted }}>{m.person?.name}</Typography>
                    <Typography variant="body2" sx={{ color: T.textFaint, fontSize: '0.8rem' }}>{m.job}</Typography>
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        </>
      )}

      {cast.length === 0 && Object.keys(crewByDept).length === 0 && (
        <Typography variant="body2" sx={{ color: T.textFaint }}>No cast or crew information available.</Typography>
      )}
    </Box>
  );
}
