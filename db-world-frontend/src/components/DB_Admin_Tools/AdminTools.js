import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import UserList from '../DB_Users/UserList';
import UsersData from './UserManagment/UsersData';
import { 
  Box, 
  Card, 
  CircularProgress, 
  FormControlLabel, 
  Switch, 
  Tab, 
  Tabs, 
  useTheme,
  createTheme,
  ThemeProvider
} from '@mui/material';
import { motion } from 'framer-motion';
import Constants from '../Constants';
import { getAllUsers } from '../ApiServices';
import { useDispatch, useSelector } from 'react-redux';
import DownloadStuf from './Mirror/Mirror';
import UserRole from './UserManagment/UserRole';
import { findAllUsers } from '../../redux/action/allActions';
import { Form } from 'react-bootstrap';
import ApplicationLogs from './ApplicationLogs';
import DownloadTracker from './DownloadTracker';
import StatusCopy from './Status';
import RecordsManagement from './RecordsManagment/RecordsManagement';
import FileExplorer from './FileExplorer/FileExplorer'
import LogDashboard from './LogDashboard';

// Components
// import UserDetails from './UserManagment/UserDetails';
// import RecordsManagement from './RecordsManagment/RecordsManagement';
// import DownloadManager from './Mirror/DownloadManager';
// import SystemStatus from './SystemStatus';
// import DownloadTracker from './DownloadTracker';
// import LogDashboard from './LogDashboard';
// import FileExplorer from './FileExplorer/FileExplorer';
import SystemInfo from './SystemInfo';
import Status from './Status';

// Custom teal theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#008080', // Teal
    },
    secondary: {
      main: '#006666', // Darker teal
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
});

const AdminTools = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('download');
  const [tableView, setTableView] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userData, setUserData] = useState(useSelector(state => state.userReducer));


  // Animation variants
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

  const fetchAllUsers = async () => {
    try {
      const usersRes = await getAllUsers();
      if (usersRes.httpStatusCode === 200) {
        dispatch(findAllUsers(usersRes.data));
      } else if (usersRes.httpStatusCode === 401) {
        navigateToLogin();
      } else if (usersRes.httpStatusCode === 403) {
        alert("You don't have admin rights.");
        navigate(Constants.DB_WORLD_HOME_ROUTE, { replace: true });
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const navigateToLogin = () => {
    navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
  };

  useEffect(() => {
    // Parse hash from URL to set active tab
    const hash = location.hash.substring(1);
    if (hash) {
      const params = new URLSearchParams(hash);
      const tab = params.get('active');
      if (tab) setActiveTab(tab);
    }
    fetchAllUsers();
  }, [location]);

  const handleTabChange = (event, newValue) => {
    setLoading(true);
    setActiveTab(newValue);
    navigate(`${Constants.DB_ADMIN_TOOLS_ROUTE}#active=${newValue}`);
    // Simulate loading delay for smoother transition
    setTimeout(() => setLoading(false), 300);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'user_data':
        return (
          <>
            <FormControlLabel
              control={
                <Switch
                  checked={tableView}
                  onChange={() => setTableView(!tableView)}
                  color="primary"
                />
              }
              label="Table View"
              sx={{ mb: 2 }}
            />
            {tableView ? <UserList /> : <UsersData />}
          </>
        );
      case 'user_role':
        return <UserRole userData={userData} />;
      case 'records':
        return <RecordsManagement userRole={userRole} />;
      case 'download':
        return <DownloadStuf />;
      case 'status':
        return <Status />;
      case 'download-tracker':
        return <DownloadTracker />;
      case 'logs':
        return <LogDashboard userRole={userRole} />;
      case 'file_explorer':
        return <FileExplorer />;
      case 'system':
        return <SystemInfo />;
      default:
        return <DownloadStuf />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          minHeight: '100vh',
        //   bgcolor: 'background.default',
          p: { xs: 1, md: 3 }
        }}
      >
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <Card
            sx={{
              width: '100%',
              backgroundColor:'rgba(255, 255, 255, 0.85)',
              boxShadow: 3
            }}
          >
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
                <Tab label="User Details" value="user_data" />
                <Tab label="User Role" value="user_role" />
                <Tab label="Records" value="records" />
                <Tab label="Downloads" value="download" />
                <Tab label="Status" value="status" />
                <Tab label="Download Tracker" value="download-tracker" />
                <Tab label="Logs" value="logs" />
                <Tab label="File Explorer" value="file_explorer" />
                <Tab label="System Info" value="system" />
              </Tabs>
            </motion.div>

            <Box sx={{ p: 3 }}>
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