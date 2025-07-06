import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Card, 
  CardHeader, 
  CardContent, 
  Divider, 
  Tabs, 
  Tab, 
  Chip,
  Collapse,
  IconButton,
  Paper,
  Grid
} from '@mui/material';
import { 
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle,
  RadioButtonUnchecked
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { styled } from '@mui/system';

const StyledCard = styled(Card)(({ theme, selected }) => ({
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  border: selected ? `2px solid ${theme.palette.primary.main}` : `1px solid ${theme.palette.divider}`,
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4]
  }
}));

const FormatCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: theme.palette.action.hover
  }
}));

const FormatSelection = ({ formats, onHandleSubmit, isLoading }) => {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [activeTab, setActiveTab] = useState('video');
  const [expandedGroups, setExpandedGroups] = useState({});

  // Filter and group formats
  const videoFormats = formats.filter(format => format.video_ext !== 'none');
  const audioFormats = formats.filter(format => format.video_ext === 'none');

  // Group video formats by resolution
  const groupedVideoFormats = videoFormats.reduce((groups, format) => {
    const resolution = format.resolution || 'Other';
    if (!groups[resolution]) {
      groups[resolution] = [];
    }
    groups[resolution].push(format);
    return groups;
  }, {});

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const toggleGroup = (resolution) => {
    setExpandedGroups(prev => ({
      ...prev,
      [resolution]: !prev[resolution]
    }));
  };

  const handleSubmit = () => {
    if (!selectedVideo) {
      alert('Please select a video format');
      return;
    }
    onHandleSubmit(selectedVideo?.format_id, selectedAudio?.format_id);
  };

  const formatSize = (bytes) => {
    if (!bytes) return 'N/A';
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" gutterBottom>
        Select Video/Audio Quality
      </Typography>

      <Tabs 
        value={activeTab} 
        onChange={handleTabChange} 
        variant="fullWidth"
        sx={{ mb: 3 }}
      >
        <Tab label="Video Quality" value="video" />
        <Tab label="Audio Quality" value="audio" />
      </Tabs>

      <Divider sx={{ mb: 3 }} />

      {activeTab === 'video' && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Video Formats
          </Typography>

          {Object.entries(groupedVideoFormats).map(([resolution, formats]) => (
            <Card key={resolution} sx={{ mb: 2 }}>
              <CardHeader
                title={`${resolution} Resolution`}
                action={
                  <IconButton onClick={() => toggleGroup(resolution)}>
                    {expandedGroups[resolution] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                }
                sx={{ cursor: 'pointer' }}
                onClick={() => toggleGroup(resolution)}
              />
              
              <Collapse in={expandedGroups[resolution]}>
                <CardContent>
                  <Grid container spacing={2}>
                    {formats.map((format, index) => (
                      <Grid item xs={12} sm={6} md={4} key={index}>
                        <motion.div whileHover={{ scale: 1.02 }}>
                          <StyledCard 
                            selected={selectedVideo?.format_id === format.format_id}
                            onClick={() => setSelectedVideo(format)}
                          >
                            <CardContent>
                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="subtitle1">
                                  {format.format_note || 'Unknown'}
                                </Typography>
                                {selectedVideo?.format_id === format.format_id ? (
                                  <CheckCircle color="primary" />
                                ) : (
                                  <RadioButtonUnchecked color="disabled" />
                                )}
                              </Box>

                              <Divider sx={{ my: 1 }} />

                              <Typography variant="body2">
                                <strong>Codec:</strong> {format.vcodec}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Size:</strong> {formatSize(format.filesize)}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Quality:</strong> {format.quality}
                              </Typography>

                              <Box mt={1}>
                                <Chip 
                                  label={selectedVideo?.format_id === format.format_id ? 'Selected' : 'Select'} 
                                  color={selectedVideo?.format_id === format.format_id ? 'primary' : 'default'}
                                  size="small"
                                />
                              </Box>
                            </CardContent>
                          </StyledCard>
                        </motion.div>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Collapse>
            </Card>
          ))}
        </Box>
      )}

      {activeTab === 'audio' && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Audio Formats
          </Typography>

          <Grid container spacing={2}>
            {audioFormats.map((format, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <motion.div whileHover={{ scale: 1.02 }}>
                  <StyledCard 
                    selected={selectedAudio?.format_id === format.format_id}
                    onClick={() => setSelectedAudio(format)}
                  >
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle1">
                          {format.format_note || 'Unknown'}
                        </Typography>
                        {selectedAudio?.format_id === format.format_id ? (
                          <CheckCircle color="primary" />
                        ) : (
                          <RadioButtonUnchecked color="disabled" />
                        )}
                      </Box>

                      <Divider sx={{ my: 1 }} />

                      <Typography variant="body2">
                        <strong>Codec:</strong> {format.acodec}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Bitrate:</strong> {format.abr} kbps
                      </Typography>
                      <Typography variant="body2">
                        <strong>Size:</strong> {formatSize(format.filesize)}
                      </Typography>

                      <Box mt={1}>
                        <Chip 
                          label={selectedAudio?.format_id === format.format_id ? 'Selected' : 'Select'} 
                          color={selectedAudio?.format_id === format.format_id ? 'primary' : 'default'}
                          size="small"
                        />
                      </Box>
                    </CardContent>
                  </StyledCard>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Selection Summary
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader 
                title="Video Format" 
                sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}
              />
              <CardContent>
                {selectedVideo ? (
                  <>
                    <Typography variant="subtitle1" gutterBottom>
                      {selectedVideo.format_note}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Codec:</strong> {selectedVideo.vcodec}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Size:</strong> {formatSize(selectedVideo.filesize)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Quality:</strong> {selectedVideo.quality}
                    </Typography>
                  </>
                ) : (
                  <Typography color="textSecondary">
                    No video format selected (required)
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader 
                title="Audio Format" 
                sx={{ bgcolor: 'secondary.main', color: 'secondary.contrastText' }}
              />
              <CardContent>
                {selectedAudio ? (
                  <>
                    <Typography variant="subtitle1" gutterBottom>
                      {selectedAudio.format_note}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Codec:</strong> {selectedAudio.acodec}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Bitrate:</strong> {selectedAudio.abr} kbps
                    </Typography>
                    <Typography variant="body2">
                      <strong>Size:</strong> {formatSize(selectedAudio.filesize)}
                    </Typography>
                  </>
                ) : (
                  <Typography color="textSecondary">
                    No audio format selected (optional)
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Button 
          variant="contained" 
          size="large" 
          onClick={handleSubmit}
          disabled={!selectedVideo || isLoading}
          sx={{ px: 6, py: 1.5 }}
        >
          {isLoading ? 'Processing...' : 'Start Download'}
        </Button>
      </Box>
    </Box>
  );
};

export default FormatSelection;