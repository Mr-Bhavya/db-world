import React, { useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary,
  Box, Chip, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import StarIcon from '@mui/icons-material/Star';
import { useT } from '@shared/theme/ThemeContext';
import { tmdbImg } from '../../../api/cinemaApi';
import SectionHeading from '../shared/SectionHeading';
import { formatDate, formatRuntime } from '../helpers';

export default function SeasonsSection({ record }) {
  const T = useT();
  const tmdb = record?.tmdb ?? {};
  const seasons = tmdb.seasons ?? [];
  const [openSeason, setOpenSeason] = useState(null);

  if (seasons.length === 0) {
    return (
      <Box sx={{ py: 3 }}>
        <Typography variant="body2" sx={{ color: T.textFaint }}>No season information available.</Typography>
      </Box>
    );
  }

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.4 }}
      sx={{ py: 3 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <SectionHeading sx={{ mb: 0 }}>{seasons.length} Seasons</SectionHeading>
        {tmdb.firstAirDate && (
          <Typography variant="body2" sx={{ color: T.textFaint }}>
            {tmdb.firstAirDate?.slice(0, 4)}
            {tmdb.lastAirDate && tmdb.lastAirDate.slice(0, 4) !== tmdb.firstAirDate.slice(0, 4)
              ? `–${tmdb.lastAirDate.slice(0, 4)}`
              : ''}
          </Typography>
        )}
      </Box>

      {seasons.map((season, si) => {
        const isOpen = openSeason === si;
        const posterUrl = tmdbImg(season.posterPath, 'w185');
        return (
          <Accordion
            key={si}
            expanded={isOpen}
            onChange={() => setOpenSeason(isOpen ? null : si)}
            disableGutters
            elevation={0}
            sx={{
              bgcolor: T.glass,
              border: `1px solid ${isOpen ? alpha(T.teal, 0.35) : alpha(T.text, 0.07)}`,
              borderRadius: '10px !important',
              mb: 1.5,
              '&:before': { display: 'none' },
              transition: 'border-color 0.2s',
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ color: T.textFaint }} />}
              sx={{ px: 2, py: 0.5, '& .MuiAccordionSummary-content': { my: 1 } }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, flexWrap: 'wrap', minWidth: 0 }}>
                {posterUrl && (
                  <Box component="img" src={posterUrl} alt={season.name}
                    sx={{ width: 48, height: 72, objectFit: 'cover', borderRadius: 1, flexShrink: 0, display: { xs: 'none', sm: 'block' } }}
                  />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body1" sx={{ color: T.text, fontWeight: 700 }}>
                    Season {season.seasonNumber}
                    {season.name && season.name !== `Season ${season.seasonNumber}` && (
                      <Typography component="span" variant="body2" sx={{ color: T.textMuted, ml: 1, fontWeight: 400 }}>— {season.name}</Typography>
                    )}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: 0.25, flexWrap: 'wrap' }}>
                    {season.episodeCount != null && (
                      <Chip label={`${season.episodeCount} eps`} size="small" sx={{ bgcolor: alpha(T.text, 0.08), color: T.textFaint, fontSize: '0.65rem', height: 18 }} />
                    )}
                    {season.airDate && (
                      <Typography variant="caption" sx={{ color: T.textFaint }}>{formatDate(season.airDate)}</Typography>
                    )}
                    {season.voteAverage != null && season.voteAverage > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                        <StarIcon sx={{ fontSize: 12, color: '#ff9800' }} />
                        <Typography variant="caption" sx={{ color: T.textFaint }}>{Math.round(season.voteAverage * 10) / 10}</Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
              {season.overview && (
                <Typography variant="body2" sx={{ color: T.textMuted, mb: 2, lineHeight: 1.7 }}>{season.overview}</Typography>
              )}
              {(season.episodes ?? []).length > 0 ? (
                <Box>
                  {season.episodes.map((ep, ei) => (
                    <Box
                      key={ei}
                      sx={{
                        display: 'flex', gap: 2, py: 1,
                        borderBottom: `1px solid ${alpha(T.text, 0.05)}`,
                        '&:last-child': { borderBottom: 'none' },
                        flexWrap: { xs: 'wrap', sm: 'nowrap' },
                        alignItems: 'flex-start',
                      }}
                    >
                      {ep.stillPath && (
                        <Box
                          component="img"
                          src={tmdbImg(ep.stillPath, 'w185')}
                          alt={ep.name}
                          loading="lazy"
                          sx={{ width: 90, height: 52, objectFit: 'cover', borderRadius: 1, flexShrink: 0, display: { xs: 'none', sm: 'block' } }}
                        />
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                          <Typography variant="body2" sx={{ color: T.teal, fontWeight: 700, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            E{String(ep.episodeNumber).padStart(2, '0')}
                          </Typography>
                          <Typography variant="body2" sx={{ color: T.text, fontWeight: 500 }}>{ep.name}</Typography>
                        </Box>
                        {ep.overview && (
                          <Typography variant="caption" sx={{ color: T.textFaint, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {ep.overview}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexShrink: 0 }}>
                        {ep.airDate && <Typography variant="caption" sx={{ color: T.textFaint }}>{formatDate(ep.airDate)}</Typography>}
                        {ep.runtime != null && <Typography variant="caption" sx={{ color: T.textFaint }}>{formatRuntime(ep.runtime)}</Typography>}
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: T.textFaint }}>No episode data available.</Typography>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}
