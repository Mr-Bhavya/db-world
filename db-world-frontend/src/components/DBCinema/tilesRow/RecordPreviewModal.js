import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import YouTube from 'react-youtube';
import Constants from '../../Constants';
import Reaction from '../icons/reaction';
import Watchlist from '../icons/watchlist';
import Watched from '../icons/watched';
import CommonServices from '../../CommonServices';
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
import { Close, Info, Tv, Download, VolumeUp, VolumeOff } from '@mui/icons-material';

const RecordPreviewModal = ({ title, record, onClose, onUpdateRecord, compact = false }) => {
  const tmdb = record?.tmdb;
  const navigate = useNavigate();
  const [showProviders, setShowProviders] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [player, setPlayer] = useState(null);
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const providers = record.movieTmdb?.providers;
  const hasProviders =
    providers &&
    ((providers.flatrate && providers.flatrate.length > 0) ||
      (providers.buy && providers.buy.length > 0) ||
      (providers.rent && providers.rent.length > 0));

  const handleReactionUpdate = (newData) => {
    onUpdateRecord({ ...record, ...newData });
  };

  const handleWatchlistWatchedUpdate = (newData) => {
    onUpdateRecord({ ...record, ...newData });
  };

  const handleDetailsClick = () => {
    navigate(
      record.type.toLowerCase() === Constants.RECORD_TYPE_MOVIE
        ? Constants.DB_MOVIE_DETIALS_ROUTE.replace(
          ":title",
          `${record.recordId}-${record.name.toLowerCase().replace(/ /g, "-")}`
        )
        : Constants.DB_SERIES_DETIALS_ROUTE.replace(
          ":title",
          `${record.recordId}-${record.name.toLowerCase().replace(/ /g, "-")}`
        )
    );
  };

  const trailerKey = tmdb?.videos?.find(vid => vid.type === 'Trailer' && vid.official)?.key ||
    tmdb?.videos[0]?.key;

  const toggleMute = () => {
    if (player) {
      if (isMuted) {
        player.unMute();
        player.playVideo();
      } else {
        player.mute();
      }
      setIsMuted(!isMuted);
    }
  };

  const onPlayerReady = (event) => {
    setPlayer(event.target);
    event.target.mute();
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
        {trailerKey ? (
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
        ) : (
          <img
            src={CommonServices.getImageUrlFromTmdb(tmdb, Constants.IMAGE_TYPE_BACKDROP, "w500")}
            alt={tmdb.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
            loading="lazy"
          />
        )}
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
          {tmdb.title || tmdb.name}
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
            <Reaction
              isLiked={record?.isLiked}
              recordId={record.recordId}
              userId={""}
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
          <Chip
            label={tmdb.release_date?.split("-")?.[0] || tmdb.first_air_date?.split("-")?.[0]}
            size="small"
          />
          {tmdb?.runtime && <Chip label={`${tmdb.runtime} min`} size="small" />}
          {tmdb.vote_count && tmdb.vote_count > 0 && (
            <Chip label={`${tmdb.vote_average}/10`} size="small" />
          )}
          {tmdb.genres?.map(genre => (
            <Chip key={genre.id} label={genre.name} size="small" />
          ))}
        </Stack>

        {/* Streaming & Download Options in One Line */}

        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
          {hasProviders && (<Button
            variant="outlined"
            size="small"
            startIcon={<Tv />}
            onClick={() => setShowProviders(!showProviders)}
            sx={{
              flexGrow: 1,
              color: theme.palette.text.primary,
              borderColor: theme.palette.text.primary,
              '&:hover': {
                borderColor: 'black',
                color: 'black',
                backgroundColor: 'white',
              }
            }}
          >
            Streaming On
          </Button>
          )}

          <Button
            variant="outlined"
            color={theme.palette.primary.dark}
            backgroundColor={theme.palette.primary.dark}
            size="small"
            startIcon={<Download />}
            onClick={() =>
              navigate(
                `${Constants.DB_DONWLOAD_RECORD_ROUTE.replace(":recordId", record.recordId)}`,
                { state: { movie: record, userRole: "" } }
              )
            }
            sx={{
              flexGrow: 1,
              color: theme.palette.getContrastText(theme.palette.primary.main),
              '&:hover': {
                color: "black",
                backgroundColor: 'white',
              }
            }}
          >
            Download
          </Button>
        </Stack>

        {showProviders && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {providers.flatrate?.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Streaming on
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                  {providers.flatrate.map((provider) => (
                    <img
                      key={provider.provider_id}
                      src={`https://image.tmdb.org/t/p/w500${provider.logo_path}`}
                      alt={provider.provider_name}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '4px',
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {(providers.buy?.length > 0 || providers.rent?.length > 0) && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Buy/Rent from
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                  {providers.buy?.map((provider) => (
                    <img
                      key={provider.provider_id}
                      src={`https://image.tmdb.org/t/p/w500${provider.logo_path}`}
                      alt={provider.provider_name}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '4px',
                      }}
                    />
                  ))}
                  {providers.rent?.map((provider) => (
                    <img
                      key={provider.provider_id}
                      src={`https://image.tmdb.org/t/p/w500${provider.logo_path}`}
                      alt={provider.provider_name}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '4px',
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </motion.div>
        )}

        {/* Overview */}
        {!compact && (
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
            {tmdb.overview?.length > 150 && (
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