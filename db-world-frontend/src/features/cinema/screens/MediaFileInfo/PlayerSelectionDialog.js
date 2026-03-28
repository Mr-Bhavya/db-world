// components/PlayerSelectionDialog.jsx
import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Typography,
  Box,
  Chip,
  Alert,
  useTheme,
  alpha
} from '@mui/material';
import {
  PlayArrow,
  Download,
  SmartDisplay,
  Videocam,
  Language,
  CheckCircle,
  Warning,
  PhoneAndroid,
  Computer
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import PlayerService from './PlayerService';

const PlayerIcon = ({ playerId, isSelected, theme }) => {
  const iconProps = {
    sx: {
      fontSize: 24,
      color: isSelected ? theme.palette.primary.main : theme.palette.text.secondary
    }
  };

  const icons = {
    'browser': <Language {...iconProps} />,
    'vlc': <Videocam {...iconProps} />,
    'mxplayer': <PlayArrow {...iconProps} />,
    'system': <PhoneAndroid {...iconProps} />,
    'download': <Download {...iconProps} />,
    'default': <SmartDisplay {...iconProps} />
  };

  return icons[playerId] || icons.default;
};

const PlatformBadge = ({ platform }) => {
  const getPlatformConfig = (platform) => {
    const configs = {
      'android': { label: 'Android', color: 'success' },
      'ios': { label: 'iOS', color: 'info' },
      'mobile': { label: 'Mobile', color: 'primary' },
      'desktop': { label: 'Desktop', color: 'secondary' },
      'web': { label: 'Web', color: 'default' }
    };
    return configs[platform] || { label: platform, color: 'default' };
  };

  const config = getPlatformConfig(platform);

  return (
    <Chip
      label={config.label}
      size="small"
      color={config.color}
      variant="outlined"
      sx={{ ml: 1, height: 20, fontSize: '0.6rem' }}
    />
  );
};

const PlayerSelectionDialog = ({ 
  open, 
  onClose, 
  mediaInfo,
  onPlayerSelect 
}) => {
  const theme = useTheme();
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  // Get available players based on platform and media info
  const availablePlayers = useMemo(() => {
    const players = PlayerService.getAvailablePlayers(mediaInfo);
    
    // Set default selected player
    if (!selectedPlayer && players.length > 0) {
      const recommended = PlayerService.getRecommendedPlayer(mediaInfo);
      setSelectedPlayer(recommended.id);
    }
    
    return players;
  }, [mediaInfo, selectedPlayer]);

  const currentPlatform = PlayerService.getPlatform();
  const isMobile = PlayerService.isMobile();
  const isAndroid = PlayerService.isAndroid();

  const handlePlay = async () => {
    if (!selectedPlayer) return;

    try {
      const playerConfig = {
        fileName: mediaInfo.general?.fileName,
        isStream: selectedPlayer !== 'download'
      };

      const url = selectedPlayer === 'download' 
        ? mediaInfo.downloadUrl 
        : mediaInfo.streamUrl;

      await PlayerService.openWithSpecificPlayer(url, selectedPlayer, playerConfig);
      
      onPlayerSelect?.(selectedPlayer, mediaInfo);
      onClose();
    } catch (error) {
      console.error('Playback failed:', error);
      
      // Fallback strategy
      if (selectedPlayer === 'download') {
        PlayerService.downloadFile(mediaInfo.downloadUrl, mediaInfo.general?.fileName);
      } else {
        window.open(mediaInfo.streamUrl, '_blank');
      }
      
      onClose();
    }
  };

  const getPlayerDescription = (player) => {
    return PlayerService.getPlayerDescription(player.id) || player.description;
  };

  const hasStreamUrl = !!mediaInfo.streamUrl;
  const hasDownloadUrl = !!mediaInfo.downloadUrl;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.default, 0.95)} 100%)`,
          backdropFilter: 'blur(20px)',
          borderRadius: 3,
          boxShadow: `0 20px 60px ${alpha(theme.palette.common.black, 0.2)}`
        }
      }}
    >
      <DialogTitle sx={{ 
        bgcolor: alpha(theme.palette.primary.main, 0.1),
        borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        py: 2.5
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1.5,
            fontWeight: 700
          }}>
            <PlayArrow color="primary" />
            Play Media
          </Typography>
          <Chip 
            label={currentPlatform.toUpperCase()} 
            color="primary" 
            variant="outlined"
            size="small"
          />
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ py: 3, px: 2.5 }}>
        {/* Platform Info */}
        <Alert 
          severity="info" 
          sx={{ mb: 2 }}
          icon={isMobile ? <PhoneAndroid /> : <Computer />}
        >
          <Typography variant="body2">
            {isMobile 
              ? `Playing on ${isAndroid ? 'Android' : 'iOS'} device` 
              : 'Playing on desktop browser'
            }
          </Typography>
        </Alert>

        {/* Media Info Preview */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2, 
          mb: 3,
          p: 2.5,
          bgcolor: alpha(theme.palette.primary.main, 0.05),
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
        }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600, mb: 0.5 }}>
              {mediaInfo.general?.fileName || 'Media File'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {hasStreamUrl && (
                <Chip 
                  label="Stream Available" 
                  size="small" 
                  color="success" 
                  variant="outlined"
                  icon={<CheckCircle />}
                />
              )}
              {hasDownloadUrl && (
                <Chip 
                  label="Download Available" 
                  size="small" 
                  color="info" 
                  variant="outlined"
                  icon={<Download />}
                />
              )}
            </Box>
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 500 }}>
          Choose how you want to play this media:
        </Typography>
        
        <List sx={{ width: '100%', py: 0 }}>
          <AnimatePresence>
            {availablePlayers.map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <ListItem disablePadding sx={{ mb: 1 }}>
                  <ListItemButton
                    selected={selectedPlayer === player.id}
                    onClick={() => setSelectedPlayer(player.id)}
                    sx={{
                      borderRadius: 2,
                      border: `2px solid ${
                        selectedPlayer === player.id 
                          ? theme.palette.primary.main 
                          : alpha(theme.palette.text.secondary, 0.1)
                      }`,
                      bgcolor: selectedPlayer === player.id 
                        ? alpha(theme.palette.primary.main, 0.1)
                        : 'transparent',
                      py: 2.5,
                      px: 2,
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                        borderColor: alpha(theme.palette.primary.main, 0.3),
                        transform: 'translateY(-1px)'
                      },
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 48, mr: 2 }}>
                      <PlayerIcon 
                        playerId={player.id} 
                        isSelected={selectedPlayer === player.id}
                        theme={theme}
                      />
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {player.name}
                          </Typography>
                          {player.platforms && player.platforms.length > 0 && (
                            <PlatformBadge platform={player.platforms[0]} />
                          )}
                          {selectedPlayer === player.id && (
                            <CheckCircle 
                              sx={{ 
                                fontSize: 18, 
                                color: 'primary.main',
                                ml: 'auto'
                              }} 
                            />
                          )}
                        </Box>
                      }
                      secondary={getPlayerDescription(player)}
                      secondaryTypographyProps={{
                        variant: 'body2',
                        color: 'text.secondary',
                        lineHeight: 1.4
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              </motion.div>
            ))}
          </AnimatePresence>
        </List>
      </DialogContent>
      
      <DialogActions sx={{ p: 3, gap: 1.5 }}>
        <Button 
          onClick={onClose} 
          variant="outlined"
          sx={{ 
            borderRadius: 2,
            px: 3,
            fontWeight: 600
          }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handlePlay}
          variant="contained"
          disabled={!selectedPlayer}
          startIcon={selectedPlayer === 'download' ? <Download /> : <PlayArrow />}
          sx={{
            borderRadius: 2,
            px: 3,
            fontWeight: 600,
            bgcolor: theme.palette.primary.main,
            '&:hover': {
              bgcolor: theme.palette.primary.dark,
              transform: 'translateY(-1px)',
              boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`
            },
            transition: 'all 0.2s ease'
          }}
        >
          {selectedPlayer === 'download' ? 'Download' : 'Play'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlayerSelectionDialog;