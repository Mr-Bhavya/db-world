import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-material.css';
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
import MobileUserCard from './MobileUserCard';

// Actions Cell Renderer for Desktop
const ActionsCellRenderer = (params) => {
  const { onEdit, onView, onDelete } = params.colDef.cellRendererParams;
  const theme = useTheme();

  return (
    <Box 
      display="flex" 
      justifyContent="center"
      alignItems="center"
      gap={1}
      sx={{ height: '100%' }}
    >
      {['view', 'edit', 'delete'].map((action, index) => {
        const config = {
          view: { icon: <Visibility fontSize="small" />, color: 'info', title: 'View Details' },
          edit: { icon: <Edit fontSize="small" />, color: 'warning', title: 'Edit User' },
          delete: { icon: <Delete fontSize="small" />, color: 'error', title: 'Delete User' }
        }[action];

        return (
          <motion.div 
            key={action}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Tooltip title={config.title} arrow>
              <IconButton 
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  switch(action) {
                    case 'view': onView(params.data); break;
                    case 'edit': onEdit(params.data); break;
                    case 'delete': onDelete(params.data.userId); break;
                  }
                }}
                sx={{
                  background: `linear-gradient(135deg, ${alpha(theme.palette[config.color].main, 0.1)}, ${alpha(theme.palette[config.color].light, 0.1)})`,
                  border: `1px solid ${alpha(theme.palette[config.color].main, 0.2)}`,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${alpha(theme.palette[config.color].main, 0.2)}, ${alpha(theme.palette[config.color].light, 0.2)})`,
                  },
                  '& .MuiSvgIcon-root': {
                    background: `linear-gradient(45deg, ${theme.palette[config.color].main}, ${theme.palette[config.color].light})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }
                }}
              >
                {config.icon}
              </IconButton>
            </Tooltip>
          </motion.div>
        );
      })}
    </Box>
  );
};

