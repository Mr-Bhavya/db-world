import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Constants from '@shared/constants';
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
import { ytDownload, ytInfo, adminSearchRecord } from '@shared/services/ApiServices';
import { toast } from '@shared/components/ui/Toast';
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
  Settings as SettingsIcon
} from "@mui/icons-material";
import { styled } from "@mui/system";
import FormatSelectionWizard from "./FormatSelection";

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
  border: selected ? `2px solid ${PRIMARY_COLOR}` : '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '12px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  overflow: 'hidden',
  '&:hover': {
    borderColor: 'rgba(255, 255, 255, 0.2)',
    background: 'rgba(255, 255, 255, 0.05)',
    transform: 'translateY(-2px)',
  },
  ...(selected && {
    background: 'rgba(0, 128, 128, 0.1)',
    boxShadow: '0 8px 24px rgba(0, 128, 128, 0.2)',
  })
}));

const OptionCard = styled(Card)(({ selected }) => ({
  background: selected ? 'rgba(0, 128, 128, 0.15)' : LIGHT_BG,
  border: selected ? `2px solid ${PRIMARY_COLOR}` : '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '12px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  height: '100%',
  '&:hover': {
    background: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  }
}));

function YoutubeDownloader() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [link, setLink] = useState("");
  const [submitLoader, setSubmitLoader] = useState(false);
  const [getDetailsLoader, setGetDetailsLoader] = useState(false);
  const [videoDetails, setVideoDetails] = useState([]);
  const [downloadOption, setDownloadOption] = useState('both'); // 'both' or 'audio'
  const [rename, setRename] = useState(false);
  const [title, setTitle] = useState("");
  const [recordName, setRecordName] = useState("");
  const [recordList, setRecordList] = useState([]);
  const [showRecordDropdown, setShowRecordDropdown] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false);

  const onGetDetail = async () => {
    if (!link) {
      toast.error("Please enter a YouTube URL");
      return;
    }

    setGetDetailsLoader(true);
    try {
      const ytInfoRes = await ytInfo(link);
      if (ytInfoRes.httpStatusCode === 200) {
        const result = ytInfoRes.data;
        // Filter out storyboard formats and sort by quality
        const formats = result.formats
          .filter(format => !format.format_note?.includes('storyboard'))
          .sort((a, b) => {
            const qualityA = a.height || 0;
            const qualityB = b.height || 0;
            return qualityB - qualityA;
          });

        setVideoDetails(formats);
        const generatedTitle = result.series && result?.series !== null || result.season_number && result?.season_number !== null
          ? `${result?.series} S${result.season_number}E${result.episode_number} - ${result.title}`
          : `${result.title}`;
        setTitle(generatedTitle);
        toast.success("Video details loaded successfully");

        // Auto-open format modal on success
        setShowFormatModal(true);
      } else if (ytInfoRes.httpStatusCode === 401) {
        toast.error(ytInfoRes.message + Constants.RE_LOGIN, {
          onClose: () => navigate(Constants.LOGIN_ROUTE, { state: { from: location } }),
          autoClose: 1000
        });
      } else {
        toast.error(ytInfoRes.message);
      }
    } catch (err) {
      toast.error("Failed to fetch video details");
      console.error("Error fetching video details:", err);
    } finally {
      setGetDetailsLoader(false);
    }
  };

  const handleFormatSubmit = async (videoITag, audioITag, mergeAudio = true) => {
    setSubmitLoader(true);
    setShowFormatModal(false);

    try {
      const ytDownloadRes = await ytDownload({
        url: link,
        folderName: recordName,
        fileName: title,
        fileSize: 0,
        videoITag: downloadOption === 'audio' ? null : videoITag,
        audioITag: downloadOption === 'both' ? audioITag : audioITag,
        onlyAudio: downloadOption === 'audio'
      });

      if (ytDownloadRes.httpStatusCode === 200) {
        toast.success(ytDownloadRes.message);
        // Reset form
        setLink("");
        setVideoDetails([]);
        setTitle("");
        setRecordName("");
      } else {
        toast.error(ytDownloadRes.message);
      }
    } catch (err) {
      toast.error("Failed to start download");
      console.error("Download error:", err);
    } finally {
      setSubmitLoader(false);
    }
  };

  const searchDbCinemaRecord = async () => {
    if (recordName.length > 2) {
      try {
        const response = await adminSearchRecord(recordName);
        if (response.httpStatusCode === 200) {
          setRecordList(response.data);
          setShowRecordDropdown(true);
        }
      } catch (err) {
        console.error("Error searching records:", err);
      }
    } else {
      setShowRecordDropdown(false);
    }
  };

  const selectRecord = (record) => {
    setRecordName(`${record.recordId}-${record.name}`);
    setShowRecordDropdown(false);
  };

  const clearForm = () => {
    setLink("");
    setRecordName("");
    setVideoDetails([]);
    setTitle("");
    setDownloadOption('both');
    setRename(false);
    setShowFormatModal(false);
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      if (recordName) {
        searchDbCinemaRecord();
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [recordName]);

  return (
    <Box sx={{
      // minHeight: "100vh",
      backgroundColor: DARK_BG,
      color: TEXT_PRIMARY,
      py: { xs: 2, sm: 3, md: 4 }
    }}>
      <Container maxWidth="md">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            align="center"
            sx={{
              fontWeight: '700',
              mb: 4,
              background: `linear-gradient(90deg, ${PRIMARY_COLOR} 0%, ${SECONDARY_COLOR} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: { xs: '1.8rem', sm: '2.2rem', md: '2.5rem' }
            }}
          >
            YouTube Downloader
          </Typography>
        </motion.div>

        {/* Main Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Paper
            elevation={0}
            sx={{
              background: LIGHT_BG,
              borderRadius: '16px',
              p: { xs: 2, sm: 3, md: 4 },
              mb: 3,
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            {/* Record Selector */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: TEXT_PRIMARY }}>
                <FolderIcon fontSize="small" sx={{ color: PRIMARY_COLOR }} />
                Destination Record
              </Typography>
              <TextField
                fullWidth
                variant="outlined"
                value={recordName}
                onChange={(e) => setRecordName(e.target.value)}
                placeholder="Type to search records..."
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: DARK_BG,
                    color: TEXT_PRIMARY,
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: PRIMARY_COLOR,
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: PRIMARY_COLOR,
                    },
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <SearchIcon sx={{ mr: 1, color: TEXT_SECONDARY }} />
                  ),
                  endAdornment: recordName && (
                    <IconButton size="small" onClick={() => setRecordName("")}>
                      <CloseIcon fontSize="small" sx={{ color: TEXT_SECONDARY }} />
                    </IconButton>
                  )
                }}
              />

              <AnimatePresence>
                {showRecordDropdown && recordList.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <Paper sx={{
                      background: DARK_BG,
                      mt: 1,
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <List disablePadding>
                        {recordList.slice(0, 5).map((item, index) => (
                          <React.Fragment key={item.recordId}>
                            <ListItem
                              button
                              onClick={() => selectRecord(item)}
                              sx={{ py: 1.5 }}
                            >
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography sx={{ color: TEXT_PRIMARY }}>
                                      {item.name}
                                    </Typography>
                                    <Chip
                                      label={item.type}
                                      size="small"
                                      sx={{
                                        fontSize: '0.7rem',
                                        height: '20px',
                                        bgcolor: 'rgba(0, 128, 128, 0.2)',
                                        color: PRIMARY_COLOR
                                      }}
                                    />
                                  </Box>
                                }
                                secondary={`ID: ${item.recordId}`}
                                secondaryTypographyProps={{ variant: 'caption', color: TEXT_SECONDARY }}
                              />
                            </ListItem>
                            {index < recordList.length - 1 && <Divider />}
                          </React.Fragment>
                        ))}
                      </List>
                    </Paper>
                  </motion.div>
                )}
              </AnimatePresence>
            </Box>

            {/* YouTube Link Input */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: TEXT_PRIMARY }}>
                <LinkIcon fontSize="small" sx={{ color: PRIMARY_COLOR }} />
                YouTube Video URL
              </Typography>
              <TextField
                fullWidth
                variant="outlined"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: DARK_BG,
                    color: TEXT_PRIMARY,
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: PRIMARY_COLOR,
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: PRIMARY_COLOR,
                    },
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <VideocamIcon sx={{ mr: 1, color: TEXT_SECONDARY }} />
                  ),
                  endAdornment: link && (
                    <IconButton size="small" onClick={() => setLink("")}>
                      <CloseIcon fontSize="small" sx={{ color: TEXT_SECONDARY }} />
                    </IconButton>
                  )
                }}
              />
            </Box>

            {/* Action Buttons */}
            <Box
              sx={{
                mt: 3,
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  md: 'auto auto auto',
                },
                gap: 1.5,
                alignItems: 'center',
              }}
            >
              {/* Analyze Button */}
              <Button
                variant="contained"
                onClick={onGetDetail}
                disabled={getDetailsLoader || !link}
                size="small"
                sx={{
                  order: { xs: -1, sm: 0 },
                  minHeight: { xs: 44, sm: 40 },
                  px: { xs: 1.75, sm: 3 },
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  background: `linear-gradient(135deg, ${PRIMARY_COLOR}, ${SECONDARY_COLOR})`,
                  transition: 'transform .15s ease, box-shadow .15s ease',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: '0 6px 14px rgba(0,128,128,.25)',
                  },
                  '&:disabled': {
                    background: 'rgba(0,128,128,.35)',
                    boxShadow: 'none',
                    transform: 'none',
                  },
                }}
                startIcon={
                  getDetailsLoader ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <SearchIcon sx={{ fontSize: 18 }} />
                  )
                }
              >
                {getDetailsLoader ? 'Scanning...' : 'Scan'}
              </Button>

              {/* Clear Button */}
              <Button
                variant="outlined"
                onClick={clearForm}
                size="small"
                sx={{
                  minHeight: { xs: 44, sm: 40 },
                  px: { xs: 1.5, sm: 2.5 },
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: PRIMARY_COLOR,
                  borderWidth: 1.25,
                  borderColor: PRIMARY_COLOR,
                  transition: 'transform .15s ease, box-shadow .15s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(0,128,128,.05)',
                    borderColor: SECONDARY_COLOR,
                    color: SECONDARY_COLOR,
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                Clear
              </Button>

              {/* Wizard Button */}
              <Box sx={{ minWidth: { md: 190 } }}>
                <AnimatePresence>
                  {videoDetails?.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Button
                        variant="outlined"
                        onClick={() => setShowFormatModal(true)}
                        size="small"
                        fullWidth
                        sx={{
                          minHeight: { xs: 44, sm: 40 },
                          px: { xs: 1.75, sm: 3 },
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: PRIMARY_COLOR,
                          borderColor: PRIMARY_COLOR,
                          backgroundColor: 'white',
                          transition: 'transform .15s ease, box-shadow .15s ease',
                          '&:hover': {
                            borderColor: SECONDARY_COLOR,
                            color: SECONDARY_COLOR,
                            transform: 'translateY(-1px)',
                            boxShadow: '0 6px 14px rgba(0,128,128,.2)',
                          },
                        }}
                        startIcon={<FormatListIcon sx={{ fontSize: 18 }} />}
                        endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                      >
                        Wizard
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Box>
            </Box>

          </Paper>
        </motion.div>
      </Container>

      {/* Format Selection Modal */}
      <Dialog
        open={showFormatModal}
        onClose={() => setShowFormatModal(false)}
        maxWidth="lg"
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            background: DARK_BG,
            color: TEXT_PRIMARY,
            ...(isMobile && {
              margin: 0,
              width: '100%',
              height: '100%',
              maxHeight: '100%',
              borderRadius: 0
            })
          }
        }}
      >
        {isMobile ? (
          <>
            <AppBar position="sticky" elevation={0} sx={{ bgcolor: PRIMARY_COLOR }}>
              <Toolbar>
                <IconButton
                  edge="start"
                  color="inherit"
                  onClick={() => setShowFormatModal(false)}
                  aria-label="close"
                >
                  <ArrowBackIcon />
                </IconButton>
                <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
                  Download Wizard
                </Typography>
                <IconButton
                  edge="end"
                  color="inherit"
                  onClick={() => setShowFormatModal(false)}
                  aria-label="close"
                >
                  <CloseIcon />
                </IconButton>
              </Toolbar>
            </AppBar>
            <DialogContent sx={{
              p: 0,
              display: 'flex',
              flexDirection: 'column',
              height: 'calc(100vh - 64px)' // Adjust based on AppBar height
            }}>
              {videoDetails.length > 0 && (
                <Box sx={{ flex: 1, overflow: 'hidden' }}>
                  <FormatSelectionWizard
                    formats={videoDetails}
                    onHandleSubmit={handleFormatSubmit}
                    isLoading={submitLoader}
                    onClose={() => setShowFormatModal(false)}
                    downloadOption={downloadOption}
                    setDownloadOption={setDownloadOption}
                    rename={rename}
                    setRename={setRename}
                    title={title}
                    setTitle={setTitle}
                    recordName={recordName}
                  />
                </Box>
              )}
            </DialogContent>
          </>
        ) : (
          <>
            <DialogTitle sx={{
              bgcolor: LIGHT_BG,
              borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexShrink: 0 // Prevent shrinking
            }}>
              <FormatListIcon sx={{ color: PRIMARY_COLOR }} />
              <Typography variant="h6" sx={{ color: TEXT_PRIMARY }}>
                Download Wizard
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <IconButton
                onClick={() => setShowFormatModal(false)}
                sx={{ color: TEXT_PRIMARY }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{
              p: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {videoDetails.length > 0 && (
                <Box sx={{
                  flex: 1,
                  overflow: 'hidden',
                  // minHeight: '500px', // Minimum height for desktop
                }}>
                  <FormatSelectionWizard
                    formats={videoDetails}
                    onHandleSubmit={handleFormatSubmit}
                    isLoading={submitLoader}
                    onClose={() => setShowFormatModal(false)}
                    downloadOption={downloadOption}
                    setDownloadOption={setDownloadOption}
                    rename={rename}
                    setRename={setRename}
                    title={title}
                    setTitle={setTitle}
                    recordName={recordName}
                  />
                </Box>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}

export default YoutubeDownloader;