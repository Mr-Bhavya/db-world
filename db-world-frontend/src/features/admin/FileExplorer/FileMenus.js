import React, { useState } from 'react';
import {
  Menu,
  MenuItem,
  Paper,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
  useMediaQuery,
  Box,
  Typography,
  Chip,
  Fade,
  Slide,
  Divider,
  Badge,
  Avatar
} from '@mui/material';
import {
  DriveFileMove,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Info as InfoIcon,
  Download,
  EditNote,
  Folder,
  InsertDriveFile,
  Sort,
  SortByAlpha,
  DateRange,
  FolderSpecial,
  InsertDriveFileOutlined,
  ArrowBack,
  SelectAll,
  Deselect,
  MoreHoriz,
  CheckCircle,
  DragIndicator
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { styled } from '@mui/material/styles';

// Styled Components
const StyledMenu = styled(Menu)(({ theme }) => ({
  '& .MuiPaper-root': {
    background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`,
    backdropFilter: 'blur(20px)',
    borderRadius: 16,
    border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
    boxShadow: `0 20px 60px ${alpha(theme.palette.common.black, 0.3)}`,
    minWidth: 220,
    overflow: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 4,
      background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
    }
  },
  '& .MuiList-root': {
    padding: '8px 0',
  }
}));

const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  padding: '12px 20px',
  margin: '0 8px',
  borderRadius: 12,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.1),
    transform: 'translateX(4px)',
    '& .MuiSvgIcon-root': {
      transform: 'scale(1.2)',
    }
  },
  '& .MuiSvgIcon-root': {
    transition: 'transform 0.3s ease',
    marginRight: 12,
    color: theme.palette.primary.main,
    fontSize: 20
  },
  '&.danger': {
    '&:hover': {
      backgroundColor: alpha(theme.palette.error.main, 0.1),
    },
    '& .MuiSvgIcon-root': {
      color: theme.palette.error.main,
    }
  }
}));

const FloatingActionMenu = styled(Paper)(({ theme }) => ({
  position: 'fixed',
  right: 24,
  top: '50%',
  transform: 'translateY(-50%)',
  padding: 12,
  zIndex: 1000,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`,
  backdropFilter: 'blur(20px)',
  borderRadius: 20,
  border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
  boxShadow: `0 20px 60px ${alpha(theme.palette.common.black, 0.3)}`,
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `radial-gradient(circle at 30% 30%, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 70%)`,
    borderRadius: 20,
    zIndex: -1,
  }
}));

const FloatingActionButton = styled(IconButton)(({ theme }) => ({
  width: 48,
  height: 48,
  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
  backdropFilter: 'blur(10px)',
  border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
  borderRadius: 12,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
    transform: 'scale(1.1) rotate(5deg)',
    boxShadow: `0 10px 30px ${alpha(theme.palette.primary.main, 0.3)}`,
    '& .MuiSvgIcon-root': {
      color: 'white',
    }
  },
  '& .MuiSvgIcon-root': {
    transition: 'all 0.3s ease',
    fontSize: 20,
  }
}));

// Menu Icons with different colors
const menuIcons = {
  rename: { icon: EditNote, color: 'primary' },
  move: { icon: DriveFileMove, color: 'info' },
  copy: { icon: CopyIcon, color: 'success' },
  delete: { icon: DeleteIcon, color: 'error' },
  info: { icon: InfoIcon, color: 'warning' },
  download: { icon: Download, color: 'success' }
};

// Animation variants
const menuVariants = {
  hidden: { opacity: 0, scale: 0.8, y: -20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: {
      type: "spring",
      damping: 25,
      stiffness: 300,
      duration: 0.5
    }
  },
  exit: { 
    opacity: 0, 
    scale: 0.9,
    y: 20,
    transition: {
      duration: 0.3
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.3,
      ease: "easeOut"
    }
  })
};

const floatingButtonVariants = {
  hidden: { opacity: 0, x: 50, rotate: -180 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    rotate: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      type: "spring",
      stiffness: 200
    }
  })
};

