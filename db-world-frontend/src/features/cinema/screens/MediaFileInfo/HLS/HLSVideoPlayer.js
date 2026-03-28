import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import axios from 'axios';
import {
  Box,
  IconButton,
  Slider,
  Typography,
  Stack,
  Chip,
  LinearProgress,
  Alert,
  Button,
  Tooltip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  VolumeUp,
  VolumeOff,
  Fullscreen,
  Settings,
  HighQuality,
  Replay,
  Lock,
  LockOpen,
  FullscreenExit,
  Close,
  Keyboard,
  Info
} from '@mui/icons-material';

const HLSVideoPlayer = ({ 
  src, 
  title = "Video Player",
  onClose, 
  autoPlay = true,
  authRequired = true,
  showTitle = true,
  config = {}
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [qualities, setQualities] = useState([]);
  const [currentQuality, setCurrentQuality] = useState('Auto');
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(null);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [qualityMenuAnchor, setQualityMenuAnchor] = useState(null);
  const controlsTimeoutRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  // Memoized configuration
  const playerConfig = useMemo(() => ({
    enableWorker: true,
    lowLatencyMode: true,
    backBufferLength: 90,
    debug: false,
    maxBufferLength: 30,
    maxBufferSize: 60 * 1000 * 1000, // 60MB
    maxMaxBufferLength: 600,
    liveSyncDurationCount: 3,
    liveMaxLatencyDurationCount: 10,
    ...config.hlsConfig
  }), [config.hlsConfig]);

  // Format time helper
  const formatTime = useCallback((seconds) => {
    if (isNaN(seconds) || seconds === 0) return '0:00';
    
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(e => {
        console.error('Play failed:', e);
        setError('Failed to play video');
      });
    } else {
      video.pause();
    }
  }, []);

  // Handle seek
  const handleSeek = useCallback((event, newValue) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = newValue;
    setCurrentTime(newValue);
  }, []);

  // Handle volume change
  const handleVolumeChange = useCallback((event, newValue) => {
    const video = videoRef.current;
    if (!video) return;

    const normalizedVolume = Math.max(0, Math.min(1, newValue));
    video.volume = normalizedVolume;
    setVolume(normalizedVolume);
    setIsMuted(normalizedVolume === 0);
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.muted || volume === 0) {
      video.muted = false;
      video.volume = 0.7;
      setVolume(0.7);
      setIsMuted(false);
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  }, [volume]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        //console.log('Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  }, []);

  // Change quality
  const changeQuality = useCallback((levelIndex) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      if (levelIndex === -1) {
        setCurrentQuality('Auto');
      } else if (hlsRef.current.levels[levelIndex]) {
        const level = hlsRef.current.levels[levelIndex];
        setCurrentQuality(`${level.height}p`);
      }
    }
    setQualityMenuAnchor(null);
  }, []);

  // Show controls temporarily
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettings && !qualityMenuAnchor) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying, showSettings, qualityMenuAnchor]);

  // Handle mouse events
  const handleMouseMove = useCallback(() => {
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  const handleVideoClick = useCallback(() => {
    togglePlay();
    showControlsTemporarily();
  }, [togglePlay, showControlsTemporarily]);

  // Get auth token
  const getAuthToken = useCallback(() => {
    // Implement your token retrieval logic
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }, []);

  // Load HLS source
  const loadHLSSource = useCallback(async (url) => {
    if (!url) {
      setError('No video source provided');
      return;
    }

    // Clean up previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (!Hls.isSupported()) {
      // Check for native HLS support
      if (videoRef.current && videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        //console.log('Using native HLS support');
        setupNativePlayback(url);
      } else {
        setError('Your browser does not support HLS streaming. Please try Chrome, Firefox, or Safari.');
      }
      return;
    }

    const hls = new Hls({
      ...playerConfig,
      xhrSetup: (xhr, requestUrl) => {
        if (authRequired) {
          const token = getAuthToken();
          if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }
        }
        xhr.withCredentials = true;
      }
    });

    hlsRef.current = hls;

    try {
      hls.loadSource(url);
      hls.attachMedia(videoRef.current);

      // Event listeners
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        //console.log('HLS manifest parsed successfully');
        
        // Get available qualities
        if (hls.levels && hls.levels.length > 0) {
          const levels = hls.levels.map((level, index) => ({
            id: index,
            height: level.height,
            width: level.width,
            bitrate: level.bitrate,
            name: `${level.height}p`
          }));
          setQualities(levels);
          
          // Set default quality
          const defaultLevel = hls.currentLevel;
          if (defaultLevel !== -1 && hls.levels[defaultLevel]) {
            setCurrentQuality(`${hls.levels[defaultLevel].height}p`);
          }
        }
        
        if (autoPlay) {
          videoRef.current?.play().catch(e => {
            //console.log('Auto-play blocked:', e);
            setError('Auto-play blocked. Click play to start.');
          });
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        const level = hls.levels[data.level];
        if (level) {
          setCurrentQuality(`${level.height}p`);
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS Error:', data);
        
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (retryCount < 3) {
                //console.log(`Network error, retrying... (${retryCount + 1}/3)`);
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = setTimeout(() => {
                  hls.startLoad();
                  setRetryCount(prev => prev + 1);
                }, 1000 * (retryCount + 1));
              } else {
                setError('Network error. Please check your connection and try again.');
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              //console.log('Media error, recovering...');
              hls.recoverMediaError();
              break;
            default:
              setError('Playback error. Please refresh the page.');
              hls.destroy();
              break;
          }
        }
      });

    } catch (error) {
      console.error('Failed to initialize HLS:', error);
      setError('Failed to initialize video player');
    }
  }, [authRequired, autoPlay, playerConfig, retryCount, getAuthToken]);

  // Setup native playback (for Safari)
  const setupNativePlayback = useCallback((url) => {
    if (!videoRef.current) return;

    let finalUrl = url;
    if (authRequired) {
      const token = getAuthToken();
      if (token) {
        finalUrl = `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
      }
    }

    videoRef.current.src = finalUrl;
    videoRef.current.load();
  }, [authRequired, getAuthToken]);

  // Video event handlers
  const setupVideoEvents = useCallback(() => {
    const video = videoRef.current;
    if (!video) return () => {};

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handleWaiting = () => setBuffering(true);
    const handlePlaying = () => setBuffering(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleError = (e) => {
      console.error('Video error:', e);
      setError('Video playback error occurred');
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, []);

  // Initialize player
  useEffect(() => {
    if (!src) {
      setError('No video source provided');
      return;
    }

    const cleanupVideoEvents = setupVideoEvents();

    // Add mouse move listener
    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
    }

    // Load the source
    loadHLSSource(src);

    // Initial show controls
    showControlsTemporarily();

    return () => {
      cleanupVideoEvents?.();
      
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
      }
      
      clearTimeout(controlsTimeoutRef.current);
      clearTimeout(retryTimeoutRef.current);
    };
  }, [src, loadHLSSource, setupVideoEvents, handleMouseMove, showControlsTemporarily]);

  // Handle auth retry
  const handleAuthRetry = useCallback(() => {
    setAuthError(false);
    setRetryCount(0);
    setError(null);
    loadHLSSource(src);
  }, [src, loadHLSSource]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          showControlsTemporarily();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'arrowleft':
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
            showControlsTemporarily();
          }
          break;
        case 'arrowright':
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
            showControlsTemporarily();
          }
          break;
        case 'escape':
          if (isFullscreen) {
            document.exitFullscreen();
          }
          break;
        case 'c':
          e.preventDefault();
          setShowControls(prev => !prev);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlay, toggleFullscreen, toggleMute, duration, isFullscreen, showControlsTemporarily]);

  // Retry function
  const handleRetry = useCallback(() => {
    setError(null);
    setRetryCount(0);
    loadHLSSource(src);
  }, [src, loadHLSSource]);

  // Quality menu handler
  const handleQualityMenuOpen = (event) => {
    setQualityMenuAnchor(event.currentTarget);
  };

  const handleQualityMenuClose = () => {
    setQualityMenuAnchor(null);
  };

  // Handle close
  const handleClose = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
    }
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'black',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        outline: 'none',
        '&:hover .player-controls': {
          opacity: showControls || !isPlaying ? 1 : 0
        }
      }}
      tabIndex={0}
    >
      {/* Error Overlays */}
      {authError && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0,0,0,0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            p: 3
          }}
        >
          <Lock sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
          <Typography variant="h5" color="white" gutterBottom>
            Authentication Required
          </Typography>
          <Typography variant="body1" color="grey.300" align="center" sx={{ mb: 3, maxWidth: 400 }}>
            You need to be authenticated to access this content.
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleAuthRetry}
              startIcon={<LockOpen />}
            >
              Retry Authentication
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              onClick={handleClose}
            >
              Close Player
            </Button>
          </Stack>
        </Box>
      )}

      {error && !authError && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0,0,0,0.9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            p: 3
          }}
        >
          <Alert 
            severity="error" 
            sx={{ 
              maxWidth: 500,
              mb: 2 
            }}
          >
            {error}
          </Alert>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleRetry}
              startIcon={<Replay />}
            >
              Retry Playback
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              onClick={handleClose}
            >
              Close Player
            </Button>
          </Stack>
        </Box>
      )}

      {/* Video Element */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <video
          ref={videoRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            backgroundColor: '#000'
          }}
          onClick={handleVideoClick}
          onDoubleClick={toggleFullscreen}
          playsInline
        />

        {/* Buffering Indicator */}
        {buffering && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'white',
              bgcolor: 'rgba(0,0,0,0.7)',
              p: 3,
              borderRadius: 2,
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <CircularProgress size={40} sx={{ color: 'white', mb: 1 }} />
            <Typography>Buffering...</Typography>
          </Box>
        )}

        {/* Title Overlay */}
        {showTitle && (
          <Box
            className="player-controls"
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              p: 2,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
              color: 'white',
              opacity: showControls || !isPlaying ? 1 : 0,
              transition: 'opacity 0.3s',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 1000
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: { xs: '0.875rem', sm: '1rem' } }}>
              {title}
            </Typography>
            
            <Stack direction="row" spacing={1}>
              {currentQuality && qualities.length > 0 && (
                <Chip
                  icon={<HighQuality />}
                  label={currentQuality}
                  size="small"
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.2)', 
                    color: 'white',
                    '& .MuiChip-icon': { color: 'inherit' }
                  }}
                />
              )}
              <IconButton
                onClick={handleClose}
                size="small"
                sx={{ color: 'white' }}
              >
                <Close />
              </IconButton>
            </Stack>
          </Box>
        )}

        {/* Center Play Button */}
        {!isPlaying && !buffering && !error && !authError && (
          <IconButton
            onClick={togglePlay}
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'white',
              bgcolor: 'rgba(0,0,0,0.6)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
              width: 80,
              height: 80,
              zIndex: 1000
            }}
          >
            <PlayArrow sx={{ fontSize: 60 }} />
          </IconButton>
        )}

        {/* Controls Bar */}
        <Box
          className="player-controls"
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            p: 2,
            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
            color: 'white',
            opacity: showControls || !isPlaying ? 1 : 0,
            transition: 'opacity 0.3s',
            zIndex: 1000
          }}
        >
          {/* Progress Bar */}
          <Box sx={{ mb: 1.5 }}>
            <Slider
              value={currentTime}
              max={duration || 100}
              onChange={handleSeek}
              sx={{
                color: 'primary.main',
                height: 4,
                '& .MuiSlider-thumb': {
                  width: 12,
                  height: 12,
                  transition: 'width 0.2s, height 0.2s',
                  '&:hover, &.Mui-focusVisible': {
                    width: 16,
                    height: 16,
                  }
                },
                '& .MuiSlider-rail': {
                  opacity: 0.3,
                  bgcolor: 'grey.500'
                },
                '& .MuiSlider-track': {
                  transition: 'none'
                }
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
              <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                {formatTime(currentTime)}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                {formatTime(duration)}
              </Typography>
            </Box>
          </Box>

          {/* Control Buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              {/* Play/Pause */}
              <Tooltip title={isPlaying ? "Pause (k)" : "Play (k)"}>
                <IconButton 
                  onClick={togglePlay} 
                  sx={{ color: 'white' }}
                  size="small"
                >
                  {isPlaying ? <Pause /> : <PlayArrow />}
                </IconButton>
              </Tooltip>

              {/* Volume */}
              <Stack direction="row" spacing={1} alignItems="center" sx={{ width: 120 }}>
                <Tooltip title={isMuted ? "Unmute (m)" : "Mute (m)"}>
                  <IconButton 
                    onClick={toggleMute} 
                    sx={{ color: 'white' }}
                    size="small"
                  >
                    {isMuted ? <VolumeOff /> : <VolumeUp />}
                  </IconButton>
                </Tooltip>
                <Slider
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  min={0}
                  max={1}
                  step={0.1}
                  sx={{
                    color: 'white',
                    width: 80,
                    height: 4,
                    '& .MuiSlider-track': { border: 'none' },
                    '& .MuiSlider-rail': { opacity: 0.3 }
                  }}
                />
              </Stack>

              {/* Time Display */}
              <Typography variant="body2" sx={{ fontSize: '0.875rem', ml: 1 }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={0.5}>
              {/* Quality Selector */}
              {qualities.length > 0 && (
                <>
                  <Tooltip title="Quality Settings">
                    <IconButton 
                      onClick={handleQualityMenuOpen}
                      sx={{ color: 'white' }}
                      size="small"
                    >
                      <Settings />
                    </IconButton>
                  </Tooltip>
                  <Menu
                    anchorEl={qualityMenuAnchor}
                    open={Boolean(qualityMenuAnchor)}
                    onClose={handleQualityMenuClose}
                    PaperProps={{
                      sx: {
                        bgcolor: 'rgba(0,0,0,0.9)',
                        color: 'white',
                        '& .MuiMenuItem-root': {
                          fontSize: '0.875rem'
                        }
                      }
                    }}
                  >
                    <MenuItem 
                      onClick={() => changeQuality(-1)}
                      selected={currentQuality === 'Auto'}
                      sx={{
                        color: currentQuality === 'Auto' ? 'primary.main' : 'white'
                      }}
                    >
                      Auto
                    </MenuItem>
                    {qualities.map((quality) => (
                      <MenuItem 
                        key={quality.id}
                        onClick={() => changeQuality(quality.id)}
                        selected={currentQuality === quality.name}
                        sx={{
                          color: currentQuality === quality.name ? 'primary.main' : 'white'
                        }}
                      >
                        {quality.name} ({Math.round(quality.bitrate / 1000)}kbps)
                      </MenuItem>
                    ))}
                  </Menu>
                </>
              )}

              {/* Keyboard Shortcuts Help */}
              <Tooltip title="Keyboard Shortcuts">
                <IconButton 
                  onClick={() => setShowShortcuts(true)}
                  sx={{ color: 'white' }}
                  size="small"
                >
                  <Keyboard />
                </IconButton>
              </Tooltip>

              {/* Fullscreen */}
              <Tooltip title={isFullscreen ? "Exit Fullscreen (f)" : "Fullscreen (f)"}>
                <IconButton 
                  onClick={toggleFullscreen} 
                  sx={{ color: 'white' }}
                  size="small"
                >
                  {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
        </Box>
      </Box>

      {/* Keyboard Shortcuts Dialog */}
      <Dialog 
        open={showShortcuts} 
        onClose={() => setShowShortcuts(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Keyboard />
            <Typography>Keyboard Shortcuts</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography>Play/Pause</Typography>
              <Typography variant="body2" color="text.secondary">Space or K</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography>Fullscreen</Typography>
              <Typography variant="body2" color="text.secondary">F</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography>Mute/Unmute</Typography>
              <Typography variant="body2" color="text.secondary">M</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography>Seek Backward</Typography>
              <Typography variant="body2" color="text.secondary">← (10 seconds)</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography>Seek Forward</Typography>
              <Typography variant="body2" color="text.secondary">→ (10 seconds)</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography>Show/Hide Controls</Typography>
              <Typography variant="body2" color="text.secondary">C</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography>Exit Fullscreen</Typography>
              <Typography variant="body2" color="text.secondary">Escape</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowShortcuts(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Helper component for loading spinner
const CircularProgress = ({ size = 40, sx }) => (
  <Box
    sx={{
      width: size,
      height: size,
      border: `3px solid rgba(255, 255, 255, 0.3)`,
      borderTop: `3px solid white`,
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      '@keyframes spin': {
        '0%': { transform: 'rotate(0deg)' },
        '100%': { transform: 'rotate(360deg)' }
      },
      ...sx
    }}
  />
);

export default HLSVideoPlayer;