import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Constants from "../../../Constants";
import {
  Box,
  Button,
  TextField,
  Typography,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  Container,
  IconButton,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  useMediaQuery,
  useTheme,
  AppBar,
  Toolbar,
  Stepper,
  Step,
  StepLabel,
  Avatar,
  LinearProgress,
  Alert,
  Grid,
  Badge,
  Collapse,
  CardHeader
} from "@mui/material";
import { ytDownload, ytInfo, adminSearchRecord } from "../../../ApiServices";
import { toast } from "../../../Toast";
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  Link as LinkIcon,
  Folder as FolderIcon,
  Close as CloseIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  Videocam as VideocamIcon,
  Audiotrack as AudiotrackIcon,
  Title as TitleIcon,
  FormatListBulleted as FormatListIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  HighQuality as HighQualityIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  Info as InfoIcon,
  Check as CheckIcon,
  RadioButtonUnchecked,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Settings as SettingsIcon,
  SkipNext
} from "@mui/icons-material";
import { styled } from "@mui/system";

// Color constants
const PRIMARY_COLOR = "#008080";
const SECONDARY_COLOR = "#20B2AA";
const TEXT_PRIMARY = "#121212";
const TEXT_SECONDARY = "#1e1e1e";
const DARK_BG = "#ffffff";
const LIGHT_BG = "rgba(255, 255, 255, 0.7)";

// Styled Components
const StyledCard = styled(Card)(({ selected }) => ({
  background: LIGHT_BG,
  border: selected ? `2px solid ${PRIMARY_COLOR}` : '1px solid rgba(0, 0, 0, 0.1)',
  borderRadius: '12px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  overflow: 'hidden',
  '&:hover': {
    borderColor: PRIMARY_COLOR,
    background: 'rgba(0, 128, 128, 0.05)',
    transform: 'translateY(-2px)',
  },
  ...(selected && {
    background: 'rgba(0, 128, 128, 0.1)',
    boxShadow: '0 8px 24px rgba(0, 128, 128, 0.2)',
  })
}));

const OptionCard = styled(Card)(({ selected }) => ({
  background: selected ? 'rgba(0, 128, 128, 0.15)' : LIGHT_BG,
  border: selected ? `2px solid ${PRIMARY_COLOR}` : '1px solid rgba(0, 0, 0, 0.1)',
  borderRadius: '12px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  height: '100%',
  '&:hover': {
    background: 'rgba(0, 128, 128, 0.05)',
    borderColor: PRIMARY_COLOR,
  }
}));

// Format Selection Wizard Component
const FormatSelectionWizard = ({ formats, onHandleSubmit, isLoading, onClose, downloadOption, setDownloadOption, rename, setRename, title, setTitle, recordName }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [videoFormats, setVideoFormats] = useState([]);
  const [audioFormats, setAudioFormats] = useState([]);
  const [groupedVideoFormats, setGroupedVideoFormats] = useState({});
  const isAudioStep =
    (downloadOption === 'both' && activeStep === 2) ||
    (downloadOption === 'audio' && activeStep === 1);

  const canSkipAudio =
    isAudioStep &&
    downloadOption === 'both' &&
    !selectedAudio;

  // Filter formats on component mount and when formats prop changes
  useEffect(() => {
    if (!Array.isArray(formats) || formats.length === 0) return;

    //console.log('Total formats received:', formats.length);

    // ✅ VIDEO FORMATS
    // include video-only + muxed (do NOT exclude acodec === 'none')
    const videoFmts = formats.filter(f =>
      f.vcodec && f.vcodec !== 'none' &&
      !f.format_note?.includes('storyboard')
    );

    // ✅ AUDIO FORMATS (true audio-only)
    const audioFmts = formats.filter(f =>
      f.acodec && f.acodec !== 'none' &&
      (!f.vcodec || f.vcodec === 'none')
    );

    //console.log('Video formats:', videoFmts.length, videoFmts.slice(0, 3));
    //console.log('Audio formats:', audioFmts.length, audioFmts.slice(0, 3));

    setVideoFormats(videoFmts);
    setAudioFormats(audioFmts);

    // ✅ GROUP VIDEO FORMATS BY RESOLUTION
    const grouped = videoFmts.reduce((acc, f) => {
      let key = 'Other';

      if (f.height) {
        key = `${f.height}p`;
      } else if (f.width && f.height) {
        key = `${f.width}x${f.height}`;
      }

      if (!acc[key]) acc[key] = [];
      acc[key].push(f);
      return acc;
    }, {});

    //console.log('Grouped video formats:', Object.keys(grouped));
    setGroupedVideoFormats(grouped);

  }, [formats]);

  // Auto-select best audio when user skips audio step
  useEffect(() => {
    if (downloadOption === 'both' && !selectedAudio && audioFormats.length > 0) {
      const best = [...audioFormats].sort(
        (a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0)
      )[0];
      setSelectedAudio(best);
    }
  }, [downloadOption, audioFormats]);


  const handleNext = () => {
    if (activeStep === 0 && downloadOption === 'audio') {
      // Skip video step if audio only
      setActiveStep(2);
    } else {
      setActiveStep((prevStep) => prevStep + 1);
    }
  };

  const handleBack = () => {
    if (activeStep === 2 && downloadOption === 'audio') {
      // Go back to options if audio only
      setActiveStep(0);
    } else {
      setActiveStep((prevStep) => prevStep - 1);
    }
  };

  const toggleGroup = (resolution) => {
    setExpandedGroups(prev => ({
      ...prev,
      [resolution]: !prev[resolution]
    }));
  };

  const handleSubmit = () => {
    //console.log("Submitting with:", { selectedVideo, selectedAudio, downloadOption });

    if (downloadOption === 'both' && !selectedVideo) {
      toast.error("Please select a video format");
      return;
    }
    if (downloadOption === 'audio' && !selectedAudio) {
      toast.error("Please select an audio format");
      return;
    }

    // Get format IDs
    const videoITag = selectedVideo?.format_id;
    const audioITag = selectedAudio?.format_id || null;

    //console.log("Calling onHandleSubmit with:", { videoITag, audioITag });
    onHandleSubmit(videoITag, audioITag);
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return 'N/A';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) {
      return `${mb.toFixed(1)} MB`;
    } else {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
  };

  const formatBitrate = (tbr) => {
    if (!tbr) return 'N/A';
    return `${Math.round(tbr)} kbps`;
  };

  const getQualityLabel = (format) => {
    if (format.format_note) return format.format_note;
    if (format.height >= 1080) return '1080p (HD)';
    if (format.height >= 720) return '720p (HD)';
    if (format.height >= 480) return '480p';
    if (format.height >= 360) return '360p';
    if (format.height >= 240) return '240p';
    if (format.height >= 144) return '144p';
    return 'Unknown';
  };

  const getCodecInfo = (format, type = 'video') => {
    if (type === 'video') {
      return format.vcodec?.replace('avc1.', 'H.264 ').replace('vp9', 'VP9').replace('av01', 'AV1') || 'Unknown';
    } else {
      return format.acodec?.replace('mp4a.40', 'AAC').replace('opus', 'Opus') || 'Unknown';
    }
  };

  // Step 1: Download Options
  const renderDownloadOptions = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Typography
        variant="h6"
        gutterBottom
        sx={{
          color: TEXT_PRIMARY,
          fontWeight: '600',
          mb: 4,
          textAlign: 'center'
        }}
      >
        What would you like to download?
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <OptionCard
            selected={downloadOption === 'both'}
            onClick={() => {
              setDownloadOption('both');
              // Reset selections when changing option
              if (downloadOption !== 'both') {
                setSelectedVideo(null);
                setSelectedAudio(null);
              }
            }}
          >
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <Box sx={{ position: 'relative', height: 40, mb: 2 }}>
                <VideocamIcon
                  sx={{
                    fontSize: 36,
                    color: downloadOption === 'both' ? PRIMARY_COLOR : TEXT_SECONDARY,
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-60%)'
                  }}
                />
                <AudiotrackIcon
                  sx={{
                    fontSize: 28,
                    color: downloadOption === 'both' ? PRIMARY_COLOR : TEXT_SECONDARY,
                    position: 'absolute',
                    right: '50%',
                    transform: 'translateX(60%)',
                    top: 4
                  }}
                />
              </Box>
              <Typography
                variant="subtitle1"
                sx={{
                  color: downloadOption === 'both' ? TEXT_PRIMARY : TEXT_SECONDARY,
                  mb: 1,
                  fontWeight: '500'
                }}
              >
                Video + Audio
              </Typography>
              <Typography variant="caption" sx={{ color: TEXT_SECONDARY, display: 'block' }}>
                Download video with audio (audio optional)
              </Typography>
            </CardContent>
          </OptionCard>
        </Grid>

        <Grid item xs={12} sm={6}>
          <OptionCard
            selected={downloadOption === 'audio'}
            onClick={() => {
              setDownloadOption('audio');
              // Reset selections when changing option
              if (downloadOption !== 'audio') {
                setSelectedVideo(null);
                setSelectedAudio(null);
              }
            }}
          >
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <AudiotrackIcon
                sx={{
                  fontSize: 40,
                  color: downloadOption === 'audio' ? PRIMARY_COLOR : TEXT_SECONDARY,
                  mb: 2
                }}
              />
              <Typography
                variant="subtitle1"
                sx={{
                  color: downloadOption === 'audio' ? TEXT_PRIMARY : TEXT_SECONDARY,
                  mb: 1,
                  fontWeight: '500'
                }}
              >
                Audio Only
              </Typography>
              <Typography variant="caption" sx={{ color: TEXT_SECONDARY, display: 'block' }}>
                Extract and download audio only
              </Typography>
            </CardContent>
          </OptionCard>
        </Grid>
      </Grid>

      {downloadOption === 'both' && (
        <Box sx={{ mb: 3, p: 2, background: 'rgba(0, 128, 128, 0.1)', borderRadius: '8px' }}>
          <Typography sx={{ color: TEXT_PRIMARY, fontSize: '0.9rem' }}>
            Merge audio with video automatically
          </Typography>
        </Box>
      )}

      {/* Rename File Option */}
      <Box sx={{ mb: 3, p: 2, background: 'rgba(0, 128, 128, 0.1)', borderRadius: '8px' }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={rename}
              onChange={(e) => setRename(e.target.checked)}
              sx={{
                color: TEXT_SECONDARY,
                '&.Mui-checked': {
                  color: PRIMARY_COLOR,
                }
              }}
            />
          }
          label={
            <Typography sx={{ color: TEXT_PRIMARY, fontSize: '0.9rem' }}>
              Rename downloaded file
            </Typography>
          }
        />

        {rename && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ color: TEXT_PRIMARY, mb: 1 }}>
              New File Name
            </Typography>
            <TextField
              fullWidth
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  background: LIGHT_BG,
                  color: TEXT_PRIMARY,
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: PRIMARY_COLOR,
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: PRIMARY_COLOR,
                  },
                },
                '& .MuiInputLabel-root': {
                  color: TEXT_SECONDARY,
                }
              }}
            />
          </Box>
        )}
      </Box>

      <Box sx={{ mt: 3, p: 2, background: 'rgba(0, 0, 0, 0.05)', borderRadius: '8px' }}>
        <Typography variant="body2" sx={{ color: TEXT_PRIMARY, mb: 1 }}>
          Destination: <strong>{recordName || 'No record selected'}</strong>
        </Typography>
      </Box>
    </motion.div>
  );

  // Step 2: Video Selection
  const renderVideoSelection = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Typography
        variant="h6"
        gutterBottom
        sx={{
          color: TEXT_PRIMARY,
          fontWeight: '600',
          mb: 2
        }}
      >
        Select Video Format
      </Typography>

      <Typography variant="body1" sx={{ color: TEXT_SECONDARY, mb: 3 }}>
        {videoFormats.length} video formats available
      </Typography>

      {Object.entries(groupedVideoFormats).map(([resolution, formats]) => (
        <Card key={resolution} sx={{ mb: 2, background: LIGHT_BG }}>
          <CardHeader
            title={
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1" sx={{ color: TEXT_PRIMARY, fontWeight: '500' }}>
                  {resolution}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" sx={{ color: TEXT_SECONDARY }}>
                    {formats.length} formats
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => toggleGroup(resolution)}
                    sx={{ color: TEXT_SECONDARY }}
                  >
                    {expandedGroups[resolution] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
              </Box>
            }
            onClick={() => toggleGroup(resolution)}
            sx={{ py: 1, cursor: 'pointer' }}
          />

          <Collapse in={expandedGroups[resolution]}>
            <CardContent sx={{ pt: 0 }}>
              <Grid container spacing={2}>
                {formats.map((format, index) => (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    <StyledCard
                      selected={selectedVideo?.format_id === format.format_id}
                      onClick={() => {
                        setSelectedVideo(prev =>
                          prev?.format_id === format.format_id ? null : format
                        );
                      }}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                          <Chip
                            label={getQualityLabel(format)}
                            size="small"
                            sx={{
                              background: selectedVideo?.format_id === format.format_id
                                ? PRIMARY_COLOR
                                : 'rgba(0, 128, 128, 0.2)',
                              color: selectedVideo?.format_id === format.format_id
                                ? 'white'
                                : TEXT_PRIMARY,
                              fontWeight: '500',
                              fontSize: '0.75rem'
                            }}
                          />
                          {selectedVideo?.format_id === format.format_id && (
                            <CheckIcon sx={{ color: PRIMARY_COLOR, fontSize: 20 }} />
                          )}
                        </Box>

                        <Box sx={{ mb: 1 }}>
                          <Typography variant="body2" sx={{ color: TEXT_PRIMARY }}>
                            {getCodecInfo(format, 'video')}
                          </Typography>
                          <Typography variant="caption" sx={{ color: TEXT_SECONDARY }}>
                            ID: {format.format_id} | .{format.ext}
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <StorageIcon fontSize="small" sx={{ color: TEXT_SECONDARY }} />
                            <Typography variant="caption" sx={{ color: TEXT_PRIMARY }}>
                              {formatSize(format.filesize)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SpeedIcon fontSize="small" sx={{ color: TEXT_SECONDARY }} />
                            <Typography variant="caption" sx={{ color: TEXT_PRIMARY }}>
                              {formatBitrate(format.tbr)}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </StyledCard>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Collapse>
        </Card>
      ))}

      {videoFormats.length === 0 && (
        <Alert
          severity="info"
          sx={{
            background: 'rgba(0, 128, 128, 0.1)',
            border: '1px solid rgba(0, 128, 128, 0.3)',
            color: TEXT_PRIMARY,
            borderRadius: '8px',
            mb: 3
          }}
        >
          No video formats available.
        </Alert>
      )}
    </motion.div>
  );

  // Step 3: Audio Selection
  const renderAudioSelection = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Typography
        variant="h6"
        gutterBottom
        sx={{
          color: TEXT_PRIMARY,
          fontWeight: '600',
          mb: 2
        }}
      >
        Select Audio Format
      </Typography>

      <Typography variant="body1" sx={{ color: TEXT_SECONDARY, mb: 3 }}>
        {audioFormats.length} audio formats available
      </Typography>

      {audioFormats.length > 0 ? (
        <Grid container spacing={2}>
          {audioFormats.map((format, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <StyledCard
                selected={selectedAudio?.format_id === format.format_id}
                onClick={() => {
                  setSelectedAudio(prev =>
                    prev?.format_id === format.format_id ? null : format
                  );
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Chip
                      label={format.format_note || 'Audio'}
                      size="small"
                      sx={{
                        background: selectedAudio?.format_id === format.format_id
                          ? PRIMARY_COLOR
                          : 'rgba(0, 128, 128, 0.2)',
                        color: selectedAudio?.format_id === format.format_id
                          ? 'white'
                          : TEXT_PRIMARY,
                        fontWeight: '500',
                        fontSize: '0.75rem'
                      }}
                    />
                    {selectedAudio?.format_id === format.format_id && (
                      <CheckIcon sx={{ color: PRIMARY_COLOR, fontSize: 20 }} />
                    )}
                  </Box>

                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" sx={{ color: TEXT_PRIMARY }}>
                      {getCodecInfo(format, 'audio')}
                    </Typography>
                    <Typography variant="caption" sx={{ color: TEXT_SECONDARY }}>
                      ID: {format.format_id} | .{format.ext}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StorageIcon fontSize="small" sx={{ color: TEXT_SECONDARY }} />
                      <Typography variant="caption" sx={{ color: TEXT_PRIMARY }}>
                        {formatSize(format.filesize)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AudiotrackIcon fontSize="small" sx={{ color: TEXT_SECONDARY }} />
                      <Typography variant="caption" sx={{ color: TEXT_PRIMARY }}>
                        {formatBitrate(format.abr || format.tbr)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </StyledCard>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert
          severity="info"
          sx={{
            background: 'rgba(0, 128, 128, 0.1)',
            border: '1px solid rgba(0, 128, 128, 0.3)',
            color: TEXT_PRIMARY,
            borderRadius: '8px',
            mb: 3
          }}
        >
          No separate audio formats found. The video might use merged audio streams.
          {downloadOption === 'both' && " The selected video format will include audio."}
        </Alert>
      )}
    </motion.div>
  );

  // Step 4: Summary
  const renderSummary = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Typography
        variant="h6"
        gutterBottom
        sx={{
          color: TEXT_PRIMARY,
          fontWeight: '600',
          mb: 4,
          textAlign: 'center'
        }}
      >
        Download Summary
      </Typography>

      <Grid container spacing={2}>
        {/* Download Type */}
        <Grid item xs={12}>
          <Card sx={{ background: LIGHT_BG }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ color: TEXT_PRIMARY, mb: 2, fontWeight: '500' }}>
                Download Type
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {downloadOption === 'both' && (
                  <>
                    <VideocamIcon sx={{ color: PRIMARY_COLOR }} />
                    <AudiotrackIcon sx={{ color: PRIMARY_COLOR }} />
                    <Typography sx={{ color: TEXT_PRIMARY }}>
                      {"Video + Audio (Merged)"}
                    </Typography>
                  </>
                )}
                {downloadOption === 'audio' && (
                  <>
                    <AudiotrackIcon sx={{ color: PRIMARY_COLOR }} />
                    <Typography sx={{ color: TEXT_PRIMARY }}>Audio Only</Typography>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Video Summary */}
        {downloadOption === 'both' && (
          <Grid item xs={12} md={6}>
            <Card sx={{ background: LIGHT_BG, height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ color: TEXT_PRIMARY, mb: 2, fontWeight: '500' }}>
                  Video Format
                </Typography>
                {selectedVideo ? (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar sx={{ bgcolor: 'rgba(0, 128, 128, 0.2)', color: PRIMARY_COLOR }}>
                        <VideocamIcon />
                      </Avatar>
                      <Box>
                        <Typography sx={{ color: TEXT_PRIMARY, fontWeight: '500' }}>
                          {getQualityLabel(selectedVideo)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: TEXT_SECONDARY }}>
                          ID: {selectedVideo.format_id} | {selectedVideo.resolution}
                        </Typography>
                      </Box>
                    </Box>
                    <Divider sx={{ my: 2, borderColor: 'rgba(0, 0, 0, 0.1)' }} />
                    <Box sx={{ '& > div': { mb: 1 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ color: TEXT_SECONDARY }}>Codec:</Typography>
                        <Typography variant="body2" sx={{ color: TEXT_PRIMARY }}>{getCodecInfo(selectedVideo, 'video')}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ color: TEXT_SECONDARY }}>Size:</Typography>
                        <Typography variant="body2" sx={{ color: TEXT_PRIMARY }}>{formatSize(selectedVideo.filesize)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ color: TEXT_SECONDARY }}>Bitrate:</Typography>
                        <Typography variant="body2" sx={{ color: TEXT_PRIMARY }}>{formatBitrate(selectedVideo.tbr)}</Typography>
                      </Box>
                    </Box>
                  </>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography sx={{ color: TEXT_SECONDARY }}>No video selected</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Audio Summary */}
        {(downloadOption === 'audio' || downloadOption === 'both') && (
          <Grid item xs={12} md={downloadOption === 'both' ? 6 : 12}>
            <Card sx={{ background: LIGHT_BG, height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ color: TEXT_PRIMARY, mb: 2, fontWeight: '500' }}>
                  {downloadOption === 'both' ? 'Audio Format' : 'Selected Audio Format'}
                </Typography>
                {selectedAudio ? (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar sx={{ bgcolor: 'rgba(0, 128, 128, 0.2)', color: PRIMARY_COLOR }}>
                        <AudiotrackIcon />
                      </Avatar>
                      <Box>
                        <Typography sx={{ color: TEXT_PRIMARY, fontWeight: '500' }}>
                          {selectedAudio.format_note || 'Audio'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: TEXT_SECONDARY }}>
                          ID: {selectedAudio.format_id} | .{selectedAudio.ext}
                        </Typography>
                      </Box>
                    </Box>
                    <Divider sx={{ my: 2, borderColor: 'rgba(0, 0, 0, 0.1)' }} />
                    <Box sx={{ '& > div': { mb: 1 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ color: TEXT_SECONDARY }}>Codec:</Typography>
                        <Typography variant="body2" sx={{ color: TEXT_PRIMARY }}>{getCodecInfo(selectedAudio, 'audio')}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ color: TEXT_SECONDARY }}>Size:</Typography>
                        <Typography variant="body2" sx={{ color: TEXT_PRIMARY }}>{formatSize(selectedAudio.filesize)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ color: TEXT_SECONDARY }}>Bitrate:</Typography>
                        <Typography variant="body2" sx={{ color: TEXT_PRIMARY }}>{formatBitrate(selectedAudio.abr || selectedAudio.tbr)}</Typography>
                      </Box>
                    </Box>
                  </>
                ) : downloadOption === 'both' ? (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography sx={{ color: TEXT_SECONDARY }}>
                      {selectedVideo
                        ? "Audio will be automatically merged with video"
                        : "Select audio format (optional)"}
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography sx={{ color: TEXT_SECONDARY }}>Please select an audio format</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* File Name */}
        <Grid item xs={12}>
          <Card sx={{ background: LIGHT_BG }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ color: TEXT_PRIMARY, mb: 1, fontWeight: '500' }}>
                File Name
              </Typography>
              <Typography sx={{ color: TEXT_PRIMARY, wordBreak: 'break-all' }}>
                {title || 'Using original title'}
              </Typography>
              <Typography variant="caption" sx={{ color: TEXT_SECONDARY, display: 'block', mt: 1 }}>
                Destination: {recordName || 'No record selected'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </motion.div>
  );

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return renderDownloadOptions();
      case 1:
        return downloadOption === 'both' ? renderVideoSelection() : renderAudioSelection();
      case 2:
        return downloadOption === 'both' ? renderAudioSelection() : renderSummary();
      case 3:
        return renderSummary();
      default:
        return null;
    }
  };

  const isStepValid = () => {
    switch (activeStep) {
      case 0:
        return !!downloadOption;
      case 1:
        if (downloadOption === 'both') {
          return !!selectedVideo;
        } else {
          return !!selectedAudio;
        }
      case 2:
        if (downloadOption === 'both') {
          return true; // Audio is optional for Video+Audio
        } else {
          return true; // Summary step
        }
      case 3:
        return true; // Summary step is always valid
      default:
        return false;
    }
  };

  const getSteps = () => {
    if (downloadOption === 'audio') {
      return ['Download Options', 'Audio Format', 'Summary'];
    } else {
      return ['Download Options', 'Video Format', 'Audio Format', 'Summary'];
    }
  };

  const steps = getSteps();
  const isLastStep = activeStep === steps.length - 1;

  return (
    <Box sx={{
      width: '100%',
      height: '100%',
      backgroundColor: DARK_BG,
      display: 'flex',
      flexDirection: 'column',
      // overflow: 'hidden'
    }}>
      {/* Stepper - Fixed at top */}
      <Box sx={{
        flexShrink: 0,
        p: 2,
        pb: 0
      }}>
        <Stepper
          activeStep={activeStep}
          alternativeLabel
          sx={{
            mb: 3,
            '& .MuiStepLabel-root .Mui-active': {
              color: PRIMARY_COLOR,
            },
            '& .MuiStepLabel-root .Mui-completed': {
              color: PRIMARY_COLOR,
            },
            '& .MuiStepLabel-label': {
              color: TEXT_SECONDARY,
              fontSize: '0.8rem',
            },
            '& .MuiStepConnector-line': {
              borderColor: 'rgba(0, 0, 0, 0.2)',
            }
          }}
        >
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* Step Content - Scrollable Area */}
      <Box sx={{
        flex: 1,
        overflow: 'auto',
        maxHeight: '50vh',
        px: 2,
        mb: 2
      }}>
        {getStepContent(activeStep)}
      </Box>

      {/* Navigation Buttons - Fixed at bottom */}
      <Box sx={{
        flexShrink: 0,
        p: 2,
        pt: 1,
        borderTop: '1px solid rgba(0, 0, 0, 0.1)'
      }}>
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2
        }}>
          <Button
            variant="outlined"
            onClick={handleBack}
            disabled={activeStep === 0 || isLoading}
            startIcon={<ArrowBackIcon />}
            sx={{
              color: TEXT_PRIMARY,
              borderColor: 'rgba(0, 0, 0, 0.3)',
              '&:hover': {
                borderColor: PRIMARY_COLOR,
                background: 'rgba(0, 128, 128, 0.1)'
              }
            }}
          >
            Back
          </Button>

          {isLastStep ? (
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!isStepValid() || isLoading}
              startIcon={isLoading ? null : <DownloadIcon />}
              sx={{
                background: PRIMARY_COLOR,
                color: 'white',
                fontWeight: '600',
                px: 4,
                '&:hover': {
                  background: SECONDARY_COLOR,
                },
                '&:disabled': {
                  background: 'rgba(0, 0, 0, 0.1)',
                  color: TEXT_SECONDARY
                }
              }}
            >
              {isLoading ? 'Processing...' : 'Start Download'}
            </Button>
          ) : canSkipAudio ? (
            <Button
              variant="outlined"
              onClick={handleNext}
              endIcon={<SkipNext />}
              sx={{
                color: TEXT_PRIMARY,
                borderColor: PRIMARY_COLOR,
                fontWeight: 600,
              }}
            >
              Skip Audio
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!isStepValid()}
              endIcon={<ArrowForwardIcon />}
              sx={{
                background: PRIMARY_COLOR,
                color: 'white',
                fontWeight: '600',
                px: 4,
                '&:hover': {
                  background: SECONDARY_COLOR,
                },
                '&:disabled': {
                  background: 'rgba(0, 0, 0, 0.1)',
                  color: TEXT_SECONDARY
                }
              }}
            >
              Next
            </Button>
          )}
        </Box>

        {/* Progress Indicator */}
        <Box sx={{ mt: 1 }}>
          <LinearProgress
            variant="determinate"
            value={((activeStep + 1) * 100) / steps.length}
            sx={{
              height: '4px',
              borderRadius: '2px',
              background: 'rgba(0, 0, 0, 0.1)',
              '& .MuiLinearProgress-bar': {
                background: PRIMARY_COLOR,
                borderRadius: '2px'
              }
            }}
          />
          <Typography variant="caption" sx={{
            color: TEXT_SECONDARY,
            display: 'block',
            textAlign: 'center',
            mt: 1
          }}>
            Step {activeStep + 1} of {steps.length}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default FormatSelectionWizard;