export const FileContextMenu = React.memo(({
  contextMenu,
  setContextMenu,
  handleOpenModal
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const menuItems = [
    { action: 'rename', label: 'Rename', icon: EditNote },
    { action: 'move', label: 'Move', icon: DriveFileMove },
    { action: 'copy', label: 'Copy', icon: CopyIcon },
    { action: 'download', label: 'Download', icon: Download },
    { action: 'delete', label: 'Delete', icon: DeleteIcon, danger: true },
    { action: 'info', label: 'Information', icon: InfoIcon }
  ];

  const handleClose = () => {
    setContextMenu(null);
  };

  const handleMenuItemClick = (action) => {
    handleOpenModal(action);
    handleClose();
  };

  return (
    <AnimatePresence>
      {contextMenu && (
        <StyledMenu
          open={true}
          onClose={handleClose}
          anchorReference="anchorPosition"
          anchorPosition={
            contextMenu
              ? { 
                  top: Math.min(contextMenu.mouseY, window.innerHeight - 400),
                  left: Math.min(contextMenu.mouseX, window.innerWidth - 240)
                }
              : undefined
          }
          TransitionComponent={motion.div}
          TransitionProps={{
            variants: menuVariants,
            initial: "hidden",
            animate: "visible",
            exit: "exit"
          }}
          disableScrollLock={false}
          disablePortal={isMobile}
        >
          <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DragIndicator fontSize="small" />
              Quick Actions
            </Typography>
          </Box>
          
          {menuItems.map((item, index) => (
            <motion.div
              key={item.action}
              custom={index}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
            >
              <StyledMenuItem
                onClick={() => handleMenuItemClick(item.action)}
                className={item.danger ? 'danger' : ''}
                disableRipple
              >
                <item.icon sx={{ 
                  mr: 1.5,
                  color: item.danger ? theme.palette.error.main : theme.palette.primary.main,
                  fontSize: 20 
                }} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {item.label}
                </Typography>
                {item.action === 'download' && (
                  <Chip
                    label="New"
                    size="small"
                    sx={{ 
                      ml: 'auto', 
                      height: 20,
                      fontSize: '0.65rem',
                      bgcolor: alpha(theme.palette.success.main, 0.1),
                      color: theme.palette.success.main
                    }}
                  />
                )}
              </StyledMenuItem>
            </motion.div>
          ))}
        </StyledMenu>
      )}
    </AnimatePresence>
  );
});

export const FileActionMenu = React.memo(({
  fileMenuAnchor,
  setFileMenuAnchor,
  handleOpenModal
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [hoveredItem, setHoveredItem] = useState(null);

  const menuItems = [
    { action: 'rename', label: 'Rename File', icon: EditNote, description: 'Change file name' },
    { action: 'move', label: 'Move File', icon: DriveFileMove, description: 'Move to another folder' },
    { action: 'copy', label: 'Duplicate File', icon: CopyIcon, description: 'Create a copy' },
    { action: 'download', label: 'Download File', icon: Download, description: 'Download to device' },
    { action: 'info', label: 'File Details', icon: InfoIcon, description: 'View file information' },
    { action: 'delete', label: 'Delete File', icon: DeleteIcon, description: 'Remove permanently', danger: true }
  ];

  const handleClose = () => {
    setFileMenuAnchor(null);
    setHoveredItem(null);
  };

  const handleMenuItemClick = (action) => {
    handleOpenModal(action);
    handleClose();
  };

  return (
    <StyledMenu
      anchorEl={fileMenuAnchor}
      open={Boolean(fileMenuAnchor)}
      onClose={handleClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      sx={{
        '& .MuiPaper-root': {
          width: isMobile ? 'calc(100vw - 32px)' : 320,
          maxWidth: '100%',
        }
      }}
    >
      <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <Typography variant="subtitle2" fontWeight={600}>
          File Actions
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Choose an action for the selected file
        </Typography>
      </Box>

      {menuItems.map((item, index) => (
        <StyledMenuItem
          key={item.action}
          onClick={() => handleMenuItemClick(item.action)}
          className={item.danger ? 'danger' : ''}
          onMouseEnter={() => setHoveredItem(item.action)}
          onMouseLeave={() => setHoveredItem(null)}
          sx={{
            py: 2,
            position: 'relative',
            overflow: 'hidden',
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: hoveredItem === item.action 
                ? `linear-gradient(90deg, ${alpha(item.danger ? theme.palette.error.main : theme.palette.primary.main, 0.05)} 0%, transparent 100%)`
                : 'transparent',
              zIndex: -1,
              transition: 'all 0.3s ease'
            }
          }}
        >
          <Avatar
            sx={{
              width: 36,
              height: 36,
              mr: 2,
              bgcolor: item.danger 
                ? alpha(theme.palette.error.main, 0.1)
                : alpha(theme.palette.primary.main, 0.1),
              color: item.danger ? theme.palette.error.main : theme.palette.primary.main
            }}
          >
            <item.icon fontSize="small" />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={500}>
              {item.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {item.description}
            </Typography>
          </Box>
          {hoveredItem === item.action && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ArrowBack sx={{ 
                color: item.danger ? theme.palette.error.main : theme.palette.primary.main,
                transform: 'rotate(180deg)'
              }} />
            </motion.div>
          )}
        </StyledMenuItem>
      ))}
    </StyledMenu>
  );
});

export const FileSelectMenu = React.memo(({
  selectedFiles,
  setSelectedFiles,
  handleOpenModal
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [hoveredAction, setHoveredAction] = useState(null);

  if (selectedFiles.length === 0) return null;

  const fileCount = selectedFiles.length;
  const hasFolders = selectedFiles.some(f => f.isDirectory);
  const hasFiles = selectedFiles.some(f => !f.isDirectory);

  const actions = [
    { action: 'move', icon: DriveFileMove, label: 'Move', color: theme.palette.info.main },
    { action: 'copy', icon: CopyIcon, label: 'Copy', color: theme.palette.success.main },
    { action: 'download', icon: Download, label: 'Download', color: theme.palette.success.main },
    { action: 'delete', icon: DeleteIcon, label: 'Delete', color: theme.palette.error.main, danger: true },
  ];

  // Mobile: full-width bottom action bar with visible icons
  if (isMobile) {
    return (
      <Slide direction="up" in mountOnEnter unmountOnExit>
        <Box
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            bgcolor: 'background.paper',
            borderTop: `2px solid ${theme.palette.primary.main}`,
            boxShadow: `0 -4px 24px ${alpha(theme.palette.common.black, 0.18)}`,
            zIndex: 1300,
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography variant="body2" fontWeight={700} sx={{ flex: 1, color: 'primary.main' }}>
            {fileCount} selected
          </Typography>
          {actions.map(action => (
            <Tooltip key={action.action} title={action.label} arrow disableTouchListener>
              <IconButton
                size="medium"
                onClick={() => handleOpenModal(action.action)}
                sx={{
                  color: action.color,
                  bgcolor: alpha(action.color, 0.1),
                  border: `1px solid ${alpha(action.color, 0.3)}`,
                  borderRadius: 2,
                  width: 44,
                  height: 44,
                  '&:hover': { bgcolor: alpha(action.color, 0.2) },
                }}
              >
                <action.icon fontSize="small" />
              </IconButton>
            </Tooltip>
          ))}
          <IconButton
            size="medium"
            onClick={() => setSelectedFiles([])}
            sx={{
              color: 'text.secondary',
              bgcolor: alpha(theme.palette.action.hover, 0.8),
              borderRadius: 2,
              width: 44,
              height: 44,
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Slide>
    );
  }

  return (
    <AnimatePresence>
      <Slide direction="left" in={selectedFiles.length > 0} mountOnEnter unmountOnExit>
        <FloatingActionMenu
          sx={{
            right: isMobile ? 16 : 24,
            top: isMobile ? 'auto' : '50%',
            bottom: isMobile ? 80 : 'auto',
            transform: isMobile ? 'none' : 'translateY(-50%)',
            flexDirection: isMobile ? 'row' : 'column',
            padding: isMobile ? 2 : 1.5,
            gap: isMobile ? 1 : 0.75,
          }}
        >
          {/* Selection Info */}
          <Paper
            sx={{
              p: 1.5,
              mb: 1,
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              width: '100%',
              order: isMobile ? -1 : 0,
            }}
          >
            <Badge
              badgeContent={fileCount}
              color="primary"
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  boxShadow: `0 0 0 2px ${theme.palette.background.paper}`
                }
              }}
            >
              <Avatar
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: theme.palette.primary.main,
                }}
              >
                <CheckCircle />
              </Avatar>
            </Badge>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={600}>
                {fileCount} item{fileCount !== 1 ? 's' : ''} selected
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {hasFolders && hasFiles ? 'Folders & Files' : hasFolders ? 'Folders only' : 'Files only'}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => setSelectedFiles([])}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: theme.palette.error.main,
                  transform: 'rotate(90deg)'
                },
                transition: 'all 0.3s ease'
              }}
            >
              <CloseIcon />
            </IconButton>
          </Paper>

          {/* Action Buttons */}
          {actions.map((action, index) => (
            <motion.div
              key={action.action}
              custom={index}
              variants={floatingButtonVariants}
              initial="hidden"
              animate="visible"
            >
              <Tooltip 
                title={action.label} 
                placement={isMobile ? "top" : "left"}
                arrow
              >
                <FloatingActionButton
                  onClick={() => handleOpenModal(action.action)}
                  onMouseEnter={() => setHoveredAction(action.action)}
                  onMouseLeave={() => setHoveredAction(null)}
                  sx={{
                    '&:hover': {
                      background: `linear-gradient(135deg, ${action.color} 0%, ${alpha(action.color, 0.8)} 100%)`,
                      '& .MuiSvgIcon-root': {
                        color: 'white',
                        animation: action.danger ? 'shake 0.5s ease-in-out' : 'none',
                        '@keyframes shake': {
                          '0%, 100%': { transform: 'rotate(0deg)' },
                          '25%': { transform: 'rotate(-10deg)' },
                          '75%': { transform: 'rotate(10deg)' },
                        }
                      }
                    }
                  }}
                >
                  <action.icon sx={{ 
                    color: hoveredAction === action.action ? 'white' : action.color
                  }} />
                </FloatingActionButton>
              </Tooltip>
            </motion.div>
          ))}

          {/* Select All Toggle */}
          <motion.div
            custom={actions.length}
            variants={floatingButtonVariants}
            initial="hidden"
            animate="visible"
          >
            <Tooltip title="Toggle selection" placement={isMobile ? "top" : "left"} arrow>
              <FloatingActionButton
                onClick={() => setSelectedFiles([])}
                sx={{
                  '&:hover': {
                    background: `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${alpha(theme.palette.warning.main, 0.8)} 100%)`,
                    transform: 'scale(1.1) rotate(180deg)'
                  }
                }}
              >
                <Deselect />
              </FloatingActionButton>
            </Tooltip>
          </motion.div>
        </FloatingActionMenu>
      </Slide>
    </AnimatePresence>
  );
});

