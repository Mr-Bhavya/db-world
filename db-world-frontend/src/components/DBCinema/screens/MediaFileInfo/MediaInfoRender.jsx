import React, { useState, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Button,
  Typography,
  Divider,
  IconButton,
  Collapse,
  Box,
  Grid,
  useTheme,
  useMediaQuery,
  alpha,
  Chip,
  Stack,
  Tooltip,
  Avatar,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton
} from "@mui/material";
import { Capacitor } from "@capacitor/core";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExpandMore,
  PlayArrow,
  Download,
  ContentCopy,
  SmartDisplay,
  Videocam,
  Movie,
  MoreVert,
  HighQuality,
  Speed,
  Check,
  Error, VideoSettings
} from "@mui/icons-material";
import AndroidPlugins from "../../../../android-app-components/AndroidPlugins";
import VideoModal from "../download/VideoModal";
import CommonServices from "../../../CommonServices";
import Constants from "../../../Constants";
import { MediaInfoContent } from "./MediaInfoContent";
import PlayerSelectionDialog from "./PlayerSelectionDialog";
import HLSVideoPlayer from './HLS/HLSVideoPlayer';
import HLSPlayerOptions from "./HLS/HLSPlayerOptions";

// Enhanced Action Button Component with Feedback States
const ActionButton = ({
  icon,
  label,
  onClick,
  color = "primary",
  variant = "contained",
  tooltip,
  size = "medium",
  badgeContent,
  feedbackState = null, // 'success', 'error', or null
  feedbackDuration = 2000
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const getButtonStyles = () => {
    const baseStyles = {
      borderRadius: 2,
      minWidth: isMobile ? 'auto' : 100,
      px: isMobile ? 1 : 2,
      transition: 'all 0.3s ease',
      position: 'relative',
      overflow: 'hidden'
    };

    if (feedbackState === 'success') {
      return {
        ...baseStyles,
        bgcolor: 'success.main',
        color: 'success.contrastText',
        '&:hover': {
          bgcolor: 'success.dark',
        }
      };
    } else if (feedbackState === 'error') {
      return {
        ...baseStyles,
        bgcolor: 'error.main',
        color: 'error.contrastText',
        '&:hover': {
          bgcolor: 'error.dark',
        }
      };
    } else {
      return {
        ...baseStyles,
        ...(variant === 'contained' && {
          bgcolor: `${color}.main`,
          '&:hover': {
            bgcolor: `${color}.dark`,
            transform: 'translateY(-2px)',
            boxShadow: theme.shadows[4]
          }
        })
      };
    }
  };

  const getIcon = () => {
    if (feedbackState === 'success') {
      return <Check sx={{ fontSize: { xs: '16px', sm: '18px' } }} />;
    } else if (feedbackState === 'error') {
      return <Error sx={{ fontSize: { xs: '16px', sm: '18px' } }} />;
    }
    return icon;
  };

  const buttonContent = (
    <Button
      variant={variant}
      size={size}
      startIcon={getIcon()}
      onClick={onClick}
      sx={getButtonStyles()}
    >
      {!isMobile && label}
    </Button>
  );

  if (badgeContent) {
    return (
      <Badge
        badgeContent={badgeContent}
        color="primary"
        sx={{
          '& .MuiBadge-badge': {
            fontSize: '0.7rem',
            height: 20,
            minWidth: 20
          }
        }}
      >
        <Tooltip title={tooltip || label}>
          {buttonContent}
        </Tooltip>
      </Badge>
    );
  }

  return (
    <Tooltip title={tooltip || label}>
      {buttonContent}
    </Tooltip>
  );
};

// Enhanced Icon Button with Feedback
const FeedbackIconButton = ({
  icon,
  tooltip,
  onClick,
  color = "primary",
  feedbackState = null,
  sx = {}
}) => {
  const theme = useTheme();

  const getButtonStyles = () => {
    const baseStyles = {
      transition: 'all 0.3s ease',
      position: 'relative',
      overflow: 'hidden',
      ...sx
    };

    if (feedbackState === 'success') {
      return {
        ...baseStyles,
        bgcolor: 'success.main',
        color: 'success.contrastText',
        '&:hover': {
          bgcolor: 'success.dark',
        }
      };
    } else if (feedbackState === 'error') {
      return {
        ...baseStyles,
        bgcolor: 'error.main',
        color: 'error.contrastText',
        '&:hover': {
          bgcolor: 'error.dark',
        }
      };
    } else {
      return {
        ...baseStyles,
        ...(color === 'primary' && {
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          '&:hover': {
            bgcolor: 'primary.dark',
            transform: 'scale(1.05)'
          }
        }),
        ...(color === 'success' && {
          bgcolor: 'success.main',
          color: 'success.contrastText',
          '&:hover': {
            bgcolor: 'success.dark',
            transform: 'scale(1.05)'
          }
        }),
        ...(color === 'secondary' && {
          border: `1.5px solid ${theme.palette.secondary.main}`,
          color: theme.palette.secondary.main,
          '&:hover': {
            bgcolor: alpha(theme.palette.secondary.main, 0.1),
            transform: 'scale(1.05)'
          }
        })
      };
    }
  };

  const getIcon = () => {
    if (feedbackState === 'success') {
      return <Check sx={{ fontSize: { xs: '18px', sm: '20px' } }} />;
    } else if (feedbackState === 'error') {
      return <Error sx={{ fontSize: { xs: '18px', sm: '20px' } }} />;
    }
    return icon;
  };

  return (
    <Tooltip title={tooltip}>
      <motion.div
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <IconButton
          onClick={onClick}
          sx={getButtonStyles()}
        >
          {getIcon()}
        </IconButton>
      </motion.div>
    </Tooltip>
  );
};

// Main Component
export const MediaInfoRender = ({
  mediaInfo,
  expandCard = false,
  onPlay,
  onCopy,
  showActions = true,
  showHeader = true,
  cardStyle = {},
  qualityBadge,
  priority
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [expandedCards, setExpandedCards] = useState({ [mediaInfo.id]: expandCard });
  const [showPlayerFor, setShowPlayerFor] = useState(null);
  const [playerDialogOpen, setPlayerDialogOpen] = useState(false);

  // Feedback states for buttons
  const [copyStreamFeedback, setCopyStreamFeedback] = useState(null);
  const [copyDownloadFeedback, setCopyDownloadFeedback] = useState(null);
  const [downloadFeedback, setDownloadFeedback] = useState(null);

  const [showHLSPlayer, setShowHLSPlayer] = useState(false);
  const [selectedHLSStream, setSelectedHLSStream] = useState(null);
  const [showStreamOptions, setShowStreamOptions] = useState(false);

  const toggleCard = (id) => setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));

  // Memoized media quality info
  const mediaQuality = useMemo(() => {
    const video = mediaInfo.video || {};
    return {
      resolution: video.resolution || 'Unknown',
      format: video.format || 'Unknown',
      bitrate: video.bitrate || 'Unknown',
      hdr: video.hdrDetails || null,
      codec: video.codec || 'Unknown'
    };
  }, [mediaInfo.video]);

  // Helper function to set feedback with auto-reset
  const setFeedbackWithReset = (setter, state, duration = 2000) => {
    setter(state);
    setTimeout(() => setter(null), duration);
  };

  const checkIfHLSExists = async (recordId) => {
    try {
      const response = await fetch(`http://localhost:9000/api/hls/content/${recordId}/info`);
      const data = await response.json();
      return data.status === 'READY' && data.variants?.length > 0;
    } catch (error) {
      //console.log('HLS not available:', error);
      return false;
    }
  };

  // const handlePlayClick = () => {
  //   if (Capacitor.getPlatform() === "android") {
  //     AndroidPlugins.MyMedia3Player?.(mediaInfo.streamUrl, mediaInfo.general?.fileName);
  //   } else {
  //     setPlayerDialogOpen(true);
  //   }
  // };

  const handlePlayClick = async () => {
    // Check if HLS is available
    const hasHLS = await checkIfHLSExists(mediaInfo.recordId);

    if (hasHLS) {
      // Show HLS player options
      setShowHLSPlayer(true);
      setSelectedHLSStream({
        recordId: mediaInfo.recordId,
        title: mediaInfo.general?.fileName,
        masterPlaylistUrl: `http://localhost:9000/api/hls/playback/${mediaInfo.recordId}`
      });
    } else {
      // Fallback to original player
      if (Capacitor.getPlatform() === "android") {
        AndroidPlugins.MyMedia3Player?.(mediaInfo.streamUrl, mediaInfo.general?.fileName);
      } else {
        setPlayerDialogOpen(true);
      }
    }
  };

  const handleCopyUrl = async (url, type = "Stream") => {
    const setter = type === "Stream" ? setCopyStreamFeedback : setCopyDownloadFeedback;

    try {
      const result = await CommonServices.handleCopy(url);

      if (result.success) {
        setFeedbackWithReset(setter, 'success');
        onCopy?.(url, type);
      } else {
        setFeedbackWithReset(setter, 'error');
        console.error(`Copy failed: ${result.message}`);
      }
    } catch (error) {
      setFeedbackWithReset(setter, 'error');
      console.error('Copy error:', error);
    }
  };

  const handleDownload = async () => {
    try {
      const result = await CommonServices.handleDownload(mediaInfo.downloadUrl, {
        fileName: mediaInfo.general?.fileName,
        openInNewTab: true
      });

      if (result.success) {
        setFeedbackWithReset(setDownloadFeedback, 'success');
      } else {
        setFeedbackWithReset(setDownloadFeedback, 'error');
        console.error(`Download failed: ${result.message}`);
      }
    } catch (error) {
      setFeedbackWithReset(setDownloadFeedback, 'error');
      console.error('Download error:', error);
    }
  };

  const getQualityColor = (quality) => {
    const qualityMap = {
      '4K': 'error',
      '2160p': 'error',
      '1440p': 'warning',
      '1080p': 'success',
      '720p': 'primary',
      '480p': 'secondary'
    };
    return qualityMap[quality] || 'default';
  };

  return (
    <>
      <Grid item xs={12} sm={6} md={4} lg={3} sx={{ display: 'flex' }}>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          transition={{ duration: 0.3 }}
          style={{ width: '100%' }}
        >
          <Card sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.default, 0.9)} 100%)`,
            backdropFilter: 'blur(10px)',
            boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.1)}`,
            borderRadius: 3,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            overflow: 'hidden',
            position: 'relative',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              boxShadow: `0 8px 40px ${alpha(theme.palette.primary.main, 0.15)}`,
              borderColor: alpha(theme.palette.primary.main, 0.3),
              transform: 'translateY(-4px)'
            },
            ...cardStyle
          }}>
            {/* Priority Badge */}
            {priority && (
              <Box sx={{
                position: 'absolute',
                top: -8,
                right: -8,
                zIndex: 2
              }}>
                <Chip
                  label={`P${priority}`}
                  size="small"
                  color="primary"
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    height: 24,
                    boxShadow: theme.shadows[2]
                  }}
                />
              </Box>
            )}

            {showHeader && (
              <CardHeader
                sx={{
                  px: { xs: 1.5, sm: 2 },
                  py: 1.5,
                  background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 100%)`,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08)
                  },
                  transition: 'all 0.3s ease'
                }}
                title={
                  <Box
                    onClick={() => toggleCard(mediaInfo.id)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                      width: '100%'
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 700,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: isMobile ? 2 : 1,
                          WebkitBoxOrient: 'vertical',
                          whiteSpace: 'normal',
                          lineHeight: 1.3,
                          fontSize: { xs: '0.8rem', sm: '0.9rem' },
                          color: 'text.primary'
                        }}
                      >
                        {mediaInfo.general?.fileName?.replace(/[._]/g, ' ') || 'Media File'}
                      </Typography>

                      {/* Quality Badges */}
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                        <Chip
                          icon={<HighQuality />}
                          label={mediaQuality.resolution}
                          size="small"
                          color={getQualityColor(mediaQuality.resolution)}
                          variant="outlined"
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            '& .MuiChip-icon': { fontSize: '0.8rem' }
                          }}
                        />
                        {mediaQuality.hdr && (
                          <Chip
                            label="HDR"
                            size="small"
                            color="warning"
                            sx={{ height: 20, fontSize: '0.65rem' }}
                          />
                        )}
                      </Stack>
                    </Box>

                    <IconButton
                      size="small"
                      sx={{
                        transform: expandedCards[mediaInfo.id] ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease',
                        color: 'primary.main',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.2),
                          transform: expandedCards[mediaInfo.id] ? 'rotate(180deg) scale(1.1)' : 'rotate(0deg) scale(1.1)'
                        }
                      }}
                    >
                      <ExpandMore fontSize="small" />
                    </IconButton>
                  </Box>
                }
              />
            )}

            <Collapse in={expandedCards[mediaInfo.id]} timeout="auto" unmountOnExit>
              <MediaInfoContent mediaInfo={mediaInfo} />
            </Collapse>

            {showActions && (
              <CardActions sx={{
                px: { xs: 0.5, sm: 1.5, md: 2 },
                py: { xs: 1, sm: 1.5 },
                bgcolor: alpha(theme.palette.background.default, 0.6),
                borderTop: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                gap: { xs: 0.25, sm: 1 }
              }}>
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  gap: { xs: 0.5, sm: 1 }
                }}>
                  {/* Play Section */}
                  <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 } }}>
                    {/* Play Button */}
                    <FeedbackIconButton
                      icon={<PlayArrow />}
                      tooltip="Play media"
                      onClick={handlePlayClick}
                      color="primary"
                      sx={{
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        p: { xs: 0.75, sm: 1 },
                        boxShadow: 2
                      }}
                    />

                    {/* Copy Stream URL */}
                    <FeedbackIconButton
                      icon={<ContentCopy />}
                      tooltip="Copy stream URL"
                      onClick={() => handleCopyUrl(mediaInfo.streamUrl, "Stream")}
                      color="secondary"
                      feedbackState={copyStreamFeedback}
                      sx={{
                        border: `1.5px solid ${theme.palette.secondary.main}`,
                        p: { xs: 0.75, sm: 1 },
                      }}
                    />
                  </Box>

                  {/* Download Section */}
                  <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 } }}>
                    {/* Copy Download URL */}
                    <FeedbackIconButton
                      icon={<ContentCopy />}
                      tooltip="Copy download URL"
                      onClick={() => handleCopyUrl(mediaInfo.downloadUrl, "Download")}
                      color="secondary"
                      feedbackState={copyDownloadFeedback}
                      sx={{
                        border: `1.5`,
                        p: { xs: 0.75, sm: 1 },
                      }}
                    />

                    {/* Download Button */}
                    <FeedbackIconButton
                      icon={<Download />}
                      tooltip="Download file"
                      onClick={handleDownload}
                      color="success"
                      feedbackState={downloadFeedback}
                      sx={{
                        bgcolor: 'success.main',
                        color: 'success.contrastText',
                        p: { xs: 0.75, sm: 1 },
                        boxShadow: 2
                      }}
                    />
                  </Box>
                </Box>
              </CardActions>
            )}
          </Card>
        </motion.div>

        {/* Video Modal for non-Android */}
        {showPlayerFor === mediaInfo.id && Capacitor.getPlatform() !== "android" && (
          <VideoModal
            url={mediaInfo.streamUrl}
            title={mediaInfo.general?.fileName}
            onExit={() => setShowPlayerFor(null)}
          />
        )}
      </Grid>

      {/* Player Selection Dialog */}
      <PlayerSelectionDialog
        open={playerDialogOpen}
        onClose={() => setPlayerDialogOpen(false)}
        mediaInfo={mediaInfo}
        onPlayerSelect={(playerType, mediaInfo) => {
          //console.log(`User selected ${playerType} for`, mediaInfo);
        }}
      />

      {/* Feedback Animation Components */}
      <AnimatePresence>
        {(copyStreamFeedback || copyDownloadFeedback || downloadFeedback) && (
          <>
            {/* Success/Error Toast Indicators */}
            {copyStreamFeedback && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -20 }}
                style={{
                  position: 'fixed',
                  top: 20,
                  right: 20,
                  zIndex: 9999,
                }}
              >
                <Chip
                  icon={copyStreamFeedback === 'success' ? <Check /> : <Error />}
                  label={copyStreamFeedback === 'success' ? 'Stream URL copied!' : 'Copy failed'}
                  color={copyStreamFeedback === 'success' ? 'success' : 'error'}
                  variant="filled"
                  sx={{ boxShadow: 3 }}
                />
              </motion.div>
            )}

            {copyDownloadFeedback && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -20 }}
                style={{
                  position: 'fixed',
                  top: 70,
                  right: 20,
                  zIndex: 9999,
                }}
              >
                <Chip
                  icon={copyDownloadFeedback === 'success' ? <Check /> : <Error />}
                  label={copyDownloadFeedback === 'success' ? 'Download URL copied!' : 'Copy failed'}
                  color={copyDownloadFeedback === 'success' ? 'success' : 'error'}
                  variant="filled"
                  sx={{ boxShadow: 3 }}
                />
              </motion.div>
            )}

            {downloadFeedback && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -20 }}
                style={{
                  position: 'fixed',
                  top: 120,
                  right: 20,
                  zIndex: 9999,
                }}
              >
                <Chip
                  icon={downloadFeedback === 'success' ? <Check /> : <Error />}
                  label={downloadFeedback === 'success' ? 'Download started!' : 'Download failed'}
                  color={downloadFeedback === 'success' ? 'success' : 'error'}
                  variant="filled"
                  sx={{ boxShadow: 3 }}
                />
              </motion.div>
            )}
          </>
        )}


        {showHLSPlayer && selectedHLSStream && (
          <HLSVideoPlayer
            src={selectedHLSStream.masterPlaylistUrl}
            title={selectedHLSStream.title}
            onClose={() => {
              setShowHLSPlayer(false);
              setSelectedHLSStream(null);
            }}
            autoPlay={true}
          />
        )}
        <HLSPlayerOptions
          open={showStreamOptions}
          onClose={() => setShowStreamOptions(false)}
          mediaInfo={mediaInfo}
          onStreamSelected={(type, mediaInfo) => {
            if (type === 'hls') {
              setShowHLSPlayer(true);
            }
          }}
        />

      </AnimatePresence>
    </>
  );
};