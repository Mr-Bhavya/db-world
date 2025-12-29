import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
  alpha,
  Container,
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
  CardHeader,
  CardActions,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper
} from '@mui/material';
import {
  Refresh,
  TrendingUp,
  People,
  CloudDownload,
  VideoLibrary,
  Search as SearchIcon,
  Dashboard,
  Timeline,
  BarChart,
  ExpandMore,
  Group as GroupIcon,
  ViewList,
  Schedule,
  FolderOpen,
  Email,
  Download,
  PlayArrow,
  FilterList,
  Close,
  Error as ErrorIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { getActivityStatsAllApi, getAllRecentActivitiesApi, getDashboardStatsApi, getInitialDataApi, getUserListApi } from '../../ApiServices';
import { toast } from '../../Toast';

// --- Constants & Configuration ---
const ACTIVITY_CONFIG = {
  DOWNLOAD: {
    icon: CloudDownload,
    color: 'info',
    label: 'Download',
    gradient: 'linear-gradient(135deg, #2196f3 0%, #21cbf3 100%)'
  },
  STREAM: {
    icon: VideoLibrary,
    color: 'success',
    label: 'Stream',
    gradient: 'linear-gradient(135deg, #00c853 0%, #64dd17 100%)'
  },
  SEARCH: {
    icon: SearchIcon,
    color: 'warning',
    label: 'Search',
    gradient: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)'
  }
};

const GROUPING_OPTIONS = [
  { value: 'none', label: 'No Grouping', icon: ViewList },
  { value: 'user', label: 'By User', icon: People },
  { value: 'activity', label: 'By Activity', icon: BarChart },
  { value: 'file', label: 'By File', icon: FolderOpen },
  { value: 'keyword', label: 'By Keyword', icon: SearchIcon }
];

const TIME_RANGES = [
  { value: '1', label: 'Last Hour' },
  { value: '24', label: 'Last 24 Hours' },
  { value: '168', label: 'Last Week' },
  { value: '720', label: 'Last Month' },
  { value: '2160', label: 'Last 3 Months' }
];

// --- Utility Functions ---
const formatTimeAgo = (timestamp) => {
  if (!timestamp || timestamp === 'undefined' || timestamp === 'null') return "Just now";
  try {
    const now = Date.now();
    const diff = now - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return "Just now";
  }
};

const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${Math.round(bytes * 100) / 100} ${units[i]}`;
};

const safeGet = (obj, path, defaultValue = null) => {
  try {
    return path.split('.').reduce((acc, key) => acc?.[key], obj) || defaultValue;
  } catch {
    return defaultValue;
  }
};

// --- Glassmorphism Card Component ---
const GlassCard = ({ children, sx = {}, elevation = 1, ...props }) => {
  const theme = useTheme();
  return (
    <Card
      sx={{
        background: alpha(theme.palette.background.paper, 0.85),
        backdropFilter: 'blur(10px)',
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        borderRadius: 2,
        boxShadow: `0 ${elevation * 4}px ${elevation * 8}px ${alpha(theme.palette.common.black, 0.08)}`,
        overflow: 'visible',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, #2196f3, #00c853, #ff9800)',
          opacity: 0.6,
          borderRadius: '2px 2px 0 0',
        },
        ...sx
      }}
      {...props}
    >
      {children}
    </Card>
  );
};

// --- Stat Card Component ---
const StatCard = ({ icon: Icon, title, value, subtitle, color = 'primary', loading = false }) => {
  const theme = useTheme();

  return (
    <GlassCard
      sx={{
        height: '100%',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 24px ${alpha(theme.palette[color].main, 0.15)}`,
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar
            sx={{
              bgcolor: alpha(theme.palette[color].main, 0.1),
              color: theme.palette[color].main,
              mr: 2,
              width: 48,
              height: 48,
            }}
          >
            <Icon />
          </Avatar>
          <Box>
            <Typography variant="h4" fontWeight="bold" color="text.primary">
              {loading ? '...' : value || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              {title}
            </Typography>
          </Box>
        </Box>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </GlassCard>
  );
};

