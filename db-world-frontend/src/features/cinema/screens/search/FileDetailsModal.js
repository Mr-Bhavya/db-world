import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  useTheme,
  Typography,
  Box,
  Button,
  Chip,
  Stack,
  Tooltip
} from '@mui/material';
import { motion } from 'framer-motion';
import { Close, Download, ContentCopy, CheckCircle } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { loadStreamFileInfoByFiledId, resolveMediaUrl } from '@shared/services/ApiServices';
import Constants from '@shared/constants';
import CommonServices from '@shared/services/CommonServices';
import LoadingSpinner from '@shared/components/ui/LoadingSpinner';
import { toast } from '@shared/components/ui/Toast';
import { MediaInfoContent } from '../MediaFileInfo/MediaInfoContent';

const FileDetailsModal = ({ open, onClose, fileId }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [mediaInfo, setMediaInfo] = useState(null);
  const [copyStatus, setCopyStatus] = useState(null);  // null | "success" | "error"


  useEffect(() => {
    const fetchMediaInfo = async () => {
      if (open && fileId) {
        setLoading(true);
        setMediaInfo(null);
        try {
          const mediaInfoRes = await loadStreamFileInfoByFiledId(fileId);
          if (mediaInfoRes.httpStatusCode === 200) {
            const converted = CommonServices.convertMediaInfoToCustomFormat(fileId, mediaInfoRes.data, true);
            if (converted.length > 0) {
              setMediaInfo(converted[0]);
            } else {
              toast.error('No media information found');
            }
          } else if (mediaInfoRes.httpStatusCode === 401 || mediaInfoRes.httpStatusCode === 403) {
            toast.error('Authentication required');
            navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
          } else {
            toast.error(mediaInfoRes.message || 'Failed to load media info');
          }
        } catch (error) {
          console.error('Error fetching media info:', error);
          toast.error('Failed to load media information');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchMediaInfo();
  }, [open, fileId, navigate, location]);

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setMediaInfo(null);
      setLoading(true);
    }, 300);
  };

  // Download handler
  const handleDownload = async () => {
    if (!mediaInfo?.mediaFileId) { toast.error('Download URL not available'); return; }
    try {
      const res = await resolveMediaUrl(mediaInfo.mediaFileId, 'DOWNLOAD');
      const cdnUrl = res?.data?.cdnUrl;
      if (!cdnUrl) throw new Error('No CDN URL');
      await CommonServices.handleDownload(cdnUrl, false);
      toast.success('Download started');
    } catch {
      toast.error('Failed to start download');
    }
  };

  const handleCopyUrlAlt = async (url) => {
    if (!url) {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus(null), 1500);
      return;
    }

    try {
      const result = await CommonServices.handleCopy(url);
      // //console.log("Copy result:", result);
      if (result?.success) {
        setCopyStatus("success");
      } else {
        setCopyStatus("error");
      }
    } catch (err) {
      console.error("Copy error:", err);
      setCopyStatus("error");
    }

    // Reset feedback after 1.5s
    setTimeout(() => setCopyStatus(null), 1500);
  };


  // Get file quality info
  const getFileQualityInfo = () => {
    if (!mediaInfo?.video) return null;

    const video = mediaInfo.video;
    return {
      resolution: video.resolution || 'Unknown',
      format: video.format || 'Unknown',
      bitrate: video.bitRate ?
        `${CommonServices.bytesToReadbleFormat(video.bitRate).value} ${CommonServices.bytesToReadbleFormat(video.bitRate).suffix}/s` :
        'Unknown',
      hdr: video.hdrDetails || null
    };
  };

  const qualityInfo = getFileQualityInfo();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="md"
      sx={{
        zIndex: 10000,
        '& .MuiBackdrop-root': {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
        }
      }}
      PaperProps={{
        component: motion.div,
        initial: { opacity: 0, scale: 0.8, y: 50 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.8, y: 50 },
        transition: {
          type: "spring",
          damping: 25,
          stiffness: 300
        },
        sx: {
          bgcolor: 'background.paper',
          borderRadius: 3,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          maxHeight: '95vh',
          overflow: 'hidden',
          m: { xs: 1, sm: 2 },
          maxWidth: { xs: 'calc(100% - 16px)', sm: 'md' },
        }
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        bgcolor: 'background.default',
        borderBottom: `1px solid ${theme.palette.divider}`,
        py: 2,
        px: { xs: 2, sm: 3 },
        gap: 2
      }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{
            fontWeight: 600,
            fontSize: { xs: '1.1rem', sm: '1.25rem' },
            mb: 1,
            wordBreak: 'break-word'
          }}>
            {mediaInfo?.general?.fileName || 'Media Information'}
          </Typography>

          {/* Quality Info Chips */}
          {qualityInfo && (
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.5 }}>
              <Chip
                label={qualityInfo.resolution}
                size="small"
                color="primary"
                variant="outlined"
              />
              {qualityInfo.format && (
                <Chip
                  label={qualityInfo.format}
                  size="small"
                  color="secondary"
                  variant="outlined"
                />
              )}
              {qualityInfo.hdr && (
                <Chip
                  label="HDR"
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
            </Stack>
          )}
        </Box>

        <IconButton
          onClick={handleClose}
          size="small"
          sx={{
            color: 'text.secondary',
            flexShrink: 0,
            '&:hover': {
              color: 'text.primary',
              bgcolor: 'action.hover'
            }
          }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{
        p: 0,
        bgcolor: 'background.default',
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-track': {
          background: theme.palette.background.default,
        },
        '&::-webkit-scrollbar-thumb': {
          background: theme.palette.action.selected,
          borderRadius: '4px',
        }
      }}>
        {loading ? (
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 200
          }}>
            <LoadingSpinner />
          </Box>
        ) : mediaInfo ? (
          <MediaInfoContent mediaInfo={mediaInfo} />
        ) : (
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 200,
            flexDirection: 'column',
            gap: 2
          }}>
            <Typography variant="body1" color="text.secondary">
              No media information available
            </Typography>
          </Box>
        )}
      </DialogContent>

      {/* Action Buttons Section */}
      {mediaInfo && (
        <Box sx={{
          px: { xs: 2, sm: 3 },
          py: 1.5,
          bgcolor: 'background.default',
          borderTop: `1px solid ${theme.palette.divider}`
        }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{
              justifyContent: 'space-between',
              alignItems: { xs: 'stretch', sm: 'center' }
            }}
          >
            {/* Right Action Group - Copy DL URL & Download */}
            <Stack direction="row" spacing={1} sx={{ flex: 1, justifyContent: { xs: 'stretch', sm: 'flex-end' } }}>
              <Tooltip title="Copy download URL">
                <Button
                  variant={copyStatus === "error" ? "contained" : "outlined"}
                  color={
                    copyStatus === "success"
                      ? "success"
                      : copyStatus === "error"
                        ? "error"
                        : "secondary"
                  }
                  startIcon={
                    copyStatus === "success" ? (
                      <CheckCircle />
                    ) : copyStatus === "error" ? (
                      <Close />
                    ) : (
                      <ContentCopy />
                    )
                  }
                  onClick={() => resolveMediaUrl(mediaInfo?.mediaFileId, 'DOWNLOAD').then(r => handleCopyUrlAlt(r?.data?.cdnUrl)).catch(() => {})}
                  disabled={!mediaInfo?.mediaFileId}
                  size="small"
                  sx={{
                    flex: { xs: 1, sm: 'none' },
                    minWidth: { xs: 'auto', sm: '140px' },

                    // Smooth transitions
                    transition: "all 0.3s ease",

                    // Temporary pulse animation on success/error
                    ...(copyStatus && {
                      animation: "pulseEffect 0.4s ease-in-out",
                    }),

                    // Custom keyframe
                    "@keyframes pulseEffect": {
                      "0%": { transform: "scale(1)" },
                      "50%": { transform: "scale(1.07)" },
                      "100%": { transform: "scale(1)" }
                    }
                  }}
                >
                  {copyStatus === "success"
                    ? "Copied!"
                    : copyStatus === "error"
                      ? "Failed"
                      : "Copy DL URL"}
                </Button>
              </Tooltip>


              <Tooltip title="Download file">
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<Download />}
                  onClick={handleDownload}
                  disabled={!mediaInfo?.mediaFileId}
                  size="small"
                  sx={{
                    flex: { xs: 1, sm: 'none' },
                    minWidth: { xs: 'auto', sm: '120px' },
                    bgcolor: 'success.main',
                    '&:hover': {
                      bgcolor: 'success.dark'
                    }
                  }}
                >
                  Download
                </Button>
              </Tooltip>
            </Stack>
          </Stack>
        </Box>
      )}
    </Dialog>
  );
};

export default FileDetailsModal;