const UsersTableView = ({ users, onDelete, onRefresh, onUpdate, loading = false }) => {
  const [gridApi, setGridApi] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const theme = useTheme();
  
  // Media queries for responsive design
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const handleView = useCallback((user) => {
    setSelectedUser(user);
    setViewModalOpen(true);
  }, []);

  const handleEdit = useCallback((user) => {
    setSelectedUser(user);
    setEditModalOpen(true);
  }, []);

  const handleSave = useCallback(async (updatedUser) => {
    try {
      await onUpdate(updatedUser);
      setEditModalOpen(false);
    } catch (error) {
      console.error("Update error:", error);
    }
  }, [onUpdate]);

  // Responsive column definitions
  const getColumnDefs = useCallback(() => {
    const baseColumns = [
      {
        headerName: 'ID',
        field: 'userId',
        width: 80,
        cellStyle: { 
          textAlign: 'center',
          fontWeight: 600,
          padding: '8px 4px',
        },
        cellRenderer: (params) => (
          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
            #{params.value}
          </Typography>
        ),
      },
      {
        headerName: 'First Name',
        field: 'firstName',
        width: 120,
        cellStyle: { 
          fontWeight: 600,
          padding: '8px 4px',
        },
        cellRenderer: (params) => (
          <Box display="flex" alignItems="center" gap={1}>
            <Person fontSize="small" color="action" />
            <Typography variant="body2">{params.value}</Typography>
          </Box>
        ),
      },
      { 
        headerName: 'Last Name', 
        field: 'lastName', 
        width: 120,
        cellStyle: { 
          fontWeight: 500,
          padding: '8px 4px',
        },
      },
      {
        headerName: 'Role',
        field: 'userRole.name',
        width: 100,
        cellRenderer: (params) => {
          const role = params.value;
          const config = {
            OWNER: { icon: <Shield fontSize="small" />, color: 'error' },
            ADMIN: { icon: <AdminPanelSettings fontSize="small" />, color: 'warning' },
            USER: { icon: <Person fontSize="small" />, color: 'success' }
          }[role] || { icon: <Person fontSize="small" />, color: 'success' };

          return role ? (
            <Chip
              icon={config.icon}
              label={role}
              size="small"
              sx={{
                background: `linear-gradient(135deg, ${theme.palette[config.color].main}, ${theme.palette[config.color].light})`,
                color: 'white',
                fontWeight: 600,
                fontSize: '0.7rem',
                height: 24,
              }}
            />
          ) : null;
        },
      },
      {
        headerName: 'Email',
        field: 'email',
        width: 200,
        cellStyle: { padding: '8px 4px' },
        cellRenderer: (params) => (
          <Tooltip title={params.value} arrow>
            <Typography variant="body2" noWrap sx={{ color: 'primary.main' }}>
              {params.value}
            </Typography>
          </Tooltip>
        ),
      },
      {
        headerName: 'Mobile',
        field: 'mobileNo',
        width: 120,
        cellStyle: { 
          textAlign: 'center',
          padding: '8px 4px',
        },
        cellRenderer: (params) => (
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {params.value || 'N/A'}
          </Typography>
        ),
      },
      {
        headerName: 'Last Login',
        field: 'loginData.0.lastLoginDate',
        valueFormatter: (params) => 
          params.value ? new Date(params.value).toLocaleString() : 'Never',
        width: 180,
        cellRenderer: (params) => (
          <Typography variant="body2" color="text.secondary">
            {params.value ? new Date(params.value).toLocaleString() : 'Never'}
          </Typography>
        ),
      },
      {
        headerName: 'Logins',
        field: 'noOfLogin',
        width: 80,
        cellStyle: { 
          textAlign: 'center',
          padding: '8px 4px',
        },
        cellRenderer: (params) => (
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
            {params.value || 0}
          </Typography>
        ),
      },
      {
        headerName: "Actions",
        field: "actions",
        width: 150,
        cellRenderer: ActionsCellRenderer,
        cellRendererParams: {
          onEdit: handleEdit,
          onView: handleView,
          onDelete: onDelete,
        },
        sortable: false,
        filter: false,
        pinned: 'right',
        cellStyle: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 4px',
        },
      },
    ];

    // Adjust columns based on screen size
    if (isTablet) {
      return baseColumns.filter(col => 
        !['userId', 'lastName', 'loginData.0.lastLoginDate'].includes(col.field)
      );
    }

    return baseColumns;
  }, [handleEdit, handleView, onDelete, theme, isTablet]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    floatingFilter: false, // Disabled to prevent overlapping
    suppressMenu: true,
    cellClass: 'ag-text-wrap',
    autoHeight: true,
    wrapText: true,
    cellStyle: {
      display: 'flex',
      alignItems: 'center',
      padding: '8px 4px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    minWidth: 80,
    flex: 1,
    maxWidth: 300,
  }), []);

  // AG-Grid styles to prevent overlapping
  const gridStyles = useMemo(() => ({
    height: isMobile ? 'calc(100vh - 200px)' : 'calc(70vh - 100px)',
    width: '100%',
    '--ag-foreground-color': theme.palette.text.primary,
    '--ag-background-color': 'transparent',
    '--ag-header-foreground-color': theme.palette.text.primary,
    '--ag-header-background-color': alpha(theme.palette.background.default, 0.9),
    '--ag-border-color': alpha(theme.palette.divider, 0.1),
    '--ag-row-hover-color': alpha(theme.palette.primary.main, 0.05),
    '--ag-header-column-resize-handle-color': theme.palette.primary.main,
    '--ag-selected-row-background-color': alpha(theme.palette.primary.main, 0.1),
    '--ag-range-selection-border-color': theme.palette.primary.main,
    '--ag-font-family': theme.typography.fontFamily,
    '--ag-font-size': isMobile ? '0.75rem' : '0.875rem',
    '--ag-cell-horizontal-padding': '8px',
    '--ag-cell-vertical-padding': '8px',
    '--ag-header-height': isMobile ? '40px' : '50px',
    '--ag-row-height': isMobile ? '50px' : '60px',
  }), [theme, isMobile]);

  // Filter users for mobile view
  const filteredUsers = useMemo(() => {
    if (!searchText) return users;
    return users.filter(user =>
      user.firstName?.toLowerCase().includes(searchText.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchText.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchText.toLowerCase()) ||
      user.userRole?.name?.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [users, searchText]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{ width: '100%' }}
      >
        <Card 
          sx={{ 
            borderRadius: 2,
            background: `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.95)}, ${alpha(theme.palette.background.default, 0.95)})`,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            overflow: 'hidden',
            width: '100%',
          }}
        >

          <CardContent sx={{ p: isMobile ? 1 : 2, pt: 1 }}>
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <LinearProgress 
                  sx={{ 
                    borderRadius: 1,
                    mb: 2,
                    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    '& .MuiLinearProgress-bar': {
                      background: `linear-gradient(90deg, ${theme.palette.secondary.main}, ${theme.palette.primary.main})`,
                    }
                  }} 
                />
              </motion.div>
            )}

            {/* Mobile View */}
            {isMobile ? (
              <Box sx={{ height: 'calc(100vh - 200px)', overflow: 'auto', p: 1 }}>
                {filteredUsers.length === 0 ? (
                  <Box 
                    display="flex" 
                    flexDirection="column" 
                    alignItems="center" 
                    justifyContent="center" 
                    height="50vh"
                  >
                    <Typography color="text.secondary" align="center">
                      No users found
                    </Typography>
                  </Box>
                ) : (
                  filteredUsers.map((user, index) => (
                    <MobileUserCard
                      key={user.userId}
                      user={user}
                      onView={handleView}
                      onEdit={handleEdit}
                      onDelete={onDelete}
                    />
                  ))
                )}
              </Box>
            ) : (
              /* Desktop/Tablet View with AG-Grid */
              <div 
                className="ag-theme-material"
                style={{
                  height: gridStyles.height,
                  width: '100%',
                  ...gridStyles,
                }}
              >
                <AgGridReact
                  columnDefs={getColumnDefs()}
                  defaultColDef={defaultColDef}
                  onGridReady={(params) => {
                    setGridApi(params.api);
                    // Adjust column sizes on grid ready
                    setTimeout(() => {
                      params.api.sizeColumnsToFit();
                    }, 100);
                  }}
                  rowData={users}
                  animateRows={true}
                  pagination={!isMobile}
                  paginationPageSize={isTablet ? 15 : 20}
                  suppressCellFocus={true}
                  rowSelection="single"
                  enableCellTextSelection={true}
                  ensureDomOrder={true}
                  suppressColumnVirtualisation={isTablet}
                  onGridSizeChanged={(params) => {
                    params.api.sizeColumnsToFit();
                  }}
                  onFirstDataRendered={(params) => {
                    params.api.sizeColumnsToFit();
                  }}
                  getRowId={(params) => params.data.userId}
                  components={{
                    loadingOverlay: () => (
                      <Box 
                        display="flex" 
                        alignItems="center" 
                        justifyContent="center"
                        height="100%"
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Refresh color="primary" />
                        </motion.div>
                      </Box>
                    ),
                  }}
                />
              </div>
            )}

          </CardContent>
        </Card>

        {/* Mobile Drawer for Filters */}
        <Drawer
          anchor="left"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
        >
          <Box sx={{ width: 250, p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Filters & Actions
            </Typography>
            <List>
              <ListItem button onClick={onRefresh}>
                <Refresh sx={{ mr: 2 }} />
                <ListItemText primary="Refresh Data" />
              </ListItem>
              <Divider />
            </List>
          </Box>
        </Drawer>

        {/* View User Modal */}
        <UserViewModal
          user={selectedUser}
          open={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
        />

        {/* Edit User Modal */}
        <UserEditModal
          user={selectedUser}
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSave={handleSave}
        />
      </motion.div>
    </AnimatePresence>
  );
};

export default UsersTableView;