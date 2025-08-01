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
  ThemeProvider
} from '@mui/material';
import { motion } from 'framer-motion';
import Constants from '../Constants';
import DownloadStuf from './Mirror/Mirror';
import DownloadTracker from './DownloadTracker';
import RecordsManagement from './RecordsManagment';
import FileExplorer from './FileExplorer/FileExplorer'
import LogDashboard from './LogDashboard/LogDashboard';
import SystemInfo from './SystemInfo';
import Status from './Status';
import RedisManager from './RedisManager';
import UserManagement from './UserManagment';
import UserActivityLogs from './UserActivity/UserActivityLogs';

const theme = createTheme({
  palette: {
    primary: {
      main: '#008080',
    },
    secondary: {
      main: '#006666',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
});

const AdminTools = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('download');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        when: "beforeChildren"
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

  useEffect(() => {
    // Parse hash from URL to set active tab
    const hash = location.hash.substring(1);
    if (hash) {
      const params = new URLSearchParams(hash);
      const tab = params.get('active');
      if (tab) setActiveTab(tab);
    }
    
    // Set loading to false after initial render
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, [location]);

  const handleTabChange = (event, newValue) => {
    setLoading(true);
    setActiveTab(newValue);
    navigate(`${Constants.DB_ADMIN_TOOLS_ROUTE}#active=${newValue}`);
    setTimeout(() => setLoading(false), 300);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagement />;
      case 'users-logs':
        return <UserActivityLogs />;
      case 'records':
        return <RecordsManagement />;
      case 'download':
        return <DownloadStuf />;
      case 'status':
        return <Status />;
      case 'download-tracker':
        return <DownloadTracker />;
      case 'logs':
        return <LogDashboard />;
      case 'file_explorer':
        return <FileExplorer />;
      case 'system':
        return <SystemInfo />;
      case 'redis-cache':
        return <RedisManager />;
      default:
        return <DownloadStuf />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: '100vh', py: 3, px: 1 }}>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <Card sx={{ 
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            boxShadow: 3
          }}>
            <motion.div variants={itemVariants}>
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  borderBottom: 1,
                  borderColor: 'divider',
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    minWidth: 'unset',
                    px: 2,
                    mx: 0.5,
                    borderRadius: 1,
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'white'
                    }
                  }
                }}
              >
                <Tab label="User Details" value="users" />
                <Tab label="User Logs" value="users-logs" />
                <Tab label="Records" value="records" />
                <Tab label="Downloads" value="download" />
                <Tab label="Status" value="status" />
                <Tab label="Download Tracker" value="download-tracker" />
                <Tab label="Logs" value="logs" />
                <Tab label="File Explorer" value="file_explorer" />
                <Tab label="System Info" value="system" />
                <Tab label="Redis Cache" value="redis-cache" />
              </Tabs>
            </motion.div>

            <Box sx={{ p: 1 }}>
              {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
                  <CircularProgress color="primary" />
                </Box>
              ) : (
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {renderTabContent()}
                </motion.div>
              )}
            </Box>
          </Card>
        </motion.div>
      </Box>
    </ThemeProvider>
  );
};

export default AdminTools;