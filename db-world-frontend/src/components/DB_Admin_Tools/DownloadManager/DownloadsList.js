import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download as DownloadIcon,
  HourglassEmpty as HourglassIcon,
  CloudQueue as CloudIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  PauseCircle as PauseCircleIcon,
  PlayCircle as PlayCircleIcon,
  Archive as ArchiveIcon,
  Merge as MergeIcon,
  VideoSettings as VideoSettingsIcon,
  Close as CloseIcon,
  Queue as QueueIcon
} from '@mui/icons-material';
import {
  Box,
  Typography,
  useMediaQuery,
  useTheme,
  alpha
} from '@mui/material';
import StatusCard from './StatusCard';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
};

// Status group configuration
const STATUS_GROUPS = {
  ACTIVE: {
    title: 'Active Downloads',
    statuses: ['DOWNLOAD', 'EXTRACT', 'MERGE', 'FFMPEG', 'RESUME'],
    icon: DownloadIcon,
    color: 'primary',
    order: 1
  },
  QUEUED: {
    title: 'Queued',
    statuses: [], // Will be handled by isQueued flag
    icon: QueueIcon,
    color: 'info',
    order: 2
  },
  PAUSED: {
    title: 'Paused',
    statuses: ['PAUSE'],
    icon: PauseCircleIcon,
    color: 'warning',
    order: 3
  },
  COMPLETED: {
    title: 'Completed',
    statuses: ['SUCCESS', 'COMPLETE'],
    icon: CheckCircleIcon,
    color: 'success',
    order: 4
  },
  FAILED: {
    title: 'Failed',
    statuses: ['FAILED'],
    icon: ErrorIcon,
    color: 'error',
    order: 5
  },
  CANCELLED: {
    title: 'Cancelled',
    statuses: ['CANCELLED'],
    icon: CloseIcon,
    color: 'grey',
    order: 6
  }
};

