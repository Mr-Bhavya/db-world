import React, { useState, useEffect, useMemo } from "react";
import {
  Container,
  Grid,
  Box,
  Typography,
  Chip,
  Tabs,
  Tab,
  Button,
  useTheme,
  alpha,
  Avatar,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Collapse,
  IconButton,
  useMediaQuery,
  Tooltip,
  Badge,
  Divider
} from "@mui/material";
import {
  ExpandMore,
  ExpandLess,
  ArrowBack,
  HighQuality,
  Movie,
  Tv,
  Download,
  Info
} from "@mui/icons-material";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { loadStreamFileInfoByRecordId } from "../../../ApiServices";
import { MediaInfoRender } from "../MediaFileInfo/MediaInfoRender";
import CommonServices from "../../../CommonServices";
import Constants from "../../../Constants";

const MediaDownloadViewer = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const record = props.record || location.state?.record;
  const showBack = props.showBack ?? true;
  const onBack = props.onBack;

  const [mediaFileList, setMediaFileList] = useState([]);
  const [mediaListLoader, setMediaListLoader] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [expandedSeasons, setExpandedSeasons] = useState(new Set());
  const [expandedQualities, setExpandedQualities] = useState(new Set());

  useEffect(() => {
    if (record?.recordId) {
      setMediaListLoader(true);
      loadStreamFileInfoByRecordId(record.recordId)
        .then((response) => {
          if (response.httpStatusCode === 200) {
            const formatted = CommonServices.convertMediaInfoToCustomFormat(null, response.data);
            setMediaFileList(formatted);
          }
        })
        .catch((error) => {
          console.error("Error loading media files:", error);
        })
        .finally(() => {
          setMediaListLoader(false);
        });
    } else {
      navigate(Constants.DB_CINEMA_BROWSE_ROUTE);
    }
  }, [record, navigate]);

  const getQualityAndFormat = useMemo(() => (fileName, videoInfo) => {
    const qualityMatch = fileName.match(/(\d{3,4}p|4K|8K)/i);
    const baseQuality = qualityMatch ? qualityMatch[0] : "Unknown";
    const hdrDetails = videoInfo?.hdrDetails || '';
    const videoFormat = videoInfo?.format || '';
    const isHDR = fileName.includes('HDR') || hdrDetails.includes('HDR');
    const isDV = fileName.includes('DV') || hdrDetails.includes('DV');
    const isH265 = videoFormat.includes('HEVC');
    const isH264 = videoFormat.includes('AVC');
    const isAV1 = videoFormat.includes('AV1');
    const formats = [];

    if (isAV1) formats.push('AV1');
    else if (isH265) formats.push('H265');
    else if (isH264) formats.push('H264');

    if (isDV) formats.push('DV');
    else if (isHDR) formats.push('HDR');

    if (isHDR && isDV) formats.push('HDR+DV');

    return {
      baseQuality,
      fullQuality: baseQuality + (formats.length ? ` (${formats.join(' + ')})` : ''),
      formats,
      isHDR,
      isDV,
      codec: isAV1 ? 'AV1' : isH265 ? 'H265' : isH264 ? 'H264' : 'Unknown'
    };
  }, []);

  const { groupedBySeason, qualityStats } = useMemo(() => {
    if (record?.type?.toLowerCase() !== "series") {
      return { groupedBySeason: {}, qualityStats: {} };
    }

    const stats = {};
    const grouped = mediaFileList.reduce((acc, ep) => {
      const seasonMatch = ep?.general?.fileName?.match(/S(\d{2})/i);
      const season = seasonMatch ? seasonMatch[1] : "Unknown";
      const { baseQuality, formats, isHDR, isDV, codec } = getQualityAndFormat(ep.general.fileName, ep.video);

      // Update quality statistics
      if (!stats[baseQuality]) {
        stats[baseQuality] = { count: 0, formats: new Set(), codecs: new Set(), hdr: 0, dv: 0 };
      }
      stats[baseQuality].count++;
      formats.forEach(f => stats[baseQuality].formats.add(f));
      stats[baseQuality].codecs.add(codec);
      if (isHDR) stats[baseQuality].hdr++;
      if (isDV) stats[baseQuality].dv++;

      if (!acc[season]) acc[season] = {
        qualities: {},
        allFormats: new Set(),
        episodeCount: 0
      };

      acc[season].episodeCount++;
      formats.forEach(f => acc[season].allFormats.add(f));

      if (!acc[season].qualities[baseQuality]) {
        acc[season].qualities[baseQuality] = {
          formats: {},
          allFiles: [],
          formatStats: { hdr: 0, dv: 0, codecs: new Set() }
        };
      }

      acc[season].qualities[baseQuality].allFiles.push(ep);
      acc[season].qualities[baseQuality].formatStats.hdr += isHDR ? 1 : 0;
      acc[season].qualities[baseQuality].formatStats.dv += isDV ? 1 : 0;
      acc[season].qualities[baseQuality].formatStats.codecs.add(codec);

      if (formats.length > 0) {
        const key = formats.join('+');
        if (!acc[season].qualities[baseQuality].formats[key]) {
          acc[season].qualities[baseQuality].formats[key] = [];
        }
        acc[season].qualities[baseQuality].formats[key].push(ep);
      }
      return acc;
    }, {});

    return { groupedBySeason: grouped, qualityStats: stats };
  }, [mediaFileList, record?.type, getQualityAndFormat]);

  const toggleSeason = (season) => {
    setExpandedSeasons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(season)) {
        newSet.delete(season);
      } else {
        newSet.add(season);
      }
      return newSet;
    });
  };

  const toggleQuality = (season, quality) => {
    const key = `${season}-${quality}`;
    setExpandedQualities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const QualityChip = ({ quality, count, size = "small" }) => {
    return (
      <Chip
        size={size}
        variant="outlined"
        icon={<HighQuality />}
        label={
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              pl: 0.5,
            }}
          >
            <span>{quality}</span>

            {/* BADGE FIXED – perfectly aligned */}
            <Badge
              badgeContent={count}
              color="primary"
              sx={{
                paddingLeft: 0.5,
                "& .MuiBadge-badge": {
                  fontSize: "0.65rem",
                  height: "16px",
                  minWidth: "16px",
                  lineHeight: "16px",
                  borderRadius: "50%",
                },
                position: "relative",
                top: "-1px", // fine tune vertical alignment
              }}
            />
          </Box>
        }
        sx={{
          borderColor: theme.palette.primary.main,
          color: theme.palette.primary.main,
          bgcolor: alpha(theme.palette.primary.main, 0.1),
          fontWeight: 600,
          p:1,
          // Prevent icon from squishing content
          "& .MuiChip-icon": {
            fontSize: size === "small" ? "16px" : "20px",
            ml: "-2px",
          },

        // FIX: allow label to fully expand
        "& .MuiChip-label": {
            display: "flex",
            alignItems: "center",
            px: 1,
          },
        }}
      />
    );
  };

  const RenderQualityGroup = ({ season, quality, qualityData }) => {
    const formatKeys = Object.keys(qualityData.formats);
    const qualityKey = `${season}-${quality}`;
    const isExpanded = expandedQualities.has(qualityKey);

    if (formatKeys.length <= 1) {
      return (
        <Grid container spacing={2}>
          {qualityData.allFiles.map((ep, idx) => (
            <Grid item xs={12} sm={6} lg={4} key={idx}>
              <MediaInfoRender mediaInfo={ep} />
            </Grid>
          ))}
        </Grid>
      );
    }

    return (
      <Box sx={{ width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant={isMobile ? "scrollable" : "standard"}
            scrollButtons={isMobile ? "auto" : false}
            sx={{
              '& .MuiTabs-indicator': { backgroundColor: theme.palette.primary.main },
              '& .MuiTab-root': {
                color: theme.palette.text.secondary,
                minWidth: 'auto',
                px: 2
              },
              '& .Mui-selected': { color: theme.palette.primary.main }
            }}
          >
            {formatKeys.map((formatKey, index) => (
              <Tab
                key={formatKey}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {formatKey}
                    <Chip
                      label={qualityData.formats[formatKey].length}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        bgcolor: activeTab === index
                          ? alpha(theme.palette.primary.main, 0.2)
                          : alpha(theme.palette.text.secondary, 0.1),
                        color: activeTab === index ? theme.palette.primary.main : theme.palette.text.secondary
                      }}
                    />
                  </Box>
                }
                sx={{ textTransform: 'none', minHeight: 'auto', py: 1 }}
              />
            ))}
          </Tabs>

          <Tooltip title={isExpanded ? "Collapse" : "Expand"}>
            <IconButton
              size="small"
              onClick={() => toggleQuality(season, quality)}
              sx={{
                color: theme.palette.primary.main,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.2)
                }
              }}
            >
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Tooltip>
        </Box>

        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <Grid container spacing={2}>
            {qualityData.formats[formatKeys[activeTab]]?.map((ep, idx) => (
              <Grid item xs={12} sm={6} lg={4} key={idx}>
                <MediaInfoRender mediaInfo={ep} />
              </Grid>
            ))}
          </Grid>
        </Collapse>
      </Box>
    );
  };

  const RenderSeries = () => {
    const seasons = Object.keys(groupedBySeason).sort();

    return seasons.map((season) => {
      const seasonData = groupedBySeason[season];
      const qualityKeys = Object.keys(seasonData.qualities).sort((a, b) => {
        const order = ['8K', '4K', '2160p', '1440p', '1080p', '720p', '480p'];
        return order.indexOf(b) - order.indexOf(a);
      });
      const isSeasonExpanded = expandedSeasons.has(season);

      return (
        <Grid item xs={12} key={season}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card
              sx={{
                mb: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleSeason(season)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Tv color="primary" />
                    <Typography variant="h6" sx={{ color: theme.palette.text.primary }}>
                      Season {parseInt(season, 10)}
                    </Typography>
                    <Chip
                      label={`${seasonData.episodeCount} episodes`}
                      size="small"
                      variant="outlined"
                    />
                    {/* <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {qualityKeys.map(quality => (
                        <QualityChip
                          key={quality}
                          quality={quality}
                          count={seasonData.qualities[quality].allFiles.length}
                        />
                      ))}
                    </Box> */}
                  </Box>
                  <IconButton size="small">
                    {isSeasonExpanded ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Box>

                <Collapse in={isSeasonExpanded} timeout="auto">
                  <Divider sx={{ my: 2 }} />
                  {qualityKeys.map(quality => (
                    <motion.div
                      key={quality}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                    >
                      <Box sx={{ mb: 4 }}>
                        <Box sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          mb: 2,
                          flexWrap: 'wrap'
                        }}>
                          <Typography variant="subtitle1" sx={{
                            fontWeight: 600,
                            color: theme.palette.text.primary,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                          }}>
                            <HighQuality />
                            {quality}
                          </Typography>
                          <Chip
                            label={`${seasonData.qualities[quality].allFiles.length} files`}
                            size="small"
                            sx={{ bgcolor: theme.palette.grey[900] }}
                          />
                          {seasonData.qualities[quality].formatStats.hdr > 0 && (
                            <Chip label="HDR" size="small" color="warning" variant="outlined" />
                          )}
                          {seasonData.qualities[quality].formatStats.dv > 0 && (
                            <Chip label="Dolby Vision" size="small" color="success" variant="outlined" />
                          )}
                        </Box>
                        <RenderQualityGroup
                          season={season}
                          quality={quality}
                          qualityData={seasonData.qualities[quality]}
                        />
                      </Box>
                    </motion.div>
                  ))}
                </Collapse>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      );
    });
  };

  const RenderMovie = () => (
    <Grid container spacing={2}>
      {mediaFileList.map((mediaInfo, idx) => (
        <Grid item xs={12} sm={6} lg={4} key={idx}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            style={{ height: '100%' }}
          >
            <MediaInfoRender mediaInfo={mediaInfo} />
          </motion.div>
        </Grid>
      ))}
    </Grid>
  );

  return (
    <Box sx={{
      backgroundColor: theme.palette.background.default,
      minHeight: '100vh',
      color: theme.palette.text.primary,
      py: { xs: 2, sm: 3 }
    }}>
      <Container maxWidth="xl">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, mb: 4, flexDirection: { xs: 'column', md: 'row' } }}>
            {showBack && (
              <Button
                variant="outlined"
                onClick={() => (onBack ? onBack() : navigate(-1))}
                startIcon={<ArrowBack />}
                sx={{
                  borderColor: theme.palette.primary.main,
                  color: theme.palette.primary.main,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1)
                  },
                  flexShrink: 0
                }}
              >
                Back
              </Button>
            )}

            <Box sx={{ display: 'flex', gap: 3, flex: 1, width: '100%', flexDirection: { xs: 'column', sm: 'row' } }}>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Avatar
                  src={`https://image.tmdb.org/t/p/w300${record?.tmdb?.poster_path || record?.tmdb?.backdrop_path}`}
                  alt={record?.tmdb?.title}
                  variant="rounded"
                  sx={{
                    width: { xs: 120, sm: 150, md: 200 },
                    height: { xs: 180, sm: 225, md: 300 },
                    boxShadow: `0 0 20px ${alpha(theme.palette.primary.main, 0.3)}`
                  }}
                />
              </motion.div>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h4" sx={{
                  color: theme.palette.text.primary,
                  mb: 1,
                  fontSize: { xs: '1.75rem', sm: '2.125rem' },
                  wordBreak: 'break-word'
                }}>
                  {record?.tmdb?.title}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                  <Chip
                    icon={record?.type?.toLowerCase() === "series" ? <Tv /> : <Movie />}
                    label={record?.type || "Movie"}
                    color="primary"
                    variant="outlined"
                  />
                  {record?.tmdb?.release_date && (
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                      {new Date(record.tmdb.release_date).getFullYear()}
                    </Typography>
                  )}
                </Box>

                {record?.tmdb?.overview && (
                  <Typography variant="body1" sx={{
                    color: theme.palette.text.secondary,
                    lineHeight: 1.6,
                    mb: 2
                  }}>
                    {record.tmdb.overview}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        </motion.div>

        {/* Content Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 3,
            flexWrap: 'wrap'
          }}>
            <Download color="primary" />
            <Typography variant="h5" sx={{
              color: theme.palette.text.primary,
              fontSize: { xs: '1.5rem', sm: '1.75rem' }
            }}>
              Available Files
            </Typography>
            <Chip
              label={`${mediaFileList.length} total files`}
              color="primary"
              variant="filled"
            />
          </Box>

          {mediaListLoader ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 8 }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <CircularProgress
                  thickness={4}
                  size={60}
                  sx={{ color: theme.palette.primary.main }}
                />
              </motion.div>
            </Box>
          ) : mediaFileList.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Alert
                severity="info"
                sx={{
                  my: 5,
                  backgroundColor: alpha(theme.palette.info.main, 0.1),
                  color: theme.palette.info.contrastText
                }}
              >
                No media files available for download
              </Alert>
            </motion.div>
          ) : (
            <AnimatePresence>
              {record?.type?.toLowerCase() === "series" ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  {/* <QualityOverview /> */}
                  <Grid container spacing={2}>
                    <RenderSeries />
                  </Grid>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <RenderMovie />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </motion.div>
      </Container>
    </Box>
  );
};

export default MediaDownloadViewer;