import { motion } from 'framer-motion';
import { 
  Card, CardContent, Box, Avatar, Typography, Chip, LinearProgress 
} from '@mui/material';
import {
  Download as DownloadIcon,
  Movie as MovieIcon,
  Tv as TvIcon,
  Storage as StorageIcon,
  PlayArrow as StreamIcon,
  Speed as SpeedIcon,
  CheckCircle as CompleteIcon,
  DataUsage as DataUsageIcon
} from '@mui/icons-material';

export const DownloadItem = ({ download }) => {
  const getFileTypeIcon = (filePath) => {
    if (filePath?.includes('/movies/')) return <MovieIcon />;
    if (filePath?.includes('/series/')) return <TvIcon />;
    return <StorageIcon />;
  };

  const getEventIcon = (type) => {
    switch (type) {
      case 'DOWNLOAD': return <DownloadIcon color="primary" />;
      case 'STREAM': return <StreamIcon color="success" />;
      default: return <StorageIcon />;
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm) + ' ' + sizes[i]);
  };

  const formatSpeed = (bytesPerSec) => {
    return formatBytes(bytesPerSec) + '/s';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="flex-start">
            <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
              {getFileTypeIcon(download.filePath)}
            </Avatar>
            <Box flexGrow={1}>
              <Typography variant="subtitle1" noWrap>
                {download.fileName || download.filePath?.split('/').pop() || 'Unknown file'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {download.userId}
              </Typography>
              
              <Box mt={1} display="flex" flexWrap="wrap" gap={1}>
                <Chip 
                  icon={getEventIcon(download.type)} 
                  label={download.type} 
                  size="small" 
                  variant="outlined"
                />
                <Chip 
                  icon={<SpeedIcon />}
                  label={formatSpeed(download.getTransferSpeed())}
                  size="small"
                />
                <Chip 
                  icon={<DataUsageIcon />}
                  label={`${formatBytes(download.bytesTransferred)} of ${formatBytes(download.fileSize)}`}
                  size="small"
                />
                {download.completed && (
                  <Chip 
                    icon={<CompleteIcon />}
                    label="Completed"
                    color="success"
                    size="small"
                  />
                )}
              </Box>
              
              {download.fileSize > 0 && (
                <Box mt={1}>
                  <LinearProgress 
                    variant="determinate" 
                    value={download.getCompletionPercentage()} 
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                  <Box display="flex" justifyContent="space-between" mt={0.5}>
                    <Typography variant="caption">
                      {download.getCompletionPercentage().toFixed(1)}% Complete
                    </Typography>
                    <Typography variant="caption">
                      {formatBytes(download.bytesTransferred)} / {formatBytes(download.fileSize)}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};