// --- Activity Item Component ---
const ActivityItem = ({ activity, showUser = true, compact = false }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (!activity) return null;

  const config = ACTIVITY_CONFIG[activity.activityType] || ACTIVITY_CONFIG.SEARCH;
  const Icon = config.icon;
  const fileName = activity.filePath?.split(/[\\/]/).pop() || 'Unknown File';
  const userEmail = activity.userEmail || 'Unknown User';

  // Determine if we should show full text or truncated
  const shouldShowFullText = isMobile || !compact;

  return (
    <Paper
      sx={{
        p: isMobile ? 1.5 : compact ? 1.5 : 2,
        mb: 1.5,
        borderRadius: 2,
        background: alpha(theme.palette.background.paper, 0.7),
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: alpha(theme.palette.primary.main, 0.3),
          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.08)}`,
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? 1.5 : 2 }}>
        {/* Icon Avatar */}
        <Avatar
          sx={{
            bgcolor: alpha(theme.palette[config.color].main, 0.1),
            color: theme.palette[config.color].main,
            width: isMobile ? 36 : compact ? 36 : 44,
            height: isMobile ? 36 : compact ? 36 : 44,
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: isMobile ? 16 : compact ? 18 : 20 }} />
        </Avatar>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* User Email (if showing) */}
          {showUser && (
            <Box sx={{ mb: 0.5 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 500,
                  color: theme.palette.primary.main,
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                  display: 'inline-block',
                  wordBreak: 'break-word', // Allow breaking long emails
                  whiteSpace: 'normal', // Allow wrapping
                  maxWidth: '100%',
                }}
              >
                {userEmail}
              </Typography>
            </Box>
          )}

          {/* File Name */}
          <Typography
            variant={isMobile ? "body2" : compact ? "body2" : "subtitle2"}
            fontWeight="500"
            sx={{
              mb: 1,
              wordBreak: 'break-word', // Break long file names
              whiteSpace: 'normal', // Allow wrapping
              display: '-webkit-box',
              WebkitLineClamp: 2, // Show max 2 lines
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {fileName}
          </Typography>

          {/* Activity Details Row */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
            mt: 0.5
          }}>
            {/* Activity Type */}
            <Chip
              label={config.label}
              size="small"
              sx={{
                bgcolor: alpha(theme.palette[config.color].main, 0.1),
                color: theme.palette[config.color].main,
                fontWeight: 500,
                height: isMobile ? 20 : 24,
                fontSize: isMobile ? '0.65rem' : '0.7rem',
              }}
            />

            {/* File Size */}
            {activity.fileSize && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: isMobile ? '0.65rem' : '0.7rem' }}
              >
                {formatFileSize(activity.fileSize)}
              </Typography>
            )}

            {/* Timestamp */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              ml: 'auto',
              flexShrink: 0
            }}>
              <Schedule sx={{
                fontSize: isMobile ? 12 : 14,
                color: 'text.secondary'
              }} />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: isMobile ? '0.65rem' : '0.7rem' }}
              >
                {formatTimeAgo(activity.lastUpdated)}
              </Typography>
            </Box>
          </Box>

          {/* Search Value (if search activity) */}
          {activity.activityValue && activity.activityType === 'SEARCH' && (
            <Box sx={{
              mt: 1,
              p: 1,
              bgcolor: alpha(theme.palette.warning.main, 0.05),
              borderRadius: 1,
              border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`,
            }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  fontStyle: 'italic',
                  wordBreak: 'break-word', // Break search terms
                  whiteSpace: 'normal', // Allow wrapping
                }}
              >
                <SearchIcon sx={{ fontSize: 12 }} />
                Search: "{activity.activityValue}"
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Paper>
  );
};

