import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import YouTube from 'react-youtube';
import Constants from '@shared/constants';
import Reaction from '../icons/reaction';
import Watchlist from '../icons/watchlist';
import Watched from '../icons/watched';
import Download from '../icons/download'; // Using the existing Download component
import CommonServices from '@shared/services/CommonServices';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Divider,
  useTheme,
  useMediaQuery,
  Stack,
  Chip
} from '@mui/material';
import { motion } from 'framer-motion';
import { Close, Info, Tv, VolumeUp, VolumeOff } from '@mui/icons-material';

const RecordPreviewModal = ({ title, record, onClose, onUpdateRecord, compact = false }) => {
  const tmdb = record?.tmdb || {};
  const navigate = useNavigate();
  const [showProviders, setShowProviders] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [player, setPlayer] = useState(null);
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const providers = record?.tmdb?.providers || record?.movieTmdb?.providers || record?.seriesTmdb?.providers || {};
  const hasProviders = (
    (providers?.flatrate?.length > 0) ||
    (providers?.buy?.length > 0) ||
    (providers?.rent?.length > 0)
  );

  const handleReactionUpdate = (newData) => {
    if (onUpdateRecord && record) {
      if (newData?.reaction === 'like') {
        newData.isLiked = true;
      }
      onUpdateRecord({ ...record, ...newData });
    }
  };

  const handleWatchlistWatchedUpdate = (newData) => {
    if (onUpdateRecord && record) {
      onUpdateRecord({ ...record, ...newData });
    }
  };

  const handleDetailsClick = () => {
    if (!record?.recordId || !record?.name) return;

    const route = record.type?.toLowerCase() === Constants.RECORD_TYPE_MOVIE
      ? Constants.DB_MOVIE_DETIALS_ROUTE.replace(
        ":title",
        `${record.recordId}-${CommonServices.slugify(record.name)}`
      )
      : Constants.DB_SERIES_DETIALS_ROUTE.replace(
        ":title",
        `${record.recordId}-${CommonServices.slugify(record.name)}`
      );

    navigate(route);
  };

  const trailerKey = tmdb?.videos?.find(vid =>
    vid?.type === 'Trailer' && vid?.official
  )?.key || tmdb?.videos?.[0]?.key;

  const toggleMute = () => {
    if (player) {
      isMuted ? player.unMute() : player.mute();
      setIsMuted(!isMuted);
    }
  };

  const onPlayerReady = (event) => {
    setPlayer(event.target);
    event.target.mute();
  };

  const renderTrailerOrBackdrop = () => {
    if (trailerKey) {
      return (
        <>
          <YouTube
            videoId={trailerKey}
            opts={{
              width: '100%',
              height: compact ? '100' : '200',
              playerVars: {
                autoplay: 1,
                mute: 1,
                controls: 0,
                rel: 0,
                modestbranding: 1
              }
            }}
            onReady={onPlayerReady}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          />
          <IconButton
            onClick={toggleMute}
            aria-label={isMuted ? "unmute" : "mute"}
            sx={{
              position: 'absolute',
              right: 8,
              bottom: 8,
              color: 'common.white',
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 10,
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.8)'
              }
            }}
          >
            {isMuted ? <VolumeOff /> : <VolumeUp />}
          </IconButton>
        </>
      );
    }

    const backdropUrl = CommonServices.getImageUrlFromTmdb(tmdb, Constants.IMAGE_TYPE_BACKDROP, "w500");
    if (backdropUrl) {
      return (
        <img
          src={backdropUrl}
          alt={tmdb?.title || 'Media backdrop'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
          loading="lazy"
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      );
    }

    return (
      <Box sx={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.palette.grey[900],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Typography color="text.secondary">No preview available</Typography>
      </Box>
    );
  };

  const renderMetadataChips = () => {
    const chips = [];

    // Release year
    const releaseYear = tmdb?.release_date?.split("-")?.[0] || tmdb?.first_air_date?.split("-")?.[0];
    if (releaseYear) {
      chips.push(<Chip key="year" label={releaseYear} size="small" />);
    }

    // Runtime
    if (tmdb?.runtime) {
      chips.push(<Chip key="runtime" label={`${tmdb.runtime} min`} size="small" />);
    }

    // Rating
    if (tmdb?.vote_count > 0) {
      chips.push(<Chip key="rating" label={`${tmdb.vote_average?.toFixed(1)}/10`} size="small" />);
    }

    // Genres
    tmdb?.genres?.forEach(genre => {
      if (genre?.name) {
        chips.push(<Chip key={genre.id} label={genre.name} size="small" />);
      }
    });

    return chips.length > 0 ? chips : null;
  };

  const renderProviderLogos = (providerList) => {
    if (!providerList?.length) return null;

    return providerList.map((provider) => (
      provider?.logo_path && (
        <img
          key={provider.provider_id}
          src={`https://image.tmdb.org/t/p/w500${provider.logo_path}`}
          alt={provider.provider_name || 'Provider logo'}
          style={{
            width: 40,
            height: 40,
            borderRadius: '4px',
          }}
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      )
    )).filter(Boolean);
  };

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      sx={{
        backgroundColor: theme.palette.background.paper,
        borderRadius: compact ? '4px' : '8px',
        overflow: 'hidden',
        width: '100%',
        maxWidth: compact ? '400px' : '800px',
        boxShadow: 24
      }}
    >
      {/* Close Button */}
      <IconButton
        onClick={onClose}
        aria-label="close"
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          color: 'common.white',
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 10,
          '&:hover': {
            backgroundColor: 'rgba(0,0,0,0.8)'
          }
        }}
      >
        <Close />
      </IconButton>

      {/* Trailer/Backdrop */}
      <Box sx={{
        height: compact ? 100 : 200,
        width: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {renderTrailerOrBackdrop()}
      </Box>

      {/* Content */}
      <Box sx={{ p: compact ? 1 : 2 }}>
        <Typography
          variant={compact ? 'h6' : 'h5'}
          sx={{
            mb: 1.5,
            fontWeight: 700,
            color: 'text.primary'
          }}
        >
          {tmdb?.title || tmdb?.name || 'Untitled Media'}
        </Typography>

        {/* Action Buttons */}
        <Stack
          direction="row"
          spacing={1}
          sx={{
            mb: 2,
            justifyContent: 'space-between'
          }}
        >
          <Stack direction="row" spacing={1}>
            {record?.recordId && (
              <>
                <Reaction
                  recordId={record.recordId}
                  initialReaction={record?.isLiked ? 'like' : null}
                  onUpdate={handleReactionUpdate}
                  size={compact ? 'small' : 'medium'}
                />
                <Watchlist
                  isAddedToWatchList={record?.isWatchListed}
                  recordId={record.recordId}
                  onUpdate={handleWatchlistWatchedUpdate}
                  size={compact ? 'small' : 'medium'}
                />
                <Watched
                  isWatched={record?.isWatched}
                  recordId={record.recordId}
                  onUpdate={handleWatchlistWatchedUpdate}
                  size={compact ? 'small' : 'medium'}
                />
              </>
            )}
          </Stack>

          <IconButton
            size={compact ? 'small' : 'medium'}
            onClick={handleDetailsClick}
            sx={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.2)'
              }
            }}
          >
            <Info fontSize={compact ? 'small' : 'medium'} />
          </IconButton>
        </Stack>

        {/* Metadata */}
        <Stack direction="row" spacing={0} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {renderMetadataChips()}
        </Stack>

        {/* Streaming & Download Options */}
        <Box sx={{ mb: 2, width: '100%' }}>
          {hasProviders ? (
            <>
              {/* For normal screens - providers on left, download on right */}
              <Box
                sx={{
                  display: { xs: 'none', sm: 'flex' },
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 1,
                  flexWrap: 'wrap'
                }}
              >
                {/* Streaming providers section */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 1,
                    flex: 1,
                    minWidth: 0
                  }}
                >
                  <Tv sx={{ color: 'text.secondary', fontSize: '1.2rem' }} />
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                    Streaming on:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {renderProviderLogos(providers.flatrate?.slice(0, 3))}
                    {providers.flatrate?.length > 3 && (
                      <Typography variant="body2" color="text.secondary">
                        +{providers.flatrate.length - 3} more
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* Download button */}
                <Download
                  record={record}
                  variant="button"
                  buttonVariant="outlined"
                  size="medium"
                  color="dark"
                  sx={{
                    flexShrink: 0,
                    '& .MuiButton-startIcon': {
                      marginRight: '4px'
                    }
                  }}
                />
              </Box>

              {/* For small screens - vertical layout */}
              <Box
                sx={{
                  display: { xs: 'flex', sm: 'none' },
                  flexDirection: 'column',
                  gap: 1
                }}
              >
                {/* Streaming providers section */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 0.5
                  }}
                >
                  <Tv sx={{ color: 'text.secondary', fontSize: '1.2rem' }} />
                  <Typography variant="body2" color="text.secondary">
                    Streaming on:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {renderProviderLogos(providers.flatrate?.slice(0, 2))}
                    {providers.flatrate?.length > 2 && (
                      <Typography variant="body2" color="text.secondary">
                        +{providers.flatrate.length - 2} more
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* Download button */}
                <Download
                  record={record}
                  variant="button"
                  buttonVariant="outlined"
                  size="medium"
                  color="dark"
                  sx={{
                    width: '100%',
                    '& .MuiButton-startIcon': {
                      marginRight: '4px'
                    }
                  }}
                />
              </Box>
            </>
          ) : (
            <Download
              record={record}
              variant="button"
              buttonVariant="outlined"
              size="medium"
              color="dark"
              sx={{
                width: '100%',
                '& .MuiButton-startIcon': {
                  marginRight: '4px'
                }
              }}
            />
          )}
        </Box>

        {/* Expanded providers view when clicked (optional) */}
        {showProviders && hasProviders && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {providers.flatrate?.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  All streaming providers:
                </Typography>
                <Box
                  sx={{
                    mt: 0.5,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.5
                  }}
                >
                  {renderProviderLogos(providers.flatrate)}
                </Box>
              </Box>
            )}

            {(providers.buy?.length > 0 || providers.rent?.length > 0) && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Buy/Rent from:
                </Typography>
                <Box
                  sx={{
                    mt: 0.5,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.5
                  }}
                >
                  {renderProviderLogos(providers.buy)}
                  {renderProviderLogos(providers.rent)}
                </Box>
              </Box>
            )}
          </motion.div>
        )}

        {/* Overview */}
        {!compact && tmdb?.overview && (
          <Box>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                display: expanded ? 'block' : '-webkit-box',
                WebkitLineClamp: expanded ? 'unset' : 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {tmdb.overview}
            </Typography>
            {tmdb.overview.length > 150 && (
              <Button
                size="small"
                onClick={() => setExpanded(!expanded)}
                sx={{
                  mt: 0.5,
                  color: 'text.secondary',
                  textTransform: 'none',
                  fontSize: '0.75rem'
                }}
              >
                {expanded ? 'Show Less' : 'Read More'}
              </Button>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default RecordPreviewModal;