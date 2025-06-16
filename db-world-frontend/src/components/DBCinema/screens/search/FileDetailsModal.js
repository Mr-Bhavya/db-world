import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Divider,
  CircularProgress,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { CopyAll, Download, Delete, Close, Edit, ContentCopy } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  loadStreamFileInfoByFiledId,
  renameStreamFile,
  deleteStreamFile
} from '../../../ApiServices';
import Constants from '../../../Constants';
import CommonServices from '../../../CommonServices';

const FileDetailsModal = ({ open, onClose, fileId, userRole }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [mediaInfo, setMediaInfo] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  useEffect(() => {
    const fetchMediaInfo = async () => {
      if (open && fileId) {
        setLoading(true);
        try {
          const mediaInfoRes = await loadStreamFileInfoByFiledId(fileId);
          if (mediaInfoRes.httpStatusCode === 200) {
            const converted = CommonServices.convertMediaInfoToCustomFormat(mediaInfoRes.data, true);
            if (converted.length > 0) {
              setMediaInfo(converted[0]);
              setNewFileName(converted[0]?.general?.fileName);
            }
          } else if (mediaInfoRes.httpStatusCode === 401 || mediaInfoRes.httpStatusCode === 403) {
            navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
          } else {
            Constants.showToast.error(mediaInfoRes.message);
          }
        } catch (error) {
          console.error(error);
          Constants.showToast.error('Failed to load media info');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchMediaInfo();
  }, [open, fileId, navigate, location]);

  const handleRename = async () => {
    if (!newFileName.trim()) {
      Constants.showToast.error('File name cannot be empty');
      return;
    }
    try {
      const renameRes = await renameStreamFile(fileId, newFileName);
      if (renameRes.httpStatusCode === 200) {
        setMediaInfo(prev => ({
          ...prev,
          general: { ...prev.general, fileName: newFileName }
        }));
        setIsEditingName(false);
        Constants.showToast.success('File renamed successfully');
      } else if (renameRes.httpStatusCode === 401 || renameRes.httpStatusCode === 403) {
        navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
      } else {
        Constants.showToast.error(renameRes.message);
      }
    } catch (error) {
      console.error(error);
      Constants.showToast.error('Failed to rename file');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      try {
        const deleteFileRes = await deleteStreamFile(fileId);
        if (deleteFileRes.httpStatusCode === 200) {
          onClose();
          Constants.showToast.success(deleteFileRes.message);
        } else if (deleteFileRes.httpStatusCode === 401 || deleteFileRes.httpStatusCode === 403) {
          navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
        } else {
          Constants.showToast.error(deleteFileRes.message);
        }
      } catch (error) {
        console.error(error);
        Constants.showToast.error('Failed to delete file');
      }
    }
  };

  const handleCopy = () => {
    if (mediaInfo?.downloadUrl) {
      const result = CommonServices.handleCopy(mediaInfo.downloadUrl);
      if (result.success) {
        Constants.showToast.success('Download link copied to clipboard');
      } else {
        Constants.showToast.error(result.message);
      }
      console.log('Copy result:', result);
    } else {
      Constants.showToast.warn('No download URL available');
    }
  };

  const handleDownload = () => {
    if (mediaInfo?.downloadUrl) {
      window.open(mediaInfo.downloadUrl, '_blank');
    } else {
      Constants.showToast.info('No download URL available');
    }
  };

  // Animation variants
  const modalVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0 }
  };

  const contentVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      style={{ zIndex: 9999 }}
      PaperProps={{
        component: motion.div,
        variants: modalVariants,
        initial: "hidden",
        animate: "visible",
        exit: "hidden",
        transition: { duration: 0.3 },
        sx: {
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          borderRadius: 2,
          boxShadow: 24,
          zIndex: 9999,
        }
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        bgcolor: 'background.default',
        borderBottom: `1px solid ${theme.palette.divider}`
      }}>
        <Typography variant="h6">Media Information</Typography>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{
        maxHeight: '70vh',
        overflow: 'auto',
        bgcolor: 'background.paper'
      }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress />
          </Box>
        ) : mediaInfo ? (
          <Box component={motion.div} variants={contentVariants}>
            {/* File Name Section */}
            <Box mb={2}>
              {isEditingName ? (
                <Box display="flex" gap={1} alignItems="center">
                  <TextField
                    fullWidth
                    size="small"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    sx={{ flex: 1 }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleRename}
                    disabled={!newFileName.trim()}
                  >
                    Save
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setIsEditingName(false)}
                  >
                    Cancel
                  </Button>
                </Box>
              ) : (
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body1">
                    <strong>File Name:</strong> {mediaInfo.general.fileName}
                  </Typography>
                  {userRole && (
                    <IconButton
                      size="small"
                      onClick={() => setIsEditingName(true)}
                      sx={{ ml: 'auto' }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              )}
            </Box>

            {/* General Info */}
            <Box mb={3}>
              <Typography variant="body1"><strong>File Size:</strong> {mediaInfo.general.fileSize}</Typography>
              <Typography variant="body1"><strong>Duration:</strong> {mediaInfo.general.duration} sec</Typography>
              <Typography variant="body1"><strong>Bitrate:</strong> {mediaInfo.general.overallBitrate}</Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Video Info */}
            <Box mb={3}>
              <Typography variant="h6" color="primary" gutterBottom>Video</Typography>
              <Typography variant="body1"><strong>Resolution:</strong> {mediaInfo.video.resolution}</Typography>
              <Typography variant="body1"><strong>Format:</strong> {mediaInfo.video.format}</Typography>
              <Typography variant="body1"><strong>HDR:</strong> {mediaInfo.video.hdrDetails || 'No'}</Typography>
              <Typography variant="body1"><strong>Size:</strong> {mediaInfo.video.size}</Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Audio Info */}
            <Box mb={3}>
              <Typography variant="h6" color="primary" gutterBottom>Audio</Typography>
              {mediaInfo.audio?.length > 0 ? (
                mediaInfo.audio.map((audio, index) => (
                  <Box key={index} mb={index < mediaInfo.audio.length - 1 ? 2 : 0}>
                    {audio.language && (
                      <Typography variant="body1"><strong>Language:</strong> {audio.language}</Typography>
                    )}
                    <Typography variant="body1"><strong>Format:</strong> {audio.format}</Typography>
                    <Typography variant="body1"><strong>Size:</strong> {audio.size}</Typography>
                    <Typography variant="body1"><strong>Channels:</strong> {audio.channelInfo}</Typography>
                    {index < mediaInfo.audio.length - 1 && <Divider sx={{ my: 1 }} />}
                  </Box>
                ))
              ) : (
                <Typography variant="body1">No audio information available</Typography>
              )}
            </Box>

            {/* Subtitles Info */}
            {mediaInfo.subtitle?.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box mb={3}>
                  <Typography variant="h6" color="primary" gutterBottom>Subtitles</Typography>
                  {mediaInfo.subtitle.map((sub, index) => (
                    <Box key={index} mb={index < mediaInfo.subtitle.length - 1 ? 2 : 0}>
                      {sub.format && (
                        <Typography variant="body1"><strong>Format:</strong> {sub.format}</Typography>
                      )}
                      {sub.language && (
                        <Typography variant="body1"><strong>Language:</strong> {sub.language}</Typography>
                      )}
                      {sub.size && (
                        <Typography variant="body1"><strong>Size:</strong> {sub.size}</Typography>
                      )}
                      {index < mediaInfo.subtitle.length - 1 && <Divider sx={{ my: 1 }} />}
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Box>
        ) : (
          <Typography variant="body1">Error loading media information</Typography>
        )}
      </DialogContent>

      <DialogActions sx={{
        bgcolor: 'background.default',
        borderTop: `1px solid ${theme.palette.divider}`
      }}>
        
        <Button
          variant="text"
          onClick={handleCopy}
        >
          <ContentCopy  style={{ mx: 0, px: 0 }} />
        </Button>
        <Button
          variant="contained"
          startIcon={<Download />}
          onClick={handleDownload}
        >
          Download
        </Button>
      </DialogActions>
      {Constants.TOAST_CONTAINER}
    </Dialog>
  );
};

export default FileDetailsModal;