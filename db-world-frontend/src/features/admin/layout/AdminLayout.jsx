import React, { useState, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, IconButton, Tooltip, Avatar, Chip,
  useTheme, useMediaQuery, alpha, Collapse,
} from '@mui/material';
import {
  Dashboard, People, Assignment, Movie, VideoLibrary,
  Label, Sync, Download, TrackChanges, Computer, Analytics,
  Storage, Folder, Schedule, Menu as MenuIcon, ChevronLeft,
  AdminPanelSettings, ExpandLess, ExpandMore, Logout,
  Circle, ManageAccounts,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@features/auth/context/Authentication';
import Constants from '@shared/constants';

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV = [
  {
    id: 'overview',
    items: [
      { id: 'dashboard',    label: 'Dashboard',        icon: <Dashboard />,      path: 'dashboard', badge: null },
    ],
  },
  {
    id: 'users',
    label: 'Users',
    items: [
      { id: 'users',         label: 'User Management',  icon: <People />,          path: 'users' },
      { id: 'activity-logs', label: 'Activity Logs',    icon: <Assignment />,      path: 'activity-logs', badge: 'Live' },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    items: [
      { id: 'records',     label: 'Records',            icon: <Movie />,           path: 'records' },
      { id: 'media-files', label: 'Media Files',        icon: <VideoLibrary />,    path: 'media-files' },
      { id: 'tags-rails',  label: 'Tags & Rails',       icon: <Label />,           path: 'tags-rails', badge: 'New' },
      { id: 'tmdb-sync',   label: 'TMDB Sync',          icon: <Sync />,            path: 'tmdb-sync', badge: 'New' },
    ],
  },
  {
    id: 'downloads',
    label: 'Downloads',
    items: [
      { id: 'downloads',      label: 'Download Manager', icon: <Download />,        path: 'downloads' },
      { id: 'user-activity',  label: 'User Activity',    icon: <TrackChanges />,    path: 'user-activity' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { id: 'system-info', label: 'System Info',         icon: <Computer />,        path: 'system-info' },
      { id: 'logs',        label: 'Logs',                icon: <Analytics />,       path: 'logs' },
      { id: 'redis',       label: 'Redis Cache',         icon: <Storage />,         path: 'redis' },
      { id: 'files',       label: 'File Manager',        icon: <Folder />,          path: 'files' },
      { id: 'scheduler',   label: 'Scheduler',           icon: <Schedule />,        path: 'scheduler', badge: 'New' },
    ],
  },
  {
    id: 'v2',
    label: 'V2 (New)',
    items: [
      { id: 'v2-users',   label: 'Users V2',   icon: <ManageAccounts />, path: 'v2/users',   badge: 'New' },
      { id: 'v2-records', label: 'Records V2', icon: <Movie />,          path: 'v2/records', badge: 'New' },
    ],
  },
];

const SIDEBAR_W      = 240;
const SIDEBAR_MINI_W = 60;

// ─── Component ────────────────────────────────────────────────────────────────

const AdminLayout = () => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { auth, logout } = useAuth() ?? {};
  const user = auth?.user;
  const role = auth?.role;

  const [open,      setOpen]      = useState(!isMobile);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed,  setCollapsed]  = useState({});

  const currentPath = location.pathname.split('/').pop();

  const handleNav = useCallback((path) => {
    navigate(`${Constants.DB_ADMIN_BASE_ROUTE}/${path}`);
    if (isMobile) setMobileOpen(false);
  }, [navigate, isMobile]);

  const toggleSection = (id) =>
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  // ── Sidebar inner content ────────────────────────────────────────────────
  const sidebarContent = (
    <Box sx={{
      display: 'flex', flexDirection: 'column', height: '100%',
      bgcolor: '#0a0a12', overflow: 'hidden',
    }}>
      {/* Logo / header */}
      <Box sx={{
        display: 'flex', alignItems: 'center',
        justifyContent: open ? 'space-between' : 'center',
        px: open ? 2 : 0, py: 2, minHeight: 60,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {open && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AdminPanelSettings sx={{ color: '#6366f1', fontSize: 22 }} />
            <Typography sx={{ fontWeight: 800, color: '#fff', fontSize: '0.95rem', letterSpacing: '-0.02em' }}>
              Admin Console
            </Typography>
          </Box>
        )}
        <IconButton
          size="small"
          onClick={() => setOpen(p => !p)}
          sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}
        >
          {open ? <ChevronLeft /> : <MenuIcon />}
        </IconButton>
      </Box>

      {/* Nav */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1,
        '&::-webkit-scrollbar': { width: 3 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 },
      }}>
        {NAV.map((section) => (
          <Box key={section.id}>
            {/* Section label */}
            {open && section.label && (
              <Box
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  px: 2, pt: 2, pb: 0.5, cursor: 'pointer' }}
                onClick={() => toggleSection(section.id)}
              >
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)',
                  textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {section.label}
                </Typography>
                {collapsed[section.id]
                  ? <ExpandMore sx={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }} />
                  : <ExpandLess sx={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }} />}
              </Box>
            )}
            {!open && section.label && (
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mx: 1, my: 0.5 }} />
            )}

            <Collapse in={!collapsed[section.id]} timeout="auto">
              <List dense disablePadding sx={{ px: open ? 1 : 0.5 }}>
                {section.items.map((item) => {
                  const active = currentPath === item.path || location.pathname.endsWith('/' + item.path);
                  return open ? (
                    <ListItemButton
                      key={item.id}
                      selected={active}
                      onClick={() => handleNav(item.path)}
                      sx={{
                        borderRadius: 1.5, mb: 0.3, py: 0.9, px: 1.5,
                        color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                        bgcolor: active ? alpha('#6366f1', 0.18) : 'transparent',
                        '&:hover': { bgcolor: active ? alpha('#6366f1', 0.22) : 'rgba(255,255,255,0.05)', color: '#fff' },
                        '&.Mui-selected': { bgcolor: alpha('#6366f1', 0.18) },
                        transition: 'all 0.15s',
                        borderLeft: active ? '3px solid #6366f1' : '3px solid transparent',
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 34, color: active ? '#6366f1' : 'inherit' }}>
                        {React.cloneElement(item.icon, { sx: { fontSize: 18 } })}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: active ? 600 : 400 }}
                      />
                      {item.badge && (
                        <Chip label={item.badge} size="small" sx={{
                          height: 16, fontSize: '0.55rem', fontWeight: 700,
                          bgcolor: item.badge === 'Live' ? '#10b981' : item.badge === 'New' ? '#6366f1' : '#f59e0b',
                          color: '#fff', '& .MuiChip-label': { px: 0.8 },
                        }} />
                      )}
                    </ListItemButton>
                  ) : (
                    <Tooltip key={item.id} title={item.label} placement="right" arrow>
                      <ListItemButton
                        selected={active}
                        onClick={() => handleNav(item.path)}
                        sx={{
                          borderRadius: 1.5, mb: 0.3, py: 0.9, px: 0, justifyContent: 'center',
                          color: active ? '#6366f1' : 'rgba(255,255,255,0.45)',
                          bgcolor: active ? alpha('#6366f1', 0.15) : 'transparent',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: '#fff' },
                          '&.Mui-selected': { bgcolor: alpha('#6366f1', 0.15) },
                        }}
                      >
                        {React.cloneElement(item.icon, { sx: { fontSize: 20 } })}
                      </ListItemButton>
                    </Tooltip>
                  );
                })}
              </List>
            </Collapse>
          </Box>
        ))}
      </Box>

      {/* User footer */}
      <Box sx={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        p: open ? 1.5 : 0.75,
        display: 'flex', alignItems: 'center',
        gap: open ? 1 : 0, justifyContent: open ? 'flex-start' : 'center',
      }}>
        <Avatar sx={{ width: 30, height: 30, bgcolor: '#6366f1', fontSize: '0.75rem' }}>
          {user?.firstName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? 'A'}
        </Avatar>
        {open && (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.78rem', color: '#fff', fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.firstName ?? user?.email ?? 'Admin'}
            </Typography>
            <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)' }}>
              {role ?? 'ADMIN'}
            </Typography>
          </Box>
        )}
        {open && (
          <Tooltip title="Sign out">
            <IconButton size="small" onClick={logout}
              sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#f87171' } }}>
              <Logout sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#0d0d18', overflow: 'hidden' }}>

      {/* ── Desktop sidebar ─────────────────────────────────────────────────── */}
      {!isMobile && (
        <Box component={motion.div}
          animate={{ width: open ? SIDEBAR_W : SIDEBAR_MINI_W }}
          transition={{ type: 'tween', duration: 0.22 }}
          sx={{ flexShrink: 0, height: '100vh', overflow: 'hidden' }}
        >
          {sidebarContent}
        </Box>
      )}

      {/* ── Mobile drawer ───────────────────────────────────────────────────── */}
      {isMobile && (
        <Drawer
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          PaperProps={{ sx: { width: SIDEBAR_W, bgcolor: 'transparent', border: 'none' } }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <Box sx={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', minWidth: 0,
      }}>
        {/* Top bar */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 2, height: 52, flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          bgcolor: 'rgba(255,255,255,0.02)',
        }}>
          {isMobile && (
            <IconButton size="small" onClick={() => setMobileOpen(true)}
              sx={{ color: 'rgba(255,255,255,0.7)' }}>
              <MenuIcon />
            </IconButton>
          )}
          {/* Breadcrumb */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography
              onClick={() => handleNav('dashboard')}
              sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                '&:hover': { color: '#6366f1' } }}
            >
              Admin
            </Typography>
            {currentPath && currentPath !== 'admin' && <>
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.2)' }}>/</Typography>
              <Typography sx={{ fontSize: '0.78rem', color: '#fff', fontWeight: 600, textTransform: 'capitalize' }}>
                {currentPath.replace(/-/g, ' ')}
              </Typography>
            </>}
          </Box>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Circle sx={{ fontSize: 8, color: '#10b981' }} />
            <Typography sx={{ fontSize: '0.7rem', color: '#10b981' }}>Online</Typography>
          </Box>
        </Box>

        {/* Page content */}
        <Box sx={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 3 },
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              style={{ minHeight: '100%' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </Box>
      </Box>
    </Box>
  );
};

export default AdminLayout;
