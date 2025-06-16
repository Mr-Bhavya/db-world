import React, { useState } from "react";
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
  alpha
} from "@mui/material";
import { toast } from "react-toastify";
import { Capacitor } from "@capacitor/core";
import { motion } from "framer-motion";
import {
  ExpandMore,
  PlayArrow,
  ContentCopy,
  ChevronRight
} from "@mui/icons-material";
import DownloadButton from "./DownloadButton";
import AndroidPlugins from "../../../../android-app-components/AndroidPlugins";
import VideoModal from "./VideoModal";
import CommonServices from "../../../CommonServices";
import Constants from "../../../Constants";

const MediaCard = ({ mediaFileList, type }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));

  const [expandedCards, setExpandedCards] = useState({});
  const [expandedSeasons, setExpandedSeasons] = useState({});
  const [showPlayerFor, setShowPlayerFor] = useState(null);

  const toggleCard = (id) =>
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleSeason = (seasonId) =>
    setExpandedSeasons((prev) => ({ ...prev, [seasonId]: !prev[seasonId] }));

  const handlePlay = async (streamUrl, id) => {
    if (!streamUrl) return Constants.showToast.error("Stream URL is not available.");

    if (Capacitor.getPlatform() === "android") {
      try {
        await AndroidPlugins.MyMedia3Player.playVideo({ url: streamUrl });
      } catch (error) {
        Constants.showToast.error("Error playing video");
        console.error("Android playVideo error:", error);
      }
    } else {
      setShowPlayerFor(id);
    }
  };

  const handleCopy = (text, label) => {
    const result = CommonServices.handleCopy(text);
    if (result.success) {
      Constants.showToast.success(`${label} copied to clipboard`);
    } else {
      Constants.showToast.error(result.message);
    }

  };

  const groupedEpisodes = mediaFileList.reduce((acc, ep) => {
    const match = ep?.general?.fileName?.match(/S(\d{2})/i);
    const season = match ? match[1] : "Unknown";
    acc[season] = acc[season] || [];
    acc[season].push(ep);
    return acc;
  }, {});

  const renderDetails = (mediaInfo) => (
    <Grid
      item
      xs={12}
      sm={6}
      md={4}
      lg={3}
      key={mediaInfo.id}
      sx={{ display: "flex" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ width: '100%' }}
      >
        <Card
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            bgcolor: theme.palette.mode === 'dark' ?
              alpha(theme.palette.background.paper, 0.8) :
              theme.palette.background.paper,
            boxShadow: theme.shadows[2],
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            width: '100%',
            transition: 'all 0.3s ease',
            '&:hover': {
              boxShadow: theme.shadows[4],
              borderColor: theme.palette.primary.main
            }
          }}
        >
          <CardHeader
            sx={{
              px: 2,
              py: 1,
              bgcolor: theme.palette.mode === 'dark' ?
                alpha(theme.palette.background.default, 0.5) :
                theme.palette.grey[100],
              borderBottom: expandedCards[mediaInfo.id] ?
                `1px solid ${theme.palette.divider}` :
                "none",
              '&:hover': {
                bgcolor: theme.palette.mode === 'dark' ?
                  alpha(theme.palette.primary.main, 0.1) :
                  theme.palette.action.hover
              },
              cursor: 'pointer'
            }}
            title={
              <Box
                onClick={() => toggleCard(mediaInfo.id)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                  width: '100%'
                }}
              >
                <Typography
                  variant="subtitle2"
                  title={mediaInfo.general.fileName}
                  sx={{
                    fontWeight: 600,
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: isMobile ? 2 : 1,
                    WebkitBoxOrient: "vertical",
                    whiteSpace: "normal",
                    lineHeight: 1.3,
                    color: theme.palette.text.primary
                  }}
                >
                  {mediaInfo.general.fileName.replace(/[._]/g, " ")}
                </Typography>

                <IconButton
                  size="small"
                  sx={{
                    transform: expandedCards[mediaInfo.id] ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.3s ease",
                    color: theme.palette.text.secondary,
                    flexShrink: 0,
                    '&:hover': {
                      bgcolor: 'transparent',
                      color: theme.palette.primary.main
                    }
                  }}
                >
                  <ExpandMore fontSize="small" />
                </IconButton>
              </Box>
            }
          />

          <Collapse in={expandedCards[mediaInfo.id]} timeout="auto" unmountOnExit>
            <CardContent sx={{ py: 1, px: 2 }}>
              <Grid container spacing={1}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>Size:</Box> {mediaInfo.general.fileSize}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>Duration:</Box> {mediaInfo.general.duration} sec
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>Bitrate:</Box> {mediaInfo.general.overallBitrate}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="primary" sx={{ mb: 0.5 }}>Video</Typography>
                  <Typography variant="body2" color="text.secondary">
                    <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>Resolution:</Box> {mediaInfo.video.resolution}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>Format:</Box> {mediaInfo.video.format}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>HDR:</Box> {mediaInfo.video.hdrDetails || "No"}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="primary" sx={{ mb: 0.5 }}>Audio</Typography>
                  {mediaInfo.audio?.slice(0, 5).map((a, i) => (
                    <Typography key={i} variant="body2" color="text.secondary">
                      <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{a.language || `Track ${i + 1}`}:</Box> {a.format}
                    </Typography>
                  ))}
                  {mediaInfo.audio?.length > 5 && (
                    <Typography variant="caption" color="text.secondary">
                      +{mediaInfo.audio.length - 5} more tracks
                    </Typography>
                  )}
                </Grid>
              </Grid>

              {mediaInfo.seasons?.length > 0 && (
                <>
                  <Divider sx={{ my: 1.5, bgcolor: 'divider' }} />
                  <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>Seasons</Typography>
                  {mediaInfo.seasons.map((season) => (
                    <Box key={season.id} mb={1}>
                      <Button
                        fullWidth
                        onClick={() => toggleSeason(season.id)}
                        startIcon={
                          <ChevronRight
                            sx={{
                              transform: expandedSeasons[season.id] ? "rotate(90deg)" : "rotate(0deg)",
                              transition: "transform 0.3s",
                              color: 'text.secondary'
                            }}
                          />
                        }
                        sx={{
                          justifyContent: "flex-start",
                          textTransform: "none",
                          color: 'text.secondary',
                          px: 1,
                          '&:hover': {
                            bgcolor: theme.palette.mode === 'dark' ?
                              alpha(theme.palette.primary.main, 0.1) :
                              theme.palette.action.hover
                          }
                        }}
                      >
                        {season.name}
                      </Button>
                      <Collapse in={expandedSeasons[season.id]}>
                        <Box pl={3}>
                          {season.episodes.map((ep) => (
                            <Typography
                              key={ep.id}
                              variant="body2"
                              color="text.secondary"
                              mb={0.5}
                              sx={{
                                '&:hover': {
                                  color: 'text.primary'
                                }
                              }}
                            >
                              {ep.number}. {ep.title}
                            </Typography>
                          ))}
                        </Box>
                      </Collapse>
                    </Box>
                  ))}
                </>
              )}

              {mediaInfo.subtitle?.length > 0 && (
                <>
                  <Divider sx={{ my: 1.5, bgcolor: 'divider' }} />
                  <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>Subtitles</Typography>
                  <Grid container spacing={1}>
                    {mediaInfo.subtitle.slice(0, 4).map((sub, i) => (
                      <Grid item xs={6} sm={3} key={i}>
                        <Typography variant="body2" color="text.secondary">
                          <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{sub.language || `Sub ${i + 1}`}:</Box> {sub.format}
                        </Typography>
                      </Grid>
                    ))}
                  </Grid>
                  {mediaInfo.subtitle.length > 4 && (
                    <Typography variant="caption" color="text.secondary">
                      +{mediaInfo.subtitle.length - 4} more
                    </Typography>
                  )}
                </>
              )}
            </CardContent>
          </Collapse>

          <CardActions
            sx={{
              justifyContent: "space-between",
              px: 2,
              py: 1,
              bgcolor: theme.palette.mode === 'dark' ?
                alpha(theme.palette.background.default, 0.3) :
                theme.palette.grey[100],
              borderTop: `1px solid ${theme.palette.divider}`
            }}
          >

            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<PlayArrow />}
                onClick={() => handlePlay(mediaInfo.streamUrl, mediaInfo.id)}
              // sx={{
              //   minWidth: isMobile ? 'auto' : 120,
              //   px: isMobile ? 1 : 2,
              //   '& .MuiButton-startIcon': {
              //     mr: isMobile ? 0 : 0.5
              //   }
              // }}
              >
                Play
                {/* {isMobile ? <PlayArrow fontSize="small" /> : "Play"} */}
              </Button>

              <IconButton
                onClick={() => handleCopy(mediaInfo.streamUrl, "Stream URL")}
                size="small"
                sx={{
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    color: theme.palette.primary.main,
                    bgcolor: 'transparent'
                  }
                }}
              >
                <ContentCopy fontSize="small" />
              </IconButton>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <DownloadButton
                downloadUrl={mediaInfo.downloadUrl}
                fileName={mediaInfo.general.fileName}
                sx={{
                  mx: 0.5,
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    color: theme.palette.primary.main
                  }
                }}
              />
              <IconButton
                onClick={() => handleCopy(mediaInfo.downloadUrl, "Download URL")}
                size="small"
                sx={{
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    color: theme.palette.primary.main,
                    bgcolor: 'transparent'
                  }
                }}
              >
                <ContentCopy fontSize="small" />
              </IconButton>
            </Box>
          </CardActions>
        </Card>

        {showPlayerFor === mediaInfo.id && Capacitor.getPlatform() !== "android" && (
          <VideoModal
            url={mediaInfo.streamUrl}
            title={mediaInfo.general.fileName}
            onExit={() => setShowPlayerFor(null)}
          />
        )}
      </motion.div>
    </Grid>
  );

  return (
    <Grid container spacing={2}>
      {type === "movie" &&
        mediaFileList.map(mediaInfo => renderDetails(mediaInfo))}

      {type === "series" &&
        Object.keys(groupedEpisodes)
          .sort()
          .map((season) => (
            <Grid item xs={12} key={season}>
              <Typography
                variant="h6"
                sx={{
                  my: 1,
                  pl: 1,
                  position: 'relative',
                  '&:before': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    height: '60%',
                    width: '3px',
                    bgcolor: 'primary.main',
                    borderRadius: '3px'
                  }
                }}
              >
                Season {parseInt(season, 10)}
              </Typography>
              <Grid container spacing={2}>
                {groupedEpisodes[season].map((ep) => renderDetails(ep))}
              </Grid>
            </Grid>
          ))
      }
    </Grid>
  );
};

export default MediaCard;