export const FileSortMenu = React.memo(({ setSortBy, setSortMenuAnchor, sortMenuAnchor }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const sortOptions = [
    { value: 'name', label: 'Name', icon: SortByAlpha, description: 'Alphabetical order' },
    { value: 'date', label: 'Date Modified', icon: DateRange, description: 'Most recent first' },
    { value: 'folders-first', label: 'Folders First', icon: FolderSpecial, description: 'Folders then files' },
    { value: 'files-first', label: 'Files First', icon: InsertDriveFileOutlined, description: 'Files then folders' },
    { value: 'size', label: 'File Size', icon: Sort, description: 'Largest first' }
  ];

  const handleClose = () => {
    setSortMenuAnchor(null);
  };

  const handleSortSelect = (value) => {
    setSortBy(value);
    handleClose();
  };

  return (
    <StyledMenu
      anchorEl={sortMenuAnchor}
      open={Boolean(sortMenuAnchor)}
      onClose={handleClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      sx={{
        '& .MuiPaper-root': {
          width: isMobile ? 'calc(100vw - 32px)' : 280,
        }
      }}
    >
      <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Sort />
          Sort Options
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Choose how to organize files
        </Typography>
      </Box>

      {sortOptions.map((option, index) => (
        <motion.div
          key={option.value}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <StyledMenuItem
            onClick={() => handleSortSelect(option.value)}
            sx={{
              py: 1.5,
              '&:hover': {
                '& .sort-icon': {
                  transform: 'scale(1.2) rotate(180deg)',
                  color: theme.palette.primary.main
                }
              }
            }}
          >
            <option.icon 
              className="sort-icon"
              sx={{ 
                mr: 2, 
                color: 'text.secondary',
                transition: 'all 0.3s ease'
              }} 
            />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                {option.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {option.description}
              </Typography>
            </Box>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Chip
                label="→"
                size="small"
                sx={{
                  height: 20,
                  width: 20,
                  minWidth: 20,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main,
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              />
            </motion.div>
          </StyledMenuItem>
        </motion.div>
      ))}

      <Divider sx={{ my: 1 }} />
      
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Sort order will apply to all files and folders in the current directory.
        </Typography>
      </Box>
    </StyledMenu>
  );
});