import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  LinearProgress,
  useTheme,
  useMediaQuery,
  alpha,
  Fade,
  Zoom,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton as MuiIconButton,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Snackbar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CardHeader
} from '@mui/material';
import {
  Download as DownloadIcon,
  PlayArrow as StreamIcon,
  Person as PersonIcon,
  Refresh,
  Analytics,
  People,
  TrendingUp,
  NetworkCheck,
  Schedule,
  ExpandMore,
  FolderOpen,
  CloudDownload,
  VideoLibrary,
  Dashboard,
  Visibility,
  Search,
  Close,
  BarChart,
  Timeline,
  Map,
  Language,
  Devices,
  Storage,
  AccessTime,
  DateRange,
  FilterList,
  FileOpen,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Error as ErrorIcon,
  Group as GroupIcon,
  ViewList as ViewListIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { getActivityStatsAllApi, getAllRecentActivitiesApi, getDashboardStatsApi, getInitialDataApi, getUserActivitiesApi, getUserListApi } from '../../ApiServices';

// --- Constants & Configuration ---
const ACTIVITY_CONFIG = {
  DOWNLOAD: {
    icon: CloudDownload,
    color: 'info',
    label: 'Download',
    gradient: 'linear-gradient(135deg, #00bfa5 0%, #009688 100%)'
  },
  STREAM: {
    icon: VideoLibrary,
    color: 'success',
    label: 'Stream',
    gradient: 'linear-gradient(135deg, #26a69a 0%, #88cfc8ff 100%)'
  },
  SEARCH: {
    icon: Search,
    color: 'warning',
    label: 'Search',
    gradient: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
  }
};

// Grouping options
const GROUPING_OPTIONS = [
  { value: 'none', label: 'No Grouping', icon: ViewListIcon },
  { value: 'user', label: 'User', icon: People },
  { value: 'activity', label: 'Activity Type', icon: BarChart },
  { value: 'file', label: 'File', icon: FolderOpen },
  { value: 'search', label: 'Search Keyword', icon: Search }
];

// --- Utility Functions with null checks ---
const formatTimeAgo = (timestamp) => {
  if (!timestamp || timestamp === 'undefined' || timestamp === 'null') return "Just now";
  try {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch (error) {
    return "Just now";
  }
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 'undefined' || bytes === 'null' || isNaN(bytes)) return '0 B';
  try {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  } catch (error) {
    return '0 B';
  }
};

const safeGet = (obj, path, defaultValue = null) => {
  if (!obj || obj === 'undefined' || obj === 'null') return defaultValue;
  try {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
      result = result?.[key];
      if (result === undefined || result === null) return defaultValue;
    }
    return result || defaultValue;
  } catch (error) {
    return defaultValue;
  }
};

// --- Glassmorphism Card Component ---
const GlassCard = ({ children, sx = {}, ...props }) => {
  const theme = useTheme();
  return (
    <Card
      sx={{
        background: alpha(theme.palette.background.paper, 0.85),
        backdropFilter: 'blur(20px)',
        border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        borderRadius: 3,
        boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.08)}`,
        overflow: 'hidden',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, #00bfa5, #26c6da, #009688)',
          opacity: 0.6,
        },
        ...sx
      }}
      {...props}
    >
      {children}
    </Card>
  );
};

// --- Animated Stat Card ---
const AnimatedStatCard = ({ icon: Icon, title, value, subtitle, color = 'primary', trend, delay = 0 }) => {
  const theme = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const safeValue = value || value === 0 ? value : '--';
  const safeTitle = title || 'N/A';
  const safeSubtitle = subtitle || '';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: delay / 1000, duration: 0.4 }}
    >
      <GlassCard
        sx={{
          height: '100%',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-6px)',
            boxShadow: `0 16px 32px ${alpha(theme.palette[color].main, 0.15)}`,
          },
        }}
      >
        <CardContent sx={{ p: 2, textAlign: 'center' }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 70,
              height: 70,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${alpha(theme.palette[color].main, 0.1)} 0%, ${alpha(theme.palette[color].light, 0.05)} 100%)`,
              color: theme.palette[color].main,
              mb: 2,
              border: `2px solid ${alpha(theme.palette[color].main, 0.2)}`,
            }}
          >
            <Icon sx={{ fontSize: 30 }} />
          </Box>

          <Typography
            variant="h3"
            fontWeight="bold"
            sx={{
              background: `linear-gradient(135deg, ${theme.palette[color].main}, ${theme.palette[color].light})`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              mb: 1,
            }}
          >
            {safeValue}
          </Typography>
          <Typography variant="h6" fontWeight="600" color="text.primary" gutterBottom>
            {safeTitle}
          </Typography>
          {safeSubtitle && (
            <Typography variant="body2" color="text.secondary">
              {safeSubtitle}
              {trend && (
                <Chip
                  label={trend}
                  size="small"
                  color={trend.includes('+') ? 'success' : 'error'}
                  sx={{ ml: 1, height: 20, fontSize: '0.6rem' }}
                />
              )}
            </Typography>
          )}
        </CardContent>
      </GlassCard>
    </motion.div>
  );
};