// Simplified skeleton loader
const DownloadSkeleton = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.5 }}
      transition={{ duration: 0.3 }}
      style={{ marginBottom: isMobile ? 12 : 16 }}
    >
      <div style={{
        padding: isMobile ? 16 : 20,
        borderRadius: 12,
        background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
        border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 12,
          marginBottom: 12
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: `linear-gradient(90deg, ${alpha(theme.palette.action.disabled, 0.2)} 25%, ${alpha(theme.palette.action.disabled, 0.1)} 50%, ${alpha(theme.palette.action.disabled, 0.2)} 75%)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite'
          }} />
          <div style={{ flex: 1 }}>
            <div style={{
              height: 16,
              width: '70%',
              marginBottom: 8,
              background: `linear-gradient(90deg, ${alpha(theme.palette.action.disabled, 0.2)} 25%, ${alpha(theme.palette.action.disabled, 0.1)} 50%, ${alpha(theme.palette.action.disabled, 0.2)} 75%)`,
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              borderRadius: 4
            }} />
            <div style={{
              height: 12,
              width: '50%',
              background: `linear-gradient(90deg, ${alpha(theme.palette.action.disabled, 0.2)} 25%, ${alpha(theme.palette.action.disabled, 0.1)} 50%, ${alpha(theme.palette.action.disabled, 0.2)} 75%)`,
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              borderRadius: 4
            }} />
          </div>
        </div>
        <div style={{
          height: 8,
          width: '100%',
          marginBottom: 8,
          background: `linear-gradient(90deg, ${alpha(theme.palette.action.disabled, 0.2)} 25%, ${alpha(theme.palette.action.disabled, 0.1)} 50%, ${alpha(theme.palette.action.disabled, 0.2)} 75%)`,
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
          borderRadius: 4
        }} />
      </div>
    </motion.div>
  );
};

// Group headings with icons
const StatusGroupHeading = ({ title, count, icon: Icon, color }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        marginTop: 24,
        padding: '8px 0'
      }}
    >
      <Box sx={{
        width: 4,
        height: 24,
        background: theme.palette[color]?.main || color,
        borderRadius: 2
      }} />
      <Icon sx={{ 
        color: theme.palette[color]?.main || color,
        fontSize: isMobile ? 20 : 24
      }} />
      <Typography variant="h6" sx={{ 
        fontWeight: 600, 
        color: 'text.primary',
        fontSize: isMobile ? '1rem' : '1.125rem'
      }}>
        {title} ({count})
      </Typography>
    </motion.div>
  );
};

// Empty state component
const EmptyDownloadsState = ({ isMobile }) => {
  const theme = useTheme();
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        padding: isMobile ? '32px 16px' : '48px 32px',
        textAlign: 'center',
        borderRadius: 12,
        background: alpha(theme.palette.background.paper, 0.8),
        backdropFilter: 'blur(10px)',
        border: `2px dashed ${alpha(theme.palette.divider, 0.3)}`,
        margin: isMobile ? '16px 0' : '24px 0'
      }}
    >
      <CloudIcon
        style={{
          fontSize: isMobile ? 48 : 64,
          color: theme.palette.text.secondary,
          marginBottom: 16,
          opacity: 0.7
        }}
      />
      <Typography variant="h5" sx={{ 
        color: 'text.primary', 
        fontWeight: 600,
        marginBottom: 2,
        fontSize: isMobile ? '1.25rem' : '1.5rem'
      }}>
        No Downloads Found
      </Typography>
      <Typography variant="body1" sx={{ 
        color: 'text.secondary',
        marginBottom: 3,
        maxWidth: 500,
        marginLeft: 'auto',
        marginRight: 'auto',
        fontSize: isMobile ? '0.9rem' : '1rem'
      }}>
        There are no active or queued downloads at the moment.
        Add new downloads using the form above to get started.
      </Typography>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        gap: 1,
        color: 'success.main',
        fontWeight: 500,
        fontSize: isMobile ? '0.875rem' : '0.95rem'
      }}>
        <HourglassIcon sx={{ fontSize: isMobile ? 16 : 20 }} />
        Ready to accept new downloads
      </Box>
    </motion.div>
  );
};

// Function to categorize downloads into groups
const categorizeDownloads = (downloads) => {
  const groups = {};
  
  // Initialize empty arrays for all groups
  Object.keys(STATUS_GROUPS).forEach(groupKey => {
    groups[groupKey] = [];
  });
  
  // Categorize each download
  downloads.forEach(download => {
    const status = download?.status?.currentState || '';
    const isQueued = download?.isQueued || false;
    
    let categorized = false;
    
    // First check if queued (special case)
    if (isQueued) {
      groups.QUEUED.push(download);
      categorized = true;
    }
    
    // Check other status groups
    if (!categorized) {
      for (const [groupKey, groupConfig] of Object.entries(STATUS_GROUPS)) {
        if (groupKey === 'QUEUED') continue; // Already handled
        
        if (groupConfig.statuses.includes(status)) {
          groups[groupKey].push(download);
          categorized = true;
          break;
        }
      }
    }
    
    // If still not categorized, put in ACTIVE as fallback
    if (!categorized) {
      groups.ACTIVE.push(download);
    }
  });
  
  return groups;
};

const DownloadsList = ({ downloads = [], loading = false, onStatusChange }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Memoize categorized downloads
  const categorizedDownloads = useMemo(() => {
    if (!downloads || downloads.length === 0) return {};
    return categorizeDownloads(downloads);
  }, [downloads]);
  
  // Check if we have any downloads
  const hasDownloads = useMemo(() => {
    return Object.values(categorizedDownloads).some(group => group.length > 0);
  }, [categorizedDownloads]);
  
  // Show loading skeletons
  if (loading) {
    return (
      <Box sx={{ width: '100%' }}>
        <style>{`
          @keyframes shimmer {
            0% { background-position: -200px 0; }
            100% { background-position: 200px 0; }
          }
        `}</style>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: isMobile ? 12 : 16,
            alignItems: 'start'
          }}
        >
          {[...Array(4)].map((_, index) => (
            <DownloadSkeleton key={`skeleton-${index}`} />
          ))}
        </motion.div>
      </Box>
    );
  }
  
  // Show empty state if no downloads
  if (!hasDownloads && !loading) {
    return <EmptyDownloadsState isMobile={isMobile} />;
  }
  
  // Sort groups by predefined order
  const sortedGroups = Object.entries(STATUS_GROUPS)
    .sort((a, b) => a[1].order - b[1].order)
    .filter(([groupKey]) => categorizedDownloads[groupKey]?.length > 0);
  
  return (
    <Box sx={{ width: '100%' }}>
      {sortedGroups.map(([groupKey, groupConfig]) => {
        const groupDownloads = categorizedDownloads[groupKey] || [];
        
        return (
          <Box key={groupKey} sx={{ mb: groupKey === 'CANCELLED' ? 0 : 4 }}>
            <StatusGroupHeading
              title={groupConfig.title}
              count={groupDownloads.length}
              icon={groupConfig.icon}
              color={groupConfig.color}
            />
            
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: isMobile ? 12 : 16,
                alignItems: 'start'
              }}
            >
              <AnimatePresence>
                {groupDownloads.map((download, index) => (
                  <motion.div
                    key={download?.status?.id || `download-${index}`}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                  >
                    <StatusCard 
                      download={download} 
                      onStatusChange={onStatusChange}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </Box>
        );
      })}
    </Box>
  );
};

export default React.memo(DownloadsList);