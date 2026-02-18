import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  createTheme,
  ThemeProvider,
  alpha,
  Container,
  useMediaQuery,
} from '@mui/material';
import { motion } from 'framer-motion';
import Constants from '../../Constants';

// Components
import RecordsManagement from '../RecordsManagment';
import FileExplorer from '../FileExplorer/FileExplorer';
import LogDashboard from '../LogDashboard/LogDashboard';
import SystemInfo from '../SystemInfo';
import RedisManager from '../RedisManager';
import UserManagement from '../UserManagment';
import UserCinemaActivity from '../UserCinemaActivity';
import ActivityLogs from '../ActivityLogs/ActivityLogs';
import DownloadManager from '../DownloadManager';

// Import new components  
import TableView from './TabView';
import GridView from './GridView';
import ViewSelector from './ViewSelector';

// Import FlmngrManager
import FlmngrManager from '../FileExplorer/FlmngrManager';

// Icons
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
  Storage as FileManagerIcon,
  Image as ImageIcon,
  // Media as MediaIcon,
  PictureAsPdf as PictureAsPdfIcon,
  InsertDriveFile as InsertDriveFileIcon,
  VideoLibrary,
} from '@mui/icons-material';
import MainLayout from '../ServerInfo/ServerInfo';
import ServerInfo from '../ServerInfo/ServerInfo';
import MediaFilesManagement from '../MediaFilesManagement/MediaFilesManagement';

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
    fontSize: 14,
  },
  shape: {
    borderRadius: 8,
  },
});

const AdminPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('download-manager');
  const [viewMode, setViewMode] = useState(null);
  const [fullScreenComponent, setFullScreenComponent] = useState(null);
  const [showViewSelector, setShowViewSelector] = useState(false);
  const isMobile = useMediaQuery(adminTheme.breakpoints.down('sm'));

  const tabConfigs = [
    {
      id: 'users',
      label: 'User Management',
      icon: <UsersIcon />,
      component: <UserManagement />,
      color: '#008080',
      badge: 'Updated',
      description: 'Manage user accounts and permissions',
      category: 'User Management',
      shortcut: 'U'
    },
    {
      id: 'activity-logs',
      label: 'Activity Logs',
      icon: <ActivityIcon />,
      component: <ActivityLogs />,
      color: '#00bfa5',
      badge: 'Live',
      description: 'Real-time user activity monitoring',
      category: 'Monitoring',
      shortcut: 'A'
    },
    {
      id: 'records',
      label: 'Records',
      icon: <RecordsIcon />,
      component: <RecordsManagement />,
      color: '#5f9ea0',
      description: 'Database records management',
      category: 'Data',
      shortcut: 'R'
    },
    {
      id: 'media-files',
      label: 'Media Files Management',
      icon: <VideoLibrary />,
      component: <MediaFilesManagement />,
      color: '#47b9aaff',
      badge: 'New',
      description: 'Manage images, videos, and other media files',
      category: 'Media',
      shortcut: 'V'
    },
    {
      id: 'download-manager',
      label: 'Download Manager',
      icon: <DownloadIcon />,
      component: <DownloadManager />,
      color: '#20b2aa',
      badge: 'New',
      description: 'Manage and monitor downloads',
      category: 'Operations',
      shortcut: 'D'
    },
    {
      id: 'user-cinema-activity',
      label: 'User Cinema Activity',
      icon: <TrackerIcon />,
      component: <UserCinemaActivity />,
      color: '#008b8b',
      description: 'Track download progress and history',
      category: 'Analytics',
      shortcut: 'C'
    },
    {
      id: 'logs',
      label: 'System Logs',
      icon: <LogsIcon />,
      component: <LogDashboard />,
      color: '#006666',
      badge: 'Live',
      description: 'Real-time system log monitoring',
      category: 'Monitoring',
      shortcut: 'L'
    },
    // {
    //   id: 'file_explorer',
    //   label: 'File Explorer',
    //   icon: <ExplorerIcon />,
    //   component: <FileExplorer />,
    //   color: '#4db6ac',
    //   description: 'Browse and manage file system',
    //   category: 'Operations',
    //   shortcut: 'F'
    // },
    {
      id: 'file-manager',
      label: 'File Manager',
      icon: <FileManagerIcon />,
      component: (
        <FlmngrManager
          onSelect={(files) => {
            //console.log('Selected files:', files);
            // Handle file selection
          }}
          fullscreen={fullScreenComponent === 'file-manager'}
          onFullscreenToggle={(fullscreen) => {
            if (fullscreen) {
              setFullScreenComponent('file-manager');
            } else {
              setFullScreenComponent(null);
            }
          }}
          sx={{
            // Additional customizations
            '& .MuiTypography-root': {
              fontFamily: '"Inter", sans-serif',
            },
          }}
          className="custom-file-manager"
        />
      ),
      color: '#4db6ac',
      badge: 'Professional',
      description: 'Advanced file management with Flmngr',
      category: 'Operations',
      shortcut: 'M'
    },
    {
      id: 'system',
      label: 'System Info',
      icon: <SystemIcon />,
      component: <ServerInfo />,
      color: '#26a69a',
      description: 'System performance and metrics',
      category: 'Monitoring',
      shortcut: 'S'
    },
    {
      id: 'redis-cache',
      label: 'Redis Cache',
      icon: <RedisIcon />,
      component: <RedisManager />,
      color: '#80cbc4',
      badge: 'Advanced',
      description: 'Redis cache management and monitoring',
      category: 'Advanced',
      shortcut: 'X'
    }
  ];

  const currentTabConfig = useMemo(() => {
    const tabId = fullScreenComponent || activeTab;
    return tabConfigs.find(tab => tab.id === tabId) || tabConfigs[0];
  }, [activeTab, fullScreenComponent]);

  useEffect(() => {
    const hash = location.hash.substring(1);
    if (hash) {
      const params = new URLSearchParams(hash);
      const tab = params.get('active');
      const view = params.get('view');

      if (tab && tabConfigs.some(config => config.id === tab)) {
        setActiveTab(tab);
      }

      if (view === 'full' && tab) {
        setFullScreenComponent(tab);
        setViewMode('grid');
      } else if (view === 'grid') {
        setViewMode('grid');
      } else if (view === 'tabs') {
        setViewMode('tabs');
      }
    } else {
      setShowViewSelector(true);
    }

    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, [location]);

  const handleTabChange = (event, newValue) => {
    setLoading(true);
    setActiveTab(newValue);
    navigate(`${Constants.DB_ADMIN_TOOLS_ROUTE}#active=${newValue}&view=tabs`);
    setTimeout(() => setLoading(false), 350);
  };

  const handleViewSelect = (selectedMode) => {
    setViewMode(selectedMode);
    setShowViewSelector(false);
    if (selectedMode === 'tabs') {
      navigate(`${Constants.DB_ADMIN_TOOLS_ROUTE}#active=${activeTab}&view=tabs`);
    } else {
      navigate(`${Constants.DB_ADMIN_TOOLS_ROUTE}#view=grid`);
    }
  };

  const handleListItemClick = (tabId) => {
    setFullScreenComponent(tabId);
    setActiveTab(tabId);
    navigate(`${Constants.DB_ADMIN_TOOLS_ROUTE}#active=${tabId}&view=full`);
  };

  const handleBackToGrid = () => {
    setFullScreenComponent(null);
    navigate(`${Constants.DB_ADMIN_TOOLS_ROUTE}#view=grid`);
  };

  const renderTabContent = () => {
    const tab = tabConfigs.find(t => t.id === (fullScreenComponent || activeTab));
    return tab ? tab.component : <DownloadManager />;
  };

  const renderContent = () => {
    if (!viewMode) {
      return (
        <ViewSelector
          showViewSelector={showViewSelector}
          handleViewSelect={handleViewSelect}
          setShowViewSelector={setShowViewSelector}
          adminTheme={adminTheme}
        />
      );
    }

    // Check if child component has its own scrollbar
    const childHasScroller = !fullScreenComponent && viewMode === 'tabs';

    return (
      <Box sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        // Only set overflow if child doesn't have its own scroller
        overflow: childHasScroller ? 'hidden' : 'auto'
      }}>
        <Box sx={{
          flex: 1,
          // Let child components manage their own scrolling
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {viewMode === 'tabs' ? (
            <TableView
              activeTab={activeTab}
              handleTabChange={handleTabChange}
              loading={loading}
              currentTabConfig={currentTabConfig}
              tabConfigs={tabConfigs}
              renderTabContent={renderTabContent}
            />
          ) : (
            <GridView
              fullScreenComponent={fullScreenComponent}
              currentTabConfig={currentTabConfig}
              handleBackToGrid={handleBackToGrid}
              handleListItemClick={handleListItemClick}
              tabConfigs={tabConfigs}
              renderTabContent={renderTabContent}
            />
          )}
        </Box>
      </Box>
    );
  };

  return (
    <ThemeProvider theme={adminTheme}>
      <Box
        sx={{
          minHeight: '80vh',
          background: `linear-gradient(135deg, ${alpha('#667eea', 0.02)} 0%, ${alpha('#764ba2', 0.02)} 100%)`,
          py: 0,
          px: 0,
          // REMOVED overflow: 'hidden' - let content flow naturally
          position: 'relative'
        }}
      >
        <Container
          maxWidth="xl"
          sx={{
            px: { xs: 0.5, sm: 1, md: 2 },
            py: 0.5,
            height: '100%',
            position: 'relative'
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              height: '100%',
              position: 'relative'
            }}
          >
            <Card
              sx={{
                height: '100%',
                background: alpha(adminTheme.palette.background.paper, 0.98),
                backdropFilter: 'blur(10px)',
                border: `1px solid ${alpha(adminTheme.palette.primary.main, 0.08)}`,
                borderRadius: 2,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                // REMOVED overflow: 'hidden' - let child components handle scrolling
                display: 'flex',
                flexDirection: 'column',
                position: 'relative'
              }}
            >
              {renderContent()}
            </Card>
          </motion.div>
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default AdminPage;