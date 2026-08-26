import React, { useMemo, useState } from 'react';
import { Box, Button, Chip, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useT } from '@shared/theme/ThemeContext';
import Constants from '@shared/constants';
import { tmdbImg } from '../../../api/cinemaApi';
import SectionHeading from '../shared/SectionHeading';
import SectionCard from '../shared/SectionCard';
import StatRow from '../shared/StatRow';
import RatingRing from '../shared/RatingRing';
import { detectUserRegion, pickProviderRegion, providersForRegion } from '../../../utils/providers';
import { formatCurrency, formatDate, formatRuntime } from '../helpers';

export default function OverviewSection({ record }) {
  const T = useT();
  const navigate = useNavigate();
  const [overviewOpen, setOverviewOpen] = useState(false);
  const tmdb = record?.tmdb ?? {};
  const isMovie = record?.type === 'MOVIE';
  const providers = tmdb.providers ?? [];

  // Region choice lives in utils/providers so the hero's "Streaming on" strip and this
  // panel can never disagree about which country the viewer is being shown. Locked to
  // that one region — there is no all-country selector.
  const userRegion = useMemo(detectUserRegion, []);
  const selectedRegion = useMemo(() => pickProviderRegion(providers, userRegion), [providers, userRegion]);
  const regionalProviders = useMemo(
    () => providersForRegion(providers, selectedRegion),
    [providers, selectedRegion],
  );

  const grouped = regionalProviders.reduce((acc, p) => {
    const type = p.providerType ?? 'OTHER';
    if (!acc[type]) acc[type] = [];
    acc[type].push(p);
    return acc;
  }, {});
  Object.values(grouped).forEach((arr) =>
    arr.sort((a, b) => (a.provider?.displayPriority ?? 99) - (b.provider?.displayPriority ?? 99))
  );
  const providerOrder = ['FLATRATE', 'NETWORK', 'RENT', 'BUY'];
  const typeLabel = { FLATRATE: 'Streaming', RENT: 'Rent', BUY: 'Buy', NETWORK: 'Network' };
  const sortedProviderKeys = [
    ...providerOrder.filter((k) => grouped[k]),
    ...Object.keys(grouped).filter((k) => !providerOrder.includes(k)),
  ];

  // Matches the surface RecordDetailContent paints behind this section, so the
  // collapse gradient fades into the page rather than a visible band.
  const surface = T.bg === '#000000' ? '#141414' : T.bg;
  const canCollapse = (tmdb.overview?.length ?? 0) > 320;

  const chipSx = {
    bgcolor: alpha(T.teal, 0.12), color: T.teal,
    fontSize: { xs: '0.7rem', xl: '0.78rem' },
    height: { xs: 24, xl: 28 },
    border: `1px solid ${alpha(T.teal, 0.2)}`,
  };
  const subChipSx = {
    bgcolor: alpha(T.text, 0.06), color: T.textMuted,
    fontSize: { xs: '0.7rem', xl: '0.78rem' },
    height: { xs: 24, xl: 28 },
    border: `1px solid ${alpha(T.text, 0.08)}`,
  };

  /** Small uppercase rubric above a chip group. */
  const groupLabel = (text) => (
    <Typography sx={{
      color: T.textFaint, textTransform: 'uppercase', letterSpacing: 1,
      fontWeight: 700, fontSize: { xs: '0.62rem', xl: '0.7rem' },
      display: 'block', mb: 1,
    }}>
      {text}
    </Typography>
  );

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.4 }}
      sx={{ py: 3 }}
    >

      {tmdb.overview && (
        <Box sx={{ mb: 4, maxWidth: { xs: '100%', md: 760, xl: 900 } }}>
          {/* Collapsed with a fade rather than an ellipsis, so the cut lands on a
              soft edge instead of a hard truncation mid-word. */}
          <Box sx={{
            position: 'relative',
            maxHeight: canCollapse && !overviewOpen ? 138 : 1600,
            overflow: 'hidden',
            transition: 'max-height 0.42s cubic-bezier(0.22, 1, 0.36, 1)',
          }}>
            <Typography variant="body1" sx={{
              color: T.textMuted, lineHeight: 1.85,
              fontSize: { xs: '0.95rem', md: '1rem' },
            }}>
              {tmdb.overview}
            </Typography>

            {canCollapse && !overviewOpen && (
              <Box sx={{
                position: 'absolute', left: 0, right: 0, bottom: 0, height: 56,
                pointerEvents: 'none',
                background: `linear-gradient(to top, ${surface} 0%, ${alpha(surface, 0)} 100%)`,
              }} />
            )}
          </Box>

          {canCollapse && (
            <Button
              size="small"
              onClick={() => setOverviewOpen((v) => !v)}
              sx={{
                mt: 0.75, p: 0, minWidth: 0, color: T.teal,
                textTransform: 'none', fontWeight: 700, fontSize: '0.82rem',
              }}
            >
              {overviewOpen ? 'Show less' : 'Show more'}
            </Button>
          )}
        </Box>
      )}

      <Box sx={{
        display: 'grid',
        // Three columns from large up so a 27" monitor or a TV doesn't run
        // 130-character lines of metadata across the whole panel.
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '1fr 1fr', xl: '1fr 1fr 1fr' },
        gap: { xs: 2, md: 2.5, xl: 3 },
        alignItems: 'start',
      }}>
        <SectionCard>
          <SectionHeading>Details</SectionHeading>
          {/* The audience score, which the panel never actually showed — the hero's star
              pill is a glance, this is the number with its sample size. Theme colours are
              passed in: the ring's defaults are white-on-black and would vanish here in
              the light theme. */}
          {tmdb.voteAverage > 0 && (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1.75,
              pb: 1.5, mb: 1, borderBottom: `1px solid ${alpha(T.text, 0.07)}`,
            }}>
              <RatingRing
                value={tmdb.voteAverage}
                size={58}
                trackColor={alpha(T.text, 0.12)}
                labelColor={T.textFaint}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ color: T.text, fontWeight: 700, fontSize: '0.86rem' }}>
                  TMDB score
                </Typography>
                <Typography sx={{ color: T.textFaint, fontSize: '0.76rem', fontWeight: 600 }}>
                  {tmdb.voteCount > 0
                    ? `${tmdb.voteCount.toLocaleString()} vote${tmdb.voteCount === 1 ? '' : 's'}`
                    : 'No votes yet'}
                </Typography>
              </Box>
            </Box>
          )}
          {isMovie ? (
            <>
              <StatRow label="Release Date" value={formatDate(tmdb.releaseDate)} />
              <StatRow label="Runtime" value={formatRuntime(tmdb.runtime)} />
              <StatRow label="Status" value={tmdb.status} />
              <StatRow label="Language" value={tmdb.originalLanguage?.toUpperCase()} />
              <StatRow label="Budget" value={formatCurrency(tmdb.budget)} />
              <StatRow label="Revenue" value={formatCurrency(tmdb.revenue)} />
              {tmdb.imdbId && <StatRow label="IMDb" value={tmdb.imdbId} link={`https://www.imdb.com/title/${tmdb.imdbId}`} />}
              {tmdb.homepage && <StatRow label="Homepage" value="Visit website" link={tmdb.homepage} />}
              {tmdb.belongsToCollection && (
                <StatRow
                  label="Collection"
                  value={tmdb.belongsToCollection.name}
                  onClick={() => navigate(
                    Constants.DB_CINEMA_COLLECTION_ROUTE.replace(':collectionId', tmdb.belongsToCollection.id),
                  )}
                />
              )}
            </>
          ) : (
            <>
              <StatRow label="First Air Date" value={formatDate(tmdb.firstAirDate)} />
              <StatRow label="Last Air Date" value={formatDate(tmdb.lastAirDate)} />
              <StatRow label="In Production" value={tmdb.inProduction != null ? (tmdb.inProduction ? 'Yes' : 'No') : null} />
              <StatRow label="Seasons" value={tmdb.numberOfSeasons} />
              <StatRow label="Episodes" value={tmdb.numberOfEpisodes} />
              <StatRow label="Episode Runtime" value={tmdb.episodeRunTimes?.length > 0 ? tmdb.episodeRunTimes.map(formatRuntime).join(', ') : null} />
              <StatRow label="Status" value={tmdb.status} />
              <StatRow label="Type" value={tmdb.type} />
              <StatRow label="Language" value={tmdb.originalLanguage?.toUpperCase()} />
              {tmdb.homepage && <StatRow label="Homepage" value="Visit website" link={tmdb.homepage} />}
            </>
          )}

        </SectionCard>

        <SectionCard>
          <SectionHeading>Production</SectionHeading>

          {(() => {
            const companies = (tmdb.productionCompanies ?? []).filter((c) => c?.name);
            if (!companies.length) return null;
            return (
              <Box sx={{ mb: 2.5 }}>
                {groupLabel('Companies')}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {companies.map((c) => (
                    <Chip key={c.name} label={`${c.name}${c.originCountry ? ` (${c.originCountry})` : ''}`} size="small" sx={subChipSx} />
                  ))}
                </Box>
              </Box>
            );
          })()}

          {(() => {
            const countries = (tmdb.productionCountries ?? []).filter((c) => c?.name);
            if (!countries.length) return null;
            return (
              <Box sx={{ mb: 2.5 }}>
                {groupLabel('Countries')}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {countries.map((c) => (
                    <Chip key={c.name} label={c.name} size="small" sx={subChipSx} />
                  ))}
                </Box>
              </Box>
            );
          })()}

          {(() => {
            const langs = (tmdb.spokenLanguages ?? [])
              .map((l) => ({ ...l, _label: l.englishName ?? l.name }))
              .filter((l) => l._label);
            if (!langs.length) return null;
            return (
              <Box sx={{ mb: 2.5 }}>
                {groupLabel('Languages')}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {langs.map((l) => (
                    <Chip key={l._label} label={l._label} size="small" sx={subChipSx} />
                  ))}
                </Box>
              </Box>
            );
          })()}

          {!isMovie && (() => {
            const creators = (tmdb.createdBy ?? []).filter((c) => c?.name);
            if (!creators.length) return null;
            return (
              <Box sx={{ mb: 2.5 }}>
                {groupLabel('Created By')}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {creators.map((c) => (
                    <Chip key={c.name} label={c.name} size="small" sx={chipSx} />
                  ))}
                </Box>
              </Box>
            );
          })()}

          {!isMovie && (tmdb.lastEpisodeToAir || tmdb.nextEpisodeToAir) && (
            <Box>
              {tmdb.lastEpisodeToAir && (() => {
                const ep = tmdb.lastEpisodeToAir;
                const sn = ep.seasonNumber ?? tmdb.seasons?.find(s => s.episodes?.some(e => e.id === ep.id))?.seasonNumber;
                const s = sn != null ? String(sn).padStart(2, '0') : '??';
                const e = ep.episodeNumber != null ? String(ep.episodeNumber).padStart(2, '0') : '??';
                return (
                  <Paper sx={{ bgcolor: T.glass, p: 1.5, borderRadius: 1.5, mb: 1.5, border: `1px solid ${alpha(T.text, 0.08)}` }}>
                    <Typography variant="caption" sx={{ color: T.textFaint, textTransform: 'uppercase', letterSpacing: 1 }}>Last Episode</Typography>
                    <Typography variant="body2" sx={{ color: T.text, mt: 0.5, fontWeight: 600 }}>
                      S{s}E{e}{ep.name ? ` — ${ep.name}` : ''}
                    </Typography>
                    <Typography variant="caption" sx={{ color: T.textFaint }}>{formatDate(ep.airDate)}</Typography>
                  </Paper>
                );
              })()}
              {tmdb.nextEpisodeToAir && (() => {
                const ep = tmdb.nextEpisodeToAir;
                const sn = ep.seasonNumber ?? tmdb.seasons?.find(s => s.episodes?.some(e => e.id === ep.id))?.seasonNumber;
                const s = sn != null ? String(sn).padStart(2, '0') : '??';
                const e = ep.episodeNumber != null ? String(ep.episodeNumber).padStart(2, '0') : '??';
                return (
                  <Paper sx={{ bgcolor: T.glass, p: 1.5, borderRadius: 1.5, border: `1px solid ${alpha(T.teal, 0.25)}` }}>
                    <Typography variant="caption" sx={{ color: T.teal, textTransform: 'uppercase', letterSpacing: 1 }}>Next Episode</Typography>
                    <Typography variant="body2" sx={{ color: T.text, mt: 0.5, fontWeight: 600 }}>
                      S{s}E{e}{ep.name ? ` — ${ep.name}` : ''}
                    </Typography>
                    <Typography variant="caption" sx={{ color: T.textFaint }}>{formatDate(ep.airDate)}</Typography>
                  </Paper>
                );
              })()}
            </Box>
          )}

        </SectionCard>

        {selectedRegion && (
          <SectionCard>
            <SectionHeading action={selectedRegion || null}>
              Where to Watch
            </SectionHeading>

            {sortedProviderKeys.length > 0 ? (
              sortedProviderKeys.map((type) => (
                <Box key={type} sx={{ mb: 2, '&:last-of-type': { mb: 0 } }}>
                  {groupLabel(typeLabel[type] ?? type)}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {grouped[type].map((p) => {
                      const logoUrl = tmdbImg(p.provider?.logoPath, 'w92');
                      return (
                        <Box key={`${p.regionCode ?? ''}:${p.provider?.name ?? ''}`} sx={{
                          display: 'flex', alignItems: 'center', gap: 1,
                          bgcolor: alpha(T.text, 0.05),
                          border: `1px solid ${alpha(T.text, 0.09)}`,
                          borderRadius: 2, px: 1.25, py: 0.85,
                          transition: 'border-color .18s, transform .18s',
                          '&:hover': { borderColor: alpha(T.teal, 0.55), transform: 'translateY(-2px)' },
                        }}>
                          {logoUrl && (
                            <Box
                              component="img" src={logoUrl} alt={p.provider?.name}
                              sx={{
                                width: { xs: 26, xl: 30 }, height: { xs: 26, xl: 30 },
                                borderRadius: 1, objectFit: 'cover', flexShrink: 0,
                              }}
                            />
                          )}
                          <Typography sx={{
                            color: T.textMuted, fontWeight: 600,
                            fontSize: { xs: '0.78rem', xl: '0.88rem' },
                          }}>
                            {p.provider?.name}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ))
            ) : (
              <Typography variant="body2" sx={{ color: T.textFaint }}>
                Not available in {selectedRegion}.
              </Typography>
            )}
          </SectionCard>
        )}
      </Box>
    </Box>
  );
}