// --- Activity Item Component ---
const ActivityItem = ({ activity, showUser = false }) => {
  const theme = useTheme();

  if (!activity || activity === 'undefined' || activity === 'null') {
    return null;
  }

  const config = ACTIVITY_CONFIG[activity.activityType] || ACTIVITY_CONFIG.SEARCH;
  const Icon = config.icon;
  const fileName = activity.filePath?.split(/[\\/]/).pop() || 'Unknown file';
  const safeUserEmail = activity.userEmail || 'Unknown user';

  return (
    <Paper
      sx={{
        p: 2,
        mb: 1.5,
        borderRadius: 2,
        background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.default, 0.7)} 100%)`,
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateX(4px)',
          borderColor: alpha(theme.palette.primary.main, 0.3),
          boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.1)}`,
        }
      }}
    >
      <Box display="flex" alignItems="center" gap={2}>
        <Avatar
          sx={{
            background: config.gradient,
            width: 44,
            height: 44,
            boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
          }}
        >
          <Icon sx={{ fontSize: 20 }} />
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            {showUser && (
              <Chip
                label={safeUserEmail}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
            <Typography variant="subtitle2" fontWeight="600" noWrap>
              {fileName}
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Chip
              label={config.label}
              size="small"
              sx={{
                background: config.gradient,
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.7rem',
                height: 20
              }}
            />

            {activity.fileSize && (
              <Chip
                label={formatFileSize(activity.fileSize)}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}

            <Box display="flex" alignItems="center" gap={0.5}>
              <Schedule sx={{ fontSize: 12, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {formatTimeAgo(activity.lastUpdated)}
              </Typography>
            </Box>
          </Box>

          {activity.activityValue && activity.activityType === 'SEARCH' && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Search: "{activity.activityValue}"
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
};

// --- Grouped Activities Component ---
const GroupedActivities = ({ activities, groupBy }) => {
  const theme = useTheme();

  // Group activities based on the selected grouping option
  const groupedActivities = useMemo(() => {
    if (!activities.length || groupBy === 'none') {
      return { 'All Activities': activities };
    }

    const groups = {};

    activities.forEach(activity => {
      let groupKey = 'Unknown';

      switch (groupBy) {
        case 'user':
          groupKey = activity.userEmail || 'Unknown User';
          break;
        case 'activity':
          groupKey = activity.activityType || 'Unknown Activity';
          break;
        case 'file':
          groupKey = activity.filePath?.split(/[\\/]/).pop() || 'Unknown File';
          break;
        case 'search':
          groupKey = activity.activityType === 'SEARCH'
            ? (activity.activityValue || 'Unknown Search')
            : 'Non-Search Activities';
          break;
        default:
          groupKey = 'All Activities';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(activity);
    });

    return groups;
  }, [activities, groupBy]);

  if (Object.keys(groupedActivities).length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
        No activities found
      </Typography>
    );
  }

  return (
    <Box>
      {Object.entries(groupedActivities).map(([groupName, groupActivities], index) => (
        <Accordion
          key={groupName}
          defaultExpanded={index === 0}
          sx={{
            mb: 2,
            background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.default, 0.7)} 100%)`,
            borderRadius: 2,
            '&:before': { display: 'none' }
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore />}
            sx={{
              borderRadius: 2,
              '& .MuiAccordionSummary-content': {
                alignItems: 'center',
                gap: 1
              }
            }}
          >
            <Box display="flex" alignItems="center" gap={1} flex={1}>
              <Typography variant="h6" fontWeight="600">
                {groupName}
              </Typography>
              <Chip
                label={`${groupActivities.length} activities`}
                size="small"
                color="primary"
                variant="outlined"
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box>
              {groupActivities.map((activity, activityIndex) => (
                <ActivityItem
                  key={activityIndex}
                  activity={activity}
                  showUser={groupBy !== 'user'}
                />
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

// --- Analytics Charts Components ---
const SimpleBarChart = ({ data, title, color = '#00bfa5' }) => {
  const safeData = Array.isArray(data) ? data.filter(item => item && item.value != null) : [];
  const maxValue = safeData.length > 0 ? Math.max(...safeData.map(d => d.value)) : 1;

  return (
    <GlassCard sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>{title || 'Chart'}</Typography>
        <Box sx={{ mt: 2 }}>
          {safeData.length > 0 ? (
            safeData.map((item, index) => (
              <Box key={index} sx={{ mb: 2 }}>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="body2">{item.label || 'Unknown'}</Typography>
                  <Typography variant="body2" fontWeight="bold">{item.value}</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(item.value / maxValue) * 100}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: alpha(color, 0.2),
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: color,
                      borderRadius: 4,
                    }
                  }}
                />
              </Box>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary" textAlign="center">
              No data available
            </Typography>
          )}
        </Box>
      </CardContent>
    </GlassCard>
  );
};

// --- Main Dashboard Component ---
const UserCinemaActivity = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [activeTab, setActiveTab] = useState(0);
  const [apiData, setApiData] = useState({});
  const [filters, setFilters] = useState({
    activityType: '',
    timeRange: '24',
    search: ''
  });
  const [groupBy, setGroupBy] = useState('none');
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Check if user is admin
  const isAdmin = (role) => {
    return role === 'ADMIN' || role === 'OWNER';
  };

  // Load initial data
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const initialData = await getInitialDataApi();

      if (initialData && initialData.userRole) {
        setUserRole(initialData.userRole);
        if (initialData.adminData) {
          setApiData(prev => ({ ...prev, ...initialData.adminData }));
        }
        setSuccess('Data loaded successfully');
      }

    } catch (err) {
      console.error('❌ Failed to load initial data:', err);
      setError(err.response?.data?.error || 'Failed to load initial data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data based on active tab and filters
  const loadTabData = useCallback(async () => {
    if (!userRole) return;

    try {
      setLoading(true);
      setError(null);

      let data;

      switch (activeTab) {
        case 0: // Dashboard
          data = await getDashboardStatsApi(parseInt(filters.timeRange) || 7);
          setApiData(prev => ({
            ...prev,
            dashboardStats: safeGet(data, 'stats', {}),
            type: safeGet(data, 'type')
          }));

          data = await getAllRecentActivitiesApi({
            hours: parseInt(filters.timeRange) || 24,
            activityType: filters.activityType || undefined,
            limit: 50
          });
          setApiData(prev => ({
            ...prev,
            activities: safeGet(data, 'activities', []),
            activitiesCount: safeGet(data, 'count', 0),
            type: safeGet(data, 'type')
          }));

          // Load user list for the user analytics table
          data = await getUserListApi(parseInt(filters.timeRange) || 24);
          setApiData(prev => ({
            ...prev,
            users: safeGet(data, 'users', []),
            usersCount: safeGet(data, 'count', 0)
          }));
          break;

        case 1: // Recent Activities
          data = await getAllRecentActivitiesApi({
            hours: parseInt(filters.timeRange) || 24,
            activityType: filters.activityType || undefined,
            limit: 100
          });
          setApiData(prev => ({
            ...prev,
            activities: safeGet(data, 'activities', []),
            activitiesCount: safeGet(data, 'count', 0),
            type: safeGet(data, 'type')
          }));
          break;

        case 2: // Analytics
          data = await getActivityStatsAllApi(parseInt(filters.timeRange) || 7);
          setApiData(prev => ({
            ...prev,
            activityStats: safeGet(data, 'stats', {}),
            type: safeGet(data, 'type')
          }));
          break;

        default:
          console.warn('Unknown tab:', activeTab);
      }

      setSuccess('Data loaded successfully');
    } catch (err) {
      console.error('❌ Failed to load data:', err);
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters, userRole]);

  // Initial load
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load tab data when tab or filters change
  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  const handleRetry = () => {
    setError(null);
    loadTabData();
  };

  const handleFilterChange = (key, value) => {
    console.log(`🔧 Filter changed: ${key} = ${value}`);
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleGroupByChange = (value) => {
    setGroupBy(value);
  };

  const handleCloseError = () => {
    setError(null);
  };

  const handleCloseSuccess = () => {
    setSuccess(null);
  };

  // Process data for display with null checks
  const processedData = useMemo(() => {
    const stats = safeGet(apiData, 'activityStats', {});
    const activities = safeGet(apiData, 'activities', []);
    const users = safeGet(apiData, 'users', []);
    const dashboardStats = safeGet(apiData, 'dashboardStats', {});

    return {
      dashboardStats: {
        totalActivities: safeGet(dashboardStats, 'totalActivities', 0),
        uniqueUsers: safeGet(dashboardStats, 'uniqueUsers', 0),
        totalDownloads: safeGet(stats, 'DOWNLOAD', 0),
        totalStreams: safeGet(stats, 'STREAM', 0),
        totalSearches: safeGet(stats, 'SEARCH', 0),
        ...dashboardStats
      },
      activities: Array.isArray(activities) ? activities : [],
      users: Array.isArray(users) ? users : [],
      activityStats: stats,
      activitiesCount: safeGet(apiData, 'activitiesCount', 0),
      usersCount: safeGet(apiData, 'usersCount', 0)
    };
  }, [apiData]);

  // Show role-based access message for regular users
  if (userRole && !isAdmin(userRole)) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '50vh',
        flexDirection: 'column',
        gap: 3,
        p: 3
      }}>
        <Box textAlign="center">
          <Typography variant="h5" gutterBottom>
            Activity Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You don't have admin privileges to view this dashboard.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Role: {userRole}
          </Typography>
        </Box>

        <Button
          variant="contained"
          onClick={loadInitialData}
          startIcon={<Refresh />}
        >
          Refresh
        </Button>
      </Box>
    );
  }

  // Show loading state
  if (loading && !apiData.dashboardStats) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '50vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress size={60} />
        <Typography variant="h6" color="text.secondary">
          Loading activity data...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', py: 4, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
      <Container maxWidth="xl">
        {/* Notifications */}
        <Snackbar open={!!error} autoHideDuration={6000} onClose={handleCloseError}>
          <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        </Snackbar>

        <Snackbar open={!!success} autoHideDuration={3000} onClose={handleCloseSuccess}>
          <Alert onClose={handleCloseSuccess} severity="success" sx={{ width: '100%' }}>
            {success}
          </Alert>
        </Snackbar>

        {/* Combined Header */}
        <Box sx={{ mb: 4 }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Main Header Row */}
            <Box display="flex" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
              {/* Title Section */}
              <Box sx={{ flex: 1, minWidth: 250 }}>
                <Typography
                  variant="h3"
                  fontWeight="bold"
                  sx={{
                    background: 'linear-gradient(135deg, #009688 0%, #00bfa5 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                    mb: 0.5,
                    fontSize: { xs: 'h4.fontSize', md: 'h3.fontSize' }
                  }}
                >
                  Activity Analytics
                </Typography>
                <Typography
                  variant="h6"
                  color="text.secondary"
                  sx={{
                    fontWeight: 400,
                    fontSize: { xs: 'body1.fontSize', md: 'h6.fontSize' }
                  }}
                >
                  Monitor user downloads, streams, and searches
                </Typography>
              </Box>

              {/* User Role and Refresh Button */}
              <Box display="flex" alignItems="center" gap={2} sx={{ flexShrink: 0 }}>
                {userRole && (
                  <Chip
                    label={`Role: ${userRole}`}
                    color={isAdmin(userRole) ? "success" : "default"}
                    variant="outlined"
                    sx={{ display: { xs: 'none', sm: 'flex' } }}
                  />
                )}
                <Tooltip title="Refresh Data">
                  <IconButton
                    onClick={handleRetry}
                    disabled={loading}
                    sx={{
                      display: { xs: 'none', md: 'flex' },
                      '&:hover': { backgroundColor: 'action.hover' }
                    }}
                  >
                    <Refresh />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Filters Section */}
            <GlassCard sx={{ p: 2 }}>
              <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
                {/* Activity Type Filter */}
                <FormControl size="small" sx={{ minWidth: 120, flex: { xs: '1 1 120px', sm: '0 1 auto' } }}>
                  <InputLabel>Activity Type</InputLabel>
                  <Select
                    value={filters.activityType}
                    label="Activity Type"
                    onChange={(e) => handleFilterChange('activityType', e.target.value)}
                  >
                    <MenuItem value="">All Activities</MenuItem>
                    <MenuItem value="DOWNLOAD">Downloads</MenuItem>
                    <MenuItem value="STREAM">Streams</MenuItem>
                    <MenuItem value="SEARCH">Searches</MenuItem>
                  </Select>
                </FormControl>

                {/* Time Range Filter */}
                <FormControl size="small" sx={{ minWidth: 120, flex: { xs: '1 1 120px', sm: '0 1 auto' } }}>
                  <InputLabel>Time Range</InputLabel>
                  <Select
                    value={filters.timeRange}
                    label="Time Range"
                    onChange={(e) => handleFilterChange('timeRange', e.target.value)}
                  >
                    <MenuItem value="1">Last Hour</MenuItem>
                    <MenuItem value="24">Last 24 Hours</MenuItem>
                    <MenuItem value="168">Last Week</MenuItem>
                    <MenuItem value="720">Last Month</MenuItem>
                    <MenuItem value="2160">Last 3 Month</MenuItem>
                  </Select>
                </FormControl>

                {/* Group By Filter (Conditional) */}
                {activeTab === 1 && (
                  <FormControl size="small" sx={{ minWidth: 160, flex: { xs: '1 1 160px', sm: '0 1 auto' } }}>
                    <InputLabel>Group By</InputLabel>
                    <Select
                      value={groupBy}
                      label="Group By"
                      onChange={(e) => handleGroupByChange(e.target.value)}
                      startAdornment={
                        <InputAdornment position="start">
                          <GroupIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 1 }} />
                        </InputAdornment>
                      }
                    >
                      {GROUPING_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <option.icon sx={{ fontSize: 18 }} />
                            {option.label}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {/* Search Field */}
                <TextField
                  size="small"
                  placeholder="Search activities..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    minWidth: 200,
                    flex: { xs: '1 1 100%', sm: '1 1 200px' },
                    order: { xs: -1, sm: 0 } // Moves search to top on mobile
                  }}
                />

                {/* Refresh Button - Visible on mobile */}
                <Button
                  variant="outlined"
                  onClick={handleRetry}
                  disabled={loading}
                  startIcon={<Refresh />}
                  sx={{
                    display: { xs: 'flex', md: 'none' },
                    flex: { xs: '1 1 auto', sm: '0 1 auto' }
                  }}
                >
                  Refresh
                </Button>
              </Box>
            </GlassCard>
          </motion.div>
        </Box>

        {/* Tabs */}
        <Paper sx={{ mb: 3, borderRadius: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab icon={<Dashboard />} label="Dashboard" />
            <Tab icon={<Timeline />} label="Recent Activities" />
            <Tab icon={<BarChart />} label="Analytics" />
          </Tabs>
        </Paper>

        {/* Loading indicator */}
        {loading && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              py: 4,
            }}
          >
            <CircularProgress size={50} />
          </Box>
        )}

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 0 && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Grid container spacing={3}>
                {/* Statistics Cards */}
                <Grid item xs={12} sm={6} md={3}>
                  <AnimatedStatCard
                    icon={TrendingUp}
                    title="Total Activities"
                    value={processedData.dashboardStats.totalActivities}
                    subtitle="All activities"
                    color="primary"
                    delay={100}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <AnimatedStatCard
                    icon={People}
                    title="Unique Users"
                    value={processedData.dashboardStats.uniqueUsers}
                    subtitle="Active users"
                    color="success"
                    delay={200}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <AnimatedStatCard
                    icon={CloudDownload}
                    title="Downloads"
                    value={processedData.dashboardStats.totalDownloads}
                    subtitle="Files downloaded"
                    color="info"
                    delay={300}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <AnimatedStatCard
                    icon={VideoLibrary}
                    title="Streams"
                    value={processedData.dashboardStats.totalStreams}
                    subtitle="Media streams"
                    color="warning"
                    delay={400}
                  />
                </Grid>

                {/* User Analytics Table - Moved to Dashboard */}
                <Grid item xs={12} lg={6}>
                  <GlassCard>
                    <CardHeader
                      title="User Activity Summary"
                      subheader={`${processedData.users.length} active users`}
                      avatar={<People />}
                    />
                    <CardContent>
                      {processedData.users.length > 0 ? (
                        <TableContainer sx={{ maxHeight: 400 }}>
                          <Table size="small" stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell>User</TableCell>
                                <TableCell align="center">Total</TableCell>
                                <TableCell align="center">Downloads</TableCell>
                                <TableCell align="center">Streams</TableCell>
                                <TableCell align="center">Searches</TableCell>
                                <TableCell align="center">Last Activity</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {processedData.users.slice(0, 8).map((user, index) => (
                                <TableRow key={index} hover>
                                  <TableCell>
                                    <Box display="flex" alignItems="center" gap={1}>
                                      <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem' }}>
                                        {user.userEmail?.charAt(0)?.toUpperCase() || 'U'}
                                      </Avatar>
                                      <Box>
                                        <Typography variant="body2" fontWeight="500">
                                          {user.userEmail || 'Unknown user'}
                                        </Typography>
                                      </Box>
                                    </Box>
                                  </TableCell>
                                  <TableCell align="center">
                                    <Chip label={user.totalActivities || 0} size="small" color="primary" />
                                  </TableCell>
                                  <TableCell align="center">{user.downloadCount || 0}</TableCell>
                                  <TableCell align="center">{user.streamCount || 0}</TableCell>
                                  <TableCell align="center">{user.searchCount || 0}</TableCell>
                                  <TableCell align="center">
                                    <Typography variant="caption">
                                      {formatTimeAgo(user.lastActivity)}
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                          No user data available
                        </Typography>
                      )}
                    </CardContent>
                  </GlassCard>
                </Grid>

                {/* Recent Activities and Charts */}
                <Grid item xs={12} lg={6}>
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <GlassCard>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Recent Activities ({processedData.activities.length})
                          </Typography>
                          <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                            {processedData.activities.length > 0 ? (
                              processedData.activities.slice(0, 5).map((activity, index) => (
                                <ActivityItem key={index} activity={activity} showUser={true} />
                              ))
                            ) : (
                              <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                                No activities found
                              </Typography>
                            )}
                          </Box>
                        </CardContent>
                      </GlassCard>
                    </Grid>
                    <Grid item xs={12}>
                      <SimpleBarChart
                        title="Activity Distribution"
                        data={[
                          { label: 'Downloads', value: processedData.dashboardStats.totalDownloads },
                          { label: 'Streams', value: processedData.dashboardStats.totalStreams },
                          { label: 'Searches', value: processedData.dashboardStats.totalSearches },
                        ]}
                        color="#009688"
                      />
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </motion.div>
          )}

          {activeTab === 1 && (
            <motion.div
              key="activities"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <GlassCard>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                    <Typography variant="h6">
                      All Activities ({processedData.activities.length})
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <GroupIcon color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {GROUPING_OPTIONS.find(opt => opt.value === groupBy)?.label}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    <GroupedActivities
                      activities={processedData.activities}
                      groupBy={groupBy}
                    />
                  </Box>
                </CardContent>
              </GlassCard>
            </motion.div>
          )}

          {activeTab === 2 && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <SimpleBarChart
                    title="Activity Types"
                    data={[
                      { label: 'Downloads', value: processedData.dashboardStats.totalDownloads },
                      { label: 'Streams', value: processedData.dashboardStats.totalStreams },
                      { label: 'Searches', value: processedData.dashboardStats.totalSearches },
                    ]}
                    color="#4caf50"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <SimpleBarChart
                    title="Top Users by Activity"
                    data={processedData.users.slice(0, 8).map(user => ({
                      label: user.userEmail?.split('@')[0] || 'User',
                      value: user.totalActivities || 0
                    }))}
                    color="#2196f3"
                  />
                </Grid>
              </Grid>
            </motion.div>
          )}
        </AnimatePresence>
      </Container>
    </Box>
  );
};

export default UserCinemaActivity;