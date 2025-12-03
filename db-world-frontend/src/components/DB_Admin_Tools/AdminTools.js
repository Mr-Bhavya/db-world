import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Card, 
  CircularProgress, 
  Tab, 
  Tabs, 
  useTheme,
  createTheme,
  ThemeProvider,
  alpha,
  Chip,
  Typography,
  Container
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import Constants from '../Constants';
import RecordsManagement from './RecordsManagment';
import FileExplorer from './FileExplorer/FileExplorer'
import LogDashboard from './LogDashboard/LogDashboard';
import SystemInfo from './SystemInfo';
import RedisManager from './RedisManager';
import UserManagement from './UserManagment';
import UserCinemaActivity from './DownloadTraker';
import ActivityLogs from './ActivityLogs/ActivityLogs';

// Icons for tabs
import {
  People as UsersIcon,
  Assignment as ActivityIcon,
  Folder as RecordsIcon,
  Download as DownloadIcon,
  TrackChanges as TrackerIcon,
  Analytics as LogsIcon,
  FolderOpen as ExplorerIcon,
  Computer as SystemIcon,
  Storage as RedisIcon,
  Dashboard as DashboardIcon
} from '@mui/icons-material';
import DownloadManager from './DownloadManager';

const adminTheme = createTheme({
  palette: {
    primary: {
      main: '#008080',
      light: '#4db6ac',
      dark: '#00695c',
    },
    secondary: {
      main: '#006666',
      light: '#339999',
      dark: '#004d4d',
    },
    background: {
      default: '#f8f9fa',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
});

const AdminTools = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('download-manager');
  const [hoveredTab, setHoveredTab] = useState(null);

  const tabConfigs = [
    {
      id: 'users',
      label: 'User Management',
      icon: <UsersIcon />,
      component: <UserManagement />,
      color: '#008080',
      badge: 'Updated',
      description: 'Manage user accounts and permissions'
    },
    {
      id: 'activity-logs',
      label: 'Activity Logs',
      icon: <ActivityIcon />,
      component: <ActivityLogs />,
      color: '#00bfa5',
      badge: 'Live',
      description: 'Real-time user activity monitoring'
    },
    {
      id: 'records',
      label: 'Records',
      icon: <RecordsIcon />,
      component: <RecordsManagement />,
      color: '#5f9ea0',
      description: 'Database records management'
    },
    {
      id: 'download-manager',
      label: 'Download Manager',
      icon: <DownloadIcon />,
      component: <DownloadManager />,
      color: '#20b2aa',
      badge: 'New',
      description: 'Manage and monitor downloads'
    },
    {
      id: 'user-cinema-activity',
      label: 'User Cinema Activity',
      icon: <TrackerIcon />,
      component: <UserCinemaActivity />,
      color: '#008b8b',
      description: 'Track download progress and history'
    },
    {
      id: 'logs',
      label: 'System Logs',
      icon: <LogsIcon />,
      component: <LogDashboard />,
      color: '#006666',
      badge: 'Live',
      description: 'Real-time system log monitoring'
    },
    {
      id: 'file_explorer',
      label: 'File Explorer',
      icon: <ExplorerIcon />,
      component: <FileExplorer />,
      color: '#4db6ac',
      description: 'Browse and manage file system'
    },
    {
      id: 'system',
      label: 'System Info',
      icon: <SystemIcon />,
      component: <SystemInfo />,
      color: '#26a69a',
      description: 'System performance and metrics'
    },
    {
      id: 'redis-cache',
      label: 'Redis Cache',
      icon: <RedisIcon />,
      component: <RedisManager />,
      color: '#80cbc4',
      badge: 'Advanced',
      description: 'Redis cache management and monitoring'
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        when: "beforeChildren"
      }
    }
  };

  const itemVariants = {
    hidden: { 
      y: 30, 
      opacity: 0,
      scale: 0.9
    },
    visible: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 120,
        damping: 15
      }
    },
    hover: {
      y: -2,
      scale: 1.02,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 25
      }
    }
  };

  const contentVariants = {
    hidden: { 
      opacity: 0,
      x: 20
    },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 20,
        duration: 0.4
      }
    },
    exit: {
      opacity: 0,
      x: -20,
      transition: {
        duration: 0.3
      }
    }
  };

  useEffect(() => {
    const hash = location.hash.substring(1);
    if (hash) {
      const params = new URLSearchParams(hash);
      const tab = params.get('active');
      if (tab && tabConfigs.some(config => config.id === tab)) {
        setActiveTab(tab);
      }
    }
    
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, [location]);

  const handleTabChange = (event, newValue) => {
    setLoading(true);
    setActiveTab(newValue);
    navigate(`${Constants.DB_ADMIN_TOOLS_ROUTE}#active=${newValue}`);
    setTimeout(() => setLoading(false), 350);
  };

  const currentTabConfig = tabConfigs.find(tab => tab.id === activeTab);

  const renderTabContent = () => {
    const tab = tabConfigs.find(t => t.id === activeTab);
    return tab ? tab.component : <DownloadManager />;
  };

  return (
    <ThemeProvider theme={adminTheme}>
      <Box
        sx={{
          minHeight: '100vh',
          background: `linear-gradient(135deg, ${alpha('#667eea', 0.05)} 0%, ${alpha('#764ba2', 0.05)} 100%)`,
          backgroundAttachment: 'fixed',
          py: 3,
          px: 0,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Animated Background Elements */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `radial-gradient(circle at 20% 20%, ${alpha(adminTheme.palette.primary.main, 0.03)} 0%, transparent 50%),
                        radial-gradient(circle at 80% 80%, ${alpha(adminTheme.palette.secondary.main, 0.03)} 0%, transparent 50%)`,
            zIndex: 0
          }}
        />

        <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1, px:0 }}>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            {/* Main Content Card */}
            <motion.div variants={itemVariants}>
              <Card 
                sx={{ 
                  width: '100%',
                  px: 0,
                  background: alpha(adminTheme.palette.background.paper, 0.95),
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${alpha(adminTheme.palette.primary.main, 0.1)}`,
                  borderRadius: 4,
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
                  overflow: 'hidden',
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: `linear-gradient(90deg, ${adminTheme.palette.primary.main}, ${adminTheme.palette.secondary.main})`,
                    zIndex: 1
                  }
                }}
              >
                {/* Enhanced Tabs */}
                <motion.div variants={itemVariants}>
                  <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                      borderBottom: `1px solid ${alpha(adminTheme.palette.primary.main, 0.1)}`,
                      background: alpha(adminTheme.palette.primary.main, 0.02),
                      px: 2,
                      pt: 1,
                      '& .MuiTabs-scroller': {
                        overflow: 'auto !important'
                      },
                      '& .MuiTab-root': {
                        textTransform: 'none',
                        minWidth: 'unset',
                        px: 3,
                        py: 1.5,
                        mx: 0.5,
                        borderRadius: 2,
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        color: 'text.secondary',
                        transition: 'all 0.3s ease',
                        minHeight: 'auto',
                        position: 'relative',
                        overflow: 'visible',
                        '&:hover': {
                          color: adminTheme.palette.primary.main,
                          background: alpha(adminTheme.palette.primary.main, 0.05),
                          transform: 'translateY(-1px)'
                        },
                        '&.Mui-selected': {
                          color: 'white',
                          background: `linear-gradient(135deg, ${currentTabConfig?.color || adminTheme.palette.primary.main}, ${alpha(currentTabConfig?.color || adminTheme.palette.primary.main, 0.8)})`,
                          boxShadow: `0 4px 20px ${alpha(currentTabConfig?.color || adminTheme.palette.primary.main, 0.3)}`,
                          transform: 'translateY(-1px)'
                        }
                      },
                      '& .MuiTabs-indicator': {
                        display: 'none'
                      }
                    }}
                  >
                    {tabConfigs.map((tab) => (
                      <Tab
                        key={tab.id}
                        value={tab.id}
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, position: 'relative' }}>
                            <motion.div
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              {React.cloneElement(tab.icon, {
                                sx: { fontSize: '1.2rem' }
                              })}
                            </motion.div>
                            <Box>
                              <Typography variant="body2" fontWeight={500}>
                                {tab.label}
                              </Typography>
                              {tab.badge && (
                                <Chip
                                  label={tab.badge}
                                  size="small"
                                  sx={{
                                    height: 16,
                                    fontSize: '0.6rem',
                                    background: tab.color,
                                    color: 'white',
                                    position: 'absolute',
                                    top: -8,
                                    right: -8
                                  }}
                                />
                              )}
                            </Box>
                          </Box>
                        }
                        onMouseEnter={() => setHoveredTab(tab.id)}
                        onMouseLeave={() => setHoveredTab(null)}
                      />
                    ))}
                  </Tabs>
                </motion.div>

                {/* Tab Content Area */}
                <Box sx={{ p: 0, m: 0, minHeight: 600 }}>
                  {loading ? (
                    <Box 
                      display="flex" 
                      justifyContent="center" 
                      alignItems="center" 
                      minHeight={400}
                      sx={{ background: alpha(adminTheme.palette.primary.main, 0.02) }}
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <CircularProgress 
                          size={60}
                          thickness={4}
                          sx={{ 
                            color: currentTabConfig?.color || adminTheme.palette.primary.main 
                          }} 
                        />
                      </motion.div>
                    </Box>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeTab}
                        variants={contentVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        style={{ height: '100%' }}
                      >
                        <Box sx={{ p: 1 }}>
                          {/* <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                              <Box
                                sx={{
                                  width: 50,
                                  height: 50,
                                  borderRadius: '50%',
                                  background: `linear-gradient(135deg, ${alpha(currentTabConfig?.color, 0.2)} 0%, ${alpha(currentTabConfig?.color, 0.1)} 100%)`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: `2px solid ${alpha(currentTabConfig?.color, 0.2)}`
                                }}
                              >
                                {React.cloneElement(currentTabConfig?.icon, {
                                  sx: { 
                                    color: currentTabConfig?.color,
                                    fontSize: '1.8rem'
                                  }
                                })}
                              </Box>
                              <Box>
                                <Typography variant="h4" fontWeight="bold" color="text.primary">
                                  {currentTabConfig?.label}
                                </Typography>
                                <Typography variant="body1" color="text.secondary">
                                  {currentTabConfig?.description}
                                </Typography>
                              </Box>
                            </Box>
                          </motion.div> */}

                          {/* Tab Content */}
                          {renderTabContent()}
                        </Box>
                      </motion.div>
                    </AnimatePresence>
                  )}
                </Box>
              </Card>
            </motion.div>
          </motion.div>
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default AdminTools;