// --- Grouped Activities Component ---
const GroupedActivities = ({ activities, groupBy, loading }) => {
  const theme = useTheme();

  const grouped = useMemo(() => {
    if (!activities.length || groupBy === 'none') {
      return { 'All Activities': activities };
    }

    const groups = {};

    activities.forEach(activity => {
      let key = 'Unknown';

      switch (groupBy) {
        case 'user':
          key = activity.userEmail || 'Unknown User';
          break;
        case 'activity':
          key = activity.activityType || 'Unknown Activity';
          break;
        case 'file':
          key = activity.filePath?.split(/[\\/]/).pop() || 'Unknown File';
          break;
        case 'keyword':
          key = activity.activityType === 'SEARCH'
            ? (activity.activityValue || 'Unknown Search')
            : 'Other Activities';
          break;
        default:
          key = 'All Activities';
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(activity);
    });

    return groups;
  }, [activities, groupBy]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!Object.keys(grouped).length) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <ErrorIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          No activities found
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {Object.entries(grouped).map(([groupName, groupActivities], index) => (
        <Accordion
          key={groupName}
          defaultExpanded={index === 0}
          sx={{
            mb: 2,
            borderRadius: 2,
            '&:before': { display: 'none' },
            bgcolor: 'background.paper',
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore />}
            sx={{
              borderRadius: 2,
              '&.Mui-expanded': {
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
              }
            }}
          >
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              gap: 2,
              flexWrap: 'wrap' // Allow wrapping
            }}>
              <Typography
                variant="subtitle1"
                fontWeight="600"
                sx={{
                  flex: 1,
                  wordBreak: 'break-word', // Break long group names
                  whiteSpace: 'normal', // Allow wrapping
                }}
              >
                {groupName}
              </Typography>
              <Chip
                label={`${groupActivities.length} activities`}
                size="small"
                color="primary"
                sx={{ flexShrink: 0 }} // Prevent chip from shrinking
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box>
              {groupActivities.map((activity, idx) => (
                <ActivityItem
                  key={idx}
                  activity={activity}
                  showUser={groupBy !== 'user'}
                  compact={groupActivities.length > 10}
                />
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

// --- Bar Chart Component ---
const SimpleBarChart = ({ data, title, color = '#2196f3', loading = false }) => {
  const theme = useTheme();

  const chartData = Array.isArray(data) ? data : [];
  const maxValue = Math.max(...chartData.map(d => d.value || 0), 1);

  if (loading) {
    return (
      <GlassCard sx={{ height: '100%' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>{title}</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </GlassCard>
    );
  }

  if (!chartData.length) {
    return (
      <GlassCard sx={{ height: '100%' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>{title}</Typography>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body2" color="text.secondary">
              No data available
            </Typography>
          </Box>
        </CardContent>
      </GlassCard>
    );
  }

  return (
    <GlassCard sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Box sx={{ mt: 3 }}>
          {chartData.map((item, index) => (
            <Box key={index} sx={{ mb: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {item.label || 'Unnamed'}
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {item.value}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={((item.value || 0) / maxValue) * 100}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: alpha(color, 0.1),
                  '& .MuiLinearProgress-bar': {
                    bgcolor: color,
                    borderRadius: 4,
                  }
                }}
              />
            </Box>
          ))}
        </Box>
      </CardContent>
    </GlassCard>
  );
};

// --- User Table Component ---
const UserTable = ({ users, loading }) => {
  const theme = useTheme();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!users.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <People sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          No user data available
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, bgcolor: 'background.default' }}>User</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600, bgcolor: 'background.default' }}>Total</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600, bgcolor: 'background.default' }}>Downloads</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600, bgcolor: 'background.default' }}>Streams</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600, bgcolor: 'background.default' }}>Searches</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600, bgcolor: 'background.default' }}>Last Activity</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.slice(0, 10).map((user, index) => (
            <TableRow
              key={index}
              hover
              sx={{ '&:last-child td': { border: 0 } }}
            >
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                  <Avatar sx={{
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                    flexShrink: 0
                  }}>
                    {user.userEmail?.charAt(0)?.toUpperCase() || 'U'}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      fontWeight="500"
                      sx={{
                        wordBreak: 'break-word', // Break long emails
                        whiteSpace: 'normal', // Allow wrapping
                      }}
                    >
                      {user.userEmail || 'Unknown User'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {user.userRole || 'User'}
                    </Typography>
                  </Box>
                </Box>
              </TableCell>
              <TableCell align="center">
                <Chip
                  label={user.totalActivities || 0}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </TableCell>
              <TableCell align="center">
                <Typography variant="body2" color="info.main" fontWeight="500">
                  {user.downloadCount || 0}
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Typography variant="body2" color="success.main" fontWeight="500">
                  {user.streamCount || 0}
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Typography variant="body2" color="warning.main" fontWeight="500">
                  {user.searchCount || 0}
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Typography variant="caption" color="text.secondary">
                  {formatTimeAgo(user.lastActivity)}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// --- Filter Bar Component ---
const FilterBar = ({ filters, onFilterChange, groupBy, onGroupChange, loading, activeTab }) => {
  const isMobile = useMediaQuery(theme => theme.breakpoints.down('sm'));

  return (
    <GlassCard elevation={0} sx={{ mb: 3, p: 2 }}>
      <Grid container spacing={2} alignItems="center">
        {/* Time Range */}
        <Grid item xs={12} sm={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Time Range</InputLabel>
            <Select
              value={filters.timeRange}
              label="Time Range"
              onChange={(e) => onFilterChange('timeRange', e.target.value)}
              disabled={loading}
            >
              {TIME_RANGES.map(range => (
                <MenuItem key={range.value} value={range.value}>
                  {range.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Activity Type */}
        <Grid item xs={12} sm={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Activity Type</InputLabel>
            <Select
              value={filters.activityType}
              label="Activity Type"
              onChange={(e) => onFilterChange('activityType', e.target.value)}
              disabled={loading}
            >
              <MenuItem value="">All Types</MenuItem>
              <MenuItem value="DOWNLOAD">Downloads</MenuItem>
              <MenuItem value="STREAM">Streams</MenuItem>
              <MenuItem value="SEARCH">Searches</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* Group By (Only for Activities tab) */}
        {activeTab === 1 && (
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Group By</InputLabel>
              <Select
                value={groupBy}
                label="Group By"
                onChange={(e) => onGroupChange(e.target.value)}
                disabled={loading}
              >
                {GROUPING_OPTIONS.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <option.icon sx={{ fontSize: 18 }} />
                      {option.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}

        {/* Search */}
        <Grid item xs={12} sm={activeTab === 1 ? 3 : 6}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search activities..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            disabled={loading}
          />
        </Grid>
      </Grid>
    </GlassCard>
  );
};

// --- Main Dashboard Component ---
const UserCinemaActivity = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [activeTab, setActiveTab] = useState(0);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [groupBy, setGroupBy] = useState('none');

  const [filters, setFilters] = useState({
    timeRange: '24',
    activityType: '',
    search: ''
  });

  const isAdmin = (role) => role === 'ADMIN' || role === 'OWNER';

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const initialData = await getInitialDataApi();
      if (initialData?.userRole) {
        setUserRole(initialData.userRole);
        if (initialData.adminData) {
          setData(prev => ({ ...prev, ...initialData.adminData }));
        }
        setSuccess('Data loaded successfully');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load initial data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTabData = useCallback(async () => {
    if (!userRole || !isAdmin(userRole)) return;

    try {
      setLoading(true);
      setError(null);

      const timeRange = parseInt(filters.timeRange) || 24;

      switch (activeTab) {
        case 0: // Dashboard
          const [dashboardStats, activities, users] = await Promise.all([
            getDashboardStatsApi(timeRange > 24 ? 7 : 1),
            getAllRecentActivitiesApi({
              hours: timeRange,
              activityType: filters.activityType || undefined,
              limit: 50
            }),
            getUserListApi(timeRange)
          ]);

          setData(prev => ({
            ...prev,
            dashboardStats: safeGet(dashboardStats, 'stats', {}),
            activities: safeGet(activities, 'activities', []),
            users: safeGet(users, 'users', []),
            activitiesCount: safeGet(activities, 'count', 0),
            usersCount: safeGet(users, 'count', 0)
          }));
          break;

        case 1: // Recent Activities
          const recentActivities = await getAllRecentActivitiesApi({
            hours: timeRange,
            activityType: filters.activityType || undefined,
            limit: 100
          });
          setData(prev => ({
            ...prev,
            activities: safeGet(recentActivities, 'activities', []),
            activitiesCount: safeGet(recentActivities, 'count', 0)
          }));
          break;

        case 2: // Analytics
          const activityStats = await getActivityStatsAllApi(timeRange > 24 ? 7 : 1);
          const usersForAnalytics = await getUserListApi(timeRange);
          setData(prev => ({
            ...prev,
            activityStats: safeGet(activityStats, 'stats', {}),
            users: safeGet(usersForAnalytics, 'users', []),
            usersCount: safeGet(usersForAnalytics, 'count', 0)
          }));
          break;
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters, userRole]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (userRole && isAdmin(userRole)) {
      loadTabData();
    }
  }, [loadTabData, userRole]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleRetry = () => {
    setError(null);
    loadTabData();
  };

  const processedData = useMemo(() => {
    const stats = safeGet(data, 'activityStats', {});
    const dashboardStats = safeGet(data, 'dashboardStats', {});

    return {
      stats: {
        totalActivities: safeGet(dashboardStats, 'totalActivities', 0),
        uniqueUsers: safeGet(dashboardStats, 'uniqueUsers', 0),
        downloads: safeGet(stats, 'DOWNLOAD', safeGet(dashboardStats, 'totalDownloads', 0)),
        streams: safeGet(stats, 'STREAM', safeGet(dashboardStats, 'totalStreams', 0)),
        searches: safeGet(stats, 'SEARCH', safeGet(dashboardStats, 'totalSearches', 0))
      },
      activities: Array.isArray(data.activities) ? data.activities : [],
      users: Array.isArray(data.users) ? data.users : [],
      activitiesCount: data.activitiesCount || 0,
      usersCount: data.usersCount || 0
    };
  }, [data]);

  // Non-admin view
  if (userRole && !isAdmin(userRole)) {
    return (
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <ErrorIcon sx={{ fontSize: 64, color: 'warning.main', mb: 3 }} />
          <Typography variant="h4" gutterBottom color="text.primary">
            Access Restricted
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}>
            You need administrator privileges to access the activity dashboard.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Your role: <Chip label={userRole} color="default" size="small" sx={{ ml: 1 }} />
          </Typography>
          <Button
            variant="contained"
            onClick={loadInitialData}
            startIcon={<Refresh />}
            size="large"
          >
            Refresh Status
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: 'background.default',
      py: { xs: 2, md: 4 }
    }}>
      <Container maxWidth="xl">
        {/* Notifications */}
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Snackbar>

        <Snackbar
          open={!!success}
          autoHideDuration={3000}
          onClose={() => setSuccess(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        </Snackbar>

        {/* Main Header */}
        <Box sx={{ mb: 4 }}>

          {/* Tabs */}
          <Paper sx={{ borderRadius: 2, mb: 3, overflow: 'hidden' }}>
            <Tabs
              value={activeTab}
              onChange={(e, newValue) => setActiveTab(newValue)}
              variant={isMobile ? "scrollable" : "standard"}
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': {
                  minHeight: 64,
                  fontSize: '0.9rem',
                  fontWeight: 500
                }
              }}
            >
              <Tab icon={<Dashboard />} label="Dashboard" />
              <Tab icon={<Timeline />} label="Recent Activities" />
              <Tab icon={<BarChart />} label="Analytics" />
            </Tabs>
          </Paper>

          {/* Filters */}
          <FilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            groupBy={groupBy}
            onGroupChange={setGroupBy}
            loading={loading}
            activeTab={activeTab}
          />
        </Box>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === 0 && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Grid container spacing={3}>
                {/* Stats Cards */}
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    icon={TrendingUp}
                    title="Total Activities"
                    value={processedData.stats.totalActivities}
                    subtitle="All user activities"
                    color="primary"
                    loading={loading}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    icon={People}
                    title="Unique Users"
                    value={processedData.stats.uniqueUsers}
                    subtitle="Active users"
                    color="success"
                    loading={loading}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    icon={CloudDownload}
                    title="Downloads"
                    value={processedData.stats.downloads}
                    subtitle="Files downloaded"
                    color="info"
                    loading={loading}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    icon={VideoLibrary}
                    title="Streams"
                    value={processedData.stats.streams}
                    subtitle="Media streams"
                    color="warning"
                    loading={loading}
                  />
                </Grid>

                {/* Recent Activities */}
                <Grid item xs={12} lg={6}>
                  <GlassCard sx={{ height: '100%' }}>
                    <CardHeader
                      title="Recent Activities"
                      subheader={`${processedData.activitiesCount} total activities`}
                      action={
                        <Button size="small" onClick={() => setActiveTab(1)}>
                          View All
                        </Button>
                      }
                    />
                    <CardContent sx={{ maxHeight: 400, overflow: 'auto', px: 2 }}>
                      {processedData.activities.length > 0 ? (
                        processedData.activities.slice(0, 8).map((activity, index) => (
                          <ActivityItem
                            key={index}
                            activity={activity}
                            showUser={true}
                            compact={true}
                          />
                        ))
                      ) : (
                        <Box sx={{ textAlign: 'center', py: 6 }}>
                          <Typography variant="body2" color="text.secondary">
                            No recent activities
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </GlassCard>
                </Grid>

                {/* User Analytics */}
                <Grid item xs={12} lg={6}>
                  <GlassCard sx={{ height: '100%' }}>
                    <CardHeader
                      title="Top Users"
                      subheader={`${processedData.usersCount} active users`}
                      avatar={<People />}
                    />
                    <CardContent sx={{ px: 0 }}>
                      <UserTable
                        users={processedData.users.slice(0, 8)}
                        loading={loading}
                      />
                    </CardContent>
                  </GlassCard>
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
              transition={{ duration: 0.3 }}
            >
              <GlassCard>
                <CardHeader
                  title="All Activities"
                  subheader={`${processedData.activitiesCount} activities found`}
                  action={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <GroupIcon color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {GROUPING_OPTIONS.find(opt => opt.value === groupBy)?.label}
                      </Typography>
                    </Box>
                  }
                />
                <CardContent sx={{ pt: 0 }}>
                  <Box sx={{ maxHeight: 'calc(100vh - 300px)', overflow: 'auto' }}>
                    <GroupedActivities
                      activities={processedData.activities}
                      groupBy={groupBy}
                      loading={loading}
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
              transition={{ duration: 0.3 }}
            >
              <Grid container spacing={3}>
                <Grid item xs={12} lg={6}>
                  <SimpleBarChart
                    title="Activity Distribution"
                    data={[
                      { label: 'Downloads', value: processedData.stats.downloads },
                      { label: 'Streams', value: processedData.stats.streams },
                      { label: 'Searches', value: processedData.stats.searches },
                    ]}
                    color="#2196f3"
                    loading={loading}
                  />
                </Grid>
                <Grid item xs={12} lg={6}>
                  <SimpleBarChart
                    title="Top Users by Activity Count"
                    data={processedData.users.slice(0, 8).map(user => ({
                      label: user.userEmail?.split('@')[0] || 'User',
                      value: user.totalActivities || 0
                    }))}
                    color="#00c853"
                    loading={loading}
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

export default React.memo(UserCinemaActivity);