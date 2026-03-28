import React, { useState, useEffect, useCallback } from 'react';
import {
  SmartDisplay,
  Videocam,
  VideoSettings,
  Error,
  CheckCircle,
  Downloading,
  Refresh,
  Warning,
  Info
} from "@mui/icons-material";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
  Button,
  Divider,
  Chip,
  Box,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
  Avatar,
  LinearProgress,
  Collapse
} from "@mui/material";
import { Capacitor } from "@capacitor/core";
import axios from 'axios';
import AndroidPlugins from "../../../../../android-app-components/AndroidPlugins";
import axiosInstance from '../../../../Utils/AxiosInstants';

const HLSPlayerOptions = ({
  open,
  onClose,
  mediaInfo,
  onStreamSelected,
  checkHLSBeforeShow = true,
  autoSelectOnSingleOption = true
}) => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [hlsStatus, setHlsStatus] = useState({
    loading: false,
    available: false,
    generating: false,
    progress: 0,
    variants: [],
    error: null,
    contentInfo: null,
    lastChecked: null
  });
  const [directPlayAvailable, setDirectPlayAvailable] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  // Check HLS availability when dialog opens
  useEffect(() => {
    if (open && mediaInfo?.recordId) {
      if (checkHLSBeforeShow) {
        checkHLSAvailability();
      } else {
        // Reset status when dialog opens
        setHlsStatus({
          loading: false,
          available: false,
          generating: false,
          progress: 0,
          variants: [],
          error: null,
          contentInfo: null,
          lastChecked: null
        });
      }
    }
  }, [open, mediaInfo?.recordId, checkHLSBeforeShow]);

  // Auto-select if only one option is available
  useEffect(() => {
    if (autoSelectOnSingleOption && open) {
      const timer = setTimeout(() => {
        if (!hlsStatus.loading && !directPlayAvailable) {
          handleSelectHLS();
        } else if (!hlsStatus.available && directPlayAvailable) {
          handleSelectDirectPlay();
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [open, hlsStatus.loading, hlsStatus.available, directPlayAvailable]);

  const checkHLSAvailability = useCallback(async () => {
    if (!mediaInfo?.recordId) return;

    setHlsStatus(prev => ({ 
      ...prev, 
      loading: true, 
      error: null,
      lastChecked: new Date()
    }));

    try {
      const response = await axiosInstance.get(`/api/hls/content/${mediaInfo.recordId}/info`);
      
      const contentInfo = response.data;
      const isReady = contentInfo.status === 'READY' || contentInfo.status === 'COMPLETED';
      const isGenerating = contentInfo.status === 'PROCESSING' || contentInfo.status === 'GENERATING';
      
      if (isReady) {
        setHlsStatus({
          loading: false,
          available: true,
          generating: false,
          progress: 100,
          variants: contentInfo.variants || [],
          error: null,
          contentInfo: contentInfo,
          lastChecked: new Date()
        });
      } else if (isGenerating) {
        // Start polling for generation progress
        setHlsStatus(prev => ({
          ...prev,
          loading: false,
          available: false,
          generating: true,
          progress: 0,
          variants: [],
          error: 'HLS content is being generated...',
          contentInfo: contentInfo
        }));
        startGenerationPolling(mediaInfo.recordId);
      } else {
        setHlsStatus({
          loading: false,
          available: false,
          generating: false,
          progress: 0,
          variants: [],
          error: `HLS content status: ${contentInfo.status}`,
          contentInfo: contentInfo,
          lastChecked: new Date()
        });
      }
    } catch (error) {
      console.error('HLS check failed:', error);
      
      let errorMessage = 'Failed to check HLS availability';
      let shouldRetry = false;
      
      if (error.response?.status === 401) {
        errorMessage = 'Authentication required';
      } else if (error.response?.status === 404) {
        errorMessage = 'HLS content not found';
        shouldRetry = false;
      } else if (error.code === 'ECONNABORTED' || error.message === 'Network Error') {
        errorMessage = 'Network error. Please check your connection.';
        shouldRetry = true;
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      }
      
      setHlsStatus({
        loading: false,
        available: false,
        generating: false,
        progress: 0,
        variants: [],
        error: errorMessage,
        contentInfo: null,
        lastChecked: new Date()
      });
      
      if (shouldRetry) {
        // Auto-retry after 3 seconds
        setTimeout(() => checkHLSAvailability(), 3000);
      }
    }
  }, [mediaInfo?.recordId]);

  const startGenerationPolling = useCallback((recordId) => {
    let pollingCount = 0;
    const maxPollingAttempts = 60; // Poll for up to 5 minutes (60 * 5 seconds)
    
    const pollGenerationStatus = async () => {
      if (pollingCount >= maxPollingAttempts) {
        setHlsStatus(prev => ({
          ...prev,
          generating: false,
          error: 'HLS generation timed out. Please try again later.'
        }));
        return;
      }
      
      try {
        const response = await axiosInstance.get(`/api/hls/content/${recordId}/info`);
        const contentInfo = response.data;
        
        if (contentInfo.status === 'READY' || contentInfo.status === 'COMPLETED') {
          setHlsStatus({
            loading: false,
            available: true,
            generating: false,
            progress: 100,
            variants: contentInfo.variants || [],
            error: null,
            contentInfo: contentInfo,
            lastChecked: new Date()
          });
        } else if (contentInfo.status === 'PROCESSING' || contentInfo.status === 'GENERATING') {
          // Update progress if available in response
          const progress = contentInfo.progress || Math.min(pollingCount * 2, 90); // Estimate progress
          
          setHlsStatus(prev => ({
            ...prev,
            progress,
            generating: true,
            contentInfo: contentInfo
          }));
          
          // Continue polling every 5 seconds
          pollingCount++;
          setTimeout(pollGenerationStatus, 5000);
        } else if (contentInfo.status === 'FAILED') {
          setHlsStatus(prev => ({
            ...prev,
            generating: false,
            error: 'HLS generation failed. Please try direct play or contact support.'
          }));
        }
      } catch (error) {
        console.error('Polling error:', error);
        pollingCount++;
        setTimeout(pollGenerationStatus, 5000);
      }
    };
    
    // Start polling
    setTimeout(pollGenerationStatus, 2000);
  }, []);

  const handleSelectHLS = async () => {
    if (!hlsStatus.available && !hlsStatus.generating) {
      await checkHLSAvailability();
      if (!hlsStatus.available && !hlsStatus.generating) return;
    }
    
    if (hlsStatus.generating) {
      // Show message that generation is in progress
      setHlsStatus(prev => ({
        ...prev,
        error: 'HLS is still being generated. Please wait or use direct play.'
      }));
      return;
    }

    setSelectedOption('hls');
    
    if (onStreamSelected) {
      try {
        // Start playback session
        const sessionResponse = await startPlaybackSession();
        
        // Get master playlist URL
        const masterPlaylistUrl = `/api/hls/playback/${mediaInfo.recordId}`;
        
        // Verify we can access the stream
        const streamCheck = await axiosInstance.get(masterPlaylistUrl, {
          headers: { 'Accept': 'application/vnd.apple.mpegurl' },
          validateStatus: (status) => status < 500 // Don't throw for 404, 401, etc.
        });
        
        if (streamCheck.status === 200) {
          onStreamSelected('hls', {
            ...mediaInfo,
            hlsPlaylistUrl: `${window.location.origin}${masterPlaylistUrl}`,
            sessionId: sessionResponse?.sessionId,
            variants: hlsStatus.variants,
            recordId: mediaInfo.recordId,
            title: mediaInfo?.general?.fileName || 'Video Stream',
            authRequired: true
          });
          onClose?.();
        } else {
          throw new Error(`Stream access failed with status: ${streamCheck.status}`);
        }
      } catch (error) {
        console.error('HLS stream access failed:', error);
        setHlsStatus(prev => ({
          ...prev,
          error: error.message || 'Cannot access HLS stream. Please try again.'
        }));
        return;
      }
    } else {
      onClose?.();
    }
  };

  const startPlaybackSession = async () => {
    try {
      const requestData = {
        userId: getCurrentUserId(),
        recordId: mediaInfo.recordId,
        deviceInfo: getDeviceInfo(),
        resolution: getPreferredResolution()
      };
      
      const response = await axiosInstance.post('/api/hls/session/start', requestData);
      return response.data;
    } catch (error) {
      console.warn('Failed to start playback session:', error);
      return null;
    }
  };

  const getCurrentUserId = () => {
    // Implement your user ID retrieval logic
    // return localStorage.getItem('userId') || sessionStorage.getItem('userId');
    return 1; // Placeholder
  };

  const getDeviceInfo = () => {
    const platform = Capacitor.getPlatform();
    const ua = navigator.userAgent;
    return `${platform} - ${ua.substring(0, 50)}...`;
  };

  const getPreferredResolution = () => {
    // Get preferred resolution from user settings or auto-detect
    if (hlsStatus.variants && hlsStatus.variants.length > 0) {
      // Return highest resolution by default
      const sortedVariants = [...hlsStatus.variants].sort((a, b) => {
        const aHeight = a.height || 0;
        const bHeight = b.height || 0;
        return bHeight - aHeight;
      });
      return sortedVariants[0]?.resolution || '1080p';
    }
    return '1080p';
  };

  const handleSelectDirectPlay = () => {
    setSelectedOption('direct');
    
    if (Capacitor.getPlatform() === "android") {
      // For Android, check if we need to add auth token to stream URL
      const streamUrl = mediaInfo?.streamUrl || mediaInfo?.filePath;
      const token = getAuthToken();
      
      let finalUrl = streamUrl;
      if (token && !streamUrl.includes('token=') && !streamUrl.includes('Authorization')) {
        // Add token as query parameter for Android player
        const separator = streamUrl.includes('?') ? '&' : '?';
        finalUrl = `${streamUrl}${separator}token=${encodeURIComponent(token)}`;
      }
      
      // Call Android native player
      AndroidPlugins?.MyMedia3Player?.(finalUrl, mediaInfo?.general?.fileName || 'Video');
    } else {
      // For web, use native video player or redirect
      if (onStreamSelected) {
        onStreamSelected('direct', {
          ...mediaInfo,
          directPlayUrl: mediaInfo?.streamUrl || mediaInfo?.filePath,
          title: mediaInfo?.general?.fileName || 'Video'
        });
      }
    }
    onClose?.();
  };

  const getAuthToken = () => {
    // Implement your token retrieval logic
    return localStorage.getItem('token') || 
           sessionStorage.getItem('token') ||
           document.cookie.match(/token=([^;]+)/)?.[1];
  };

  const getQualityChips = () => {
    if (!hlsStatus.variants || hlsStatus.variants.length === 0) return null;

    return (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
        {hlsStatus.variants
          .sort((a, b) => (b.height || 0) - (a.height || 0))
          .slice(0, 4)
          .map((variant, index) => (
            <Chip
              key={variant.resolution || index}
              label={`${variant.resolution}${variant.bitrate ? ` (${Math.round(variant.bitrate / 1000)}k)` : ''}`}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          ))}
        {hlsStatus.variants.length > 4 && (
          <Chip
            label={`+${hlsStatus.variants.length - 4}`}
            size="small"
            color="default"
            variant="outlined"
            sx={{ fontSize: '0.7rem', height: 22 }}
          />
        )}
      </Box>
    );
  };

  const renderHLSStatus = () => {
    if (hlsStatus.loading) {
      return (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            Checking HLS availability...
          </Typography>
        </Stack>
      );
    }

    if (hlsStatus.generating) {
      return (
        <Box sx={{ mt: 1, width: '100%' }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Downloading color="warning" fontSize="small" />
            <Typography variant="caption" color="warning.main">
              Generating HLS stream...
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {hlsStatus.progress}%
            </Typography>
          </Stack>
          <LinearProgress 
            variant="determinate" 
            value={hlsStatus.progress} 
            sx={{ height: 4, borderRadius: 2 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            This may take a few minutes depending on video size.
          </Typography>
        </Box>
      );
    }

    if (hlsStatus.error) {
      return (
        <Alert 
          severity="warning" 
          icon={<Error fontSize="small" />}
          sx={{ mt: 1, py: 0.5 }}
          action={
            hlsStatus.error.includes('Network') && (
              <IconButton
                size="small"
                onClick={checkHLSAvailability}
                sx={{ p: 0.5 }}
              >
                <Refresh fontSize="small" />
              </IconButton>
            )
          }
        >
          <Typography variant="caption">
            {hlsStatus.error}
          </Typography>
        </Alert>
      );
    }

    if (hlsStatus.available) {
      return (
        <Box sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircle color="success" fontSize="small" />
            <Typography variant="caption" color="success.main" fontWeight={500}>
              HLS Ready
            </Typography>
            {hlsStatus.contentInfo?.generatedAt && (
              <Typography variant="caption" color="text.secondary">
                • Generated: {new Date(hlsStatus.contentInfo.generatedAt).toLocaleDateString()}
              </Typography>
            )}
          </Stack>
          {getQualityChips()}
        </Box>
      );
    }

    return null;
  };

  const renderHLSDetails = () => {
    if (!hlsStatus.contentInfo) return null;

    return (
      <Collapse in={showDetails}>
        <Box sx={{ 
          mt: 2, 
          p: 2, 
          bgcolor: 'grey.50', 
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider'
        }}>
          <Stack spacing={1}>
            <Typography variant="subtitle2" fontWeight={600}>
              HLS Stream Details
            </Typography>
            
            <Stack direction="row" spacing={3}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Typography variant="body2">
                  {hlsStatus.contentInfo.status}
                </Typography>
              </Box>
              
              {hlsStatus.contentInfo.variants?.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Variants
                  </Typography>
                  <Typography variant="body2">
                    {hlsStatus.contentInfo.variants.length}
                  </Typography>
                </Box>
              )}
              
              {hlsStatus.contentInfo.generatedAt && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Generated
                  </Typography>
                  <Typography variant="body2">
                    {new Date(hlsStatus.contentInfo.generatedAt).toLocaleDateString()}
                  </Typography>
                </Box>
              )}
            </Stack>
            
            {hlsStatus.contentInfo.variants?.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Available Qualities:
                </Typography>
                <Stack spacing={0.5}>
                  {hlsStatus.contentInfo.variants.map((variant, index) => (
                    <Stack 
                      key={variant.resolution || index}
                      direction="row" 
                      justifyContent="space-between"
                      sx={{ px: 1 }}
                    >
                      <Typography variant="body2">
                        {variant.resolution}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {variant.width}x{variant.height}
                        {variant.bitrate && ` • ${Math.round(variant.bitrate / 1000)}kbps`}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </Box>
      </Collapse>
    );
  };

  const getRecommendedOption = () => {
    if (hlsStatus.available) return 'hls';
    if (Capacitor.getPlatform() === 'android') return 'direct';
    return 'hls'; // Default to HLS for web
  };

  const isHLSRecommended = getRecommendedOption() === 'hls';
  const canPlayHLS = hlsStatus.available || hlsStatus.generating;
  const hasDirectPlay = directPlayAvailable && (mediaInfo?.streamUrl || mediaInfo?.filePath);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          bgcolor: 'background.paper'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <VideoSettings color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Choose Playback Method
            </Typography>
          </Stack>
          {hlsStatus.lastChecked && (
            <Tooltip title="Last checked">
              <Typography variant="caption" color="text.secondary">
                {new Date(hlsStatus.lastChecked).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </Typography>
            </Tooltip>
          )}
        </Stack>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          How would you like to play "{mediaInfo?.general?.fileName || 'this video'}"?
        </Typography>
        
        <List sx={{ py: 0 }}>
          {/* HLS Streaming Option */}
          <Tooltip 
            title={!canPlayHLS ? 
              "Adaptive streaming is not available for this content" : ""}
            placement="top"
          >
            <div>
              <ListItemButton 
                onClick={handleSelectHLS}
                selected={selectedOption === 'hls'}
                disabled={!canPlayHLS}
                sx={{
                  borderRadius: 1,
                  mb: 1,
                  opacity: canPlayHLS ? 1 : 0.7,
                  '&.Mui-selected': {
                    bgcolor: 'primary.light',
                    '&:hover': {
                      bgcolor: 'primary.light',
                    }
                  },
                  '&.Mui-disabled': {
                    opacity: 0.5
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Avatar 
                    sx={{ 
                      width: 32, 
                      height: 32,
                      bgcolor: isHLSRecommended ? 'primary.main' : 'grey.400'
                    }}
                  >
                    <SmartDisplay sx={{ fontSize: 18 }} />
                  </Avatar>
                </ListItemIcon>
                <ListItemText 
                  primary={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="subtitle1" fontWeight={500}>
                        Adaptive Streaming (HLS)
                      </Typography>
                      {isHLSRecommended && hlsStatus.available && (
                        <Chip 
                          label="Recommended" 
                          size="small" 
                          color="primary" 
                          sx={{ height: 20, fontSize: '0.65rem' }}
                        />
                      )}
                      {hlsStatus.generating && (
                        <Chip 
                          label="Generating" 
                          size="small" 
                          color="warning" 
                          sx={{ height: 20, fontSize: '0.65rem' }}
                        />
                      )}
                    </Stack>
                  }
                  secondary={
                    <Box>
                      Best for varying network conditions. Auto-adjusts quality.
                      {renderHLSStatus()}
                      {hlsStatus.contentInfo && (
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDetails(!showDetails);
                          }}
                          sx={{ mt: 1, p: 0, minWidth: 'auto' }}
                          startIcon={<Info fontSize="small" />}
                        >
                          {showDetails ? 'Hide details' : 'Show details'}
                        </Button>
                      )}
                    </Box>
                  }
                  primaryTypographyProps={{ component: 'div' }}
                  secondaryTypographyProps={{ component: 'div' }}
                />
              </ListItemButton>
            </div>
          </Tooltip>
          
          {renderHLSDetails()}
          
          <Divider sx={{ my: 1 }} />
          
          {/* Direct Play Option */}
          <ListItemButton 
            onClick={handleSelectDirectPlay}
            selected={selectedOption === 'direct'}
            disabled={!hasDirectPlay}
            sx={{
              borderRadius: 1,
              opacity: hasDirectPlay ? 1 : 0.7,
              '&.Mui-selected': {
                bgcolor: 'secondary.light',
                '&:hover': {
                  bgcolor: 'secondary.light',
                }
              },
              '&.Mui-disabled': {
                opacity: 0.5
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Avatar 
                sx={{ 
                  width: 32, 
                  height: 32,
                  bgcolor: !isHLSRecommended ? 'secondary.main' : 'grey.400'
                }}
              >
                <Videocam sx={{ fontSize: 18 }} />
              </Avatar>
            </ListItemIcon>
            <ListItemText 
              primary={
                <Typography variant="subtitle1" fontWeight={500}>
                  Direct Play
                </Typography>
              }
              secondary={
                <Box>
                  Original file quality. Best for stable, fast connections.
                  {!hasDirectPlay && (
                    <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                      No direct play URL available
                    </Typography>
                  )}
                </Box>
              }
            />
          </ListItemButton>
        </List>

        {/* Platform-specific info */}
        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Stack spacing={0.5}>
            <Typography variant="caption" fontWeight={600} color="text.secondary">
              Platform: {Capacitor.getPlatform().toUpperCase()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              <strong>Adaptive Streaming:</strong> Converts video to multiple qualities 
              for smooth playback on any connection.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              <strong>Direct Play:</strong> Streams original file. Requires sufficient bandwidth.
            </Typography>
          </Stack>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 2, pt: 0 }}>
        <Button 
          onClick={onClose}
          variant="outlined"
          sx={{ borderRadius: 1 }}
        >
          Cancel
        </Button>
        <Stack direction="row" spacing={1}>
          {!hlsStatus.loading && !hlsStatus.generating && (
            <Button
              onClick={checkHLSAvailability}
              variant="text"
              size="small"
              startIcon={<Refresh />}
              sx={{ borderRadius: 1 }}
            >
              Refresh
            </Button>
          )}
          <Button 
            onClick={handleSelectHLS}
            variant="contained"
            disabled={!hlsStatus.available}
            startIcon={<SmartDisplay />}
            sx={{ borderRadius: 1 }}
          >
            {hlsStatus.generating ? 'Generating...' : 'Stream'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default HLSPlayerOptions;