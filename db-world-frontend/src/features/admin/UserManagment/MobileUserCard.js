import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
  Chip,
  LinearProgress,
  Typography,
  Card,
  CardContent,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Divider,
  useMediaQuery,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Icon
} from '@mui/material';
import { 
  Delete, 
  Edit, 
  Refresh, 
  Visibility, 
  Person,
  AdminPanelSettings,
  Shield,
  Search,
  FilterList,
  MoreVert,
  Smartphone,
  Tablet,
  DesktopWindows,
  Menu as MenuIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import UserViewModal from './UserViewModal';
import UserEditModal from './UserEditModal';

// Mobile Actions Component
const MobileActions = ({ user, onView, onEdit, onDelete }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleAction = (action) => {
    handleClose();
    switch(action) {
      case 'view':
        onView(user);
        break;
      case 'edit':
        onEdit(user);
        break;
      case 'delete':
        onDelete(user.userId);
        break;
    }
  };

  return (
    <>
      <IconButton size="small" onClick={handleClick}>
        <MoreVert />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={() => handleAction('view')}>
          <Visibility fontSize="small" sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        <MenuItem onClick={() => handleAction('edit')}>
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Edit User
        </MenuItem>
        <MenuItem onClick={() => handleAction('delete')}>
          <Delete fontSize="small" sx={{ mr: 1 }} />
          Delete User
        </MenuItem>
      </Menu>
    </>
  );
};

const MobileUserCard = ({ user, onView, onEdit, onDelete }) => {
  const theme = useTheme();
  
  const roleConfig = {
    OWNER: { icon: <Shield fontSize="small" />, color: 'error' },
    ADMIN: { icon: <AdminPanelSettings fontSize="small" />, color: 'warning' },
    USER: { icon: <Person fontSize="small" />, color: 'success' }
  };
  
  const config = roleConfig[user.userRole?.name] || roleConfig.USER;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card 
        sx={{ 
          mb: 2, 
          borderRadius: 2,
          background: `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.95)}, ${alpha(theme.palette.background.default, 0.95)})`,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <CardContent sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                {user.firstName} {user.lastName}
              </Typography>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Chip
                  icon={config.icon}
                  label={user.userRole?.name}
                  size="small"
                  sx={{
                    background: `linear-gradient(135deg, ${theme.palette[config.color].main}, ${theme.palette[config.color].light})`,
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    height: 22,
                  }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                  #{user.userId}
                </Typography>
              </Box>
            </Box>
            <MobileActions 
              user={user} 
              onView={onView} 
              onEdit={onEdit} 
              onDelete={onDelete} 
            />
          </Box>

          <Divider sx={{ my: 1.5 }} />

          <Box sx={{ '& > *': { mb: 1 } }}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 80 }}>
                📧 Email:
              </Typography>
              <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                {user.email}
              </Typography>
            </Box>

            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 80 }}>
                📱 Mobile:
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {user.mobileNo || 'N/A'}
              </Typography>
            </Box>

            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 80 }}>
                🔐 Logins:
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 600,
                  background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {user.noOfLogin || 0}
              </Typography>
            </Box>

            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 80 }}>
                🕒 Last Login:
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                {user.loginData?.[0]?.lastLoginDate 
                  ? new Date(user.loginData[0].lastLoginDate).toLocaleString() 
                  : 'Never'
                }
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default MobileUserCard;