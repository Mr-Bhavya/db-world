import React, { useState, useCallback, Suspense, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, IconButton, Tooltip, Avatar, Chip,
  useTheme, useMediaQuery, alpha, Collapse,
} from '@mui/material';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import {
  Dashboard, Assignment, Movie, VideoLibrary,
  LocalOffer, Sync, Download, TrackChanges, Computer, Analytics,
  Storage, Folder, Schedule, Menu as MenuIcon, ChevronLeft,
  AdminPanelSettings, ExpandLess, ExpandMore, Logout,
  Circle, ManageAccounts, Home,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@features/auth/context/Authentication';
import { AdminThemeProvider, useThemeMode, useT } from '@shared/theme';
import Constants from '@shared/constants';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV = [
  {
    id: 'overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <Dashboard />, path: 'dashboard' },
    ],
  },
  {
    id: 'users',
    label: 'Users',
    items: [
      { id: 'users',         label: 'User Management', icon: <ManageAccounts />, path: 'users' },
      { id: 'activity-logs', label: 'Activity Logs',   icon: <Assignment />,     path: 'activity-logs', badge: 'Live' },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    items: [
      { id: 'records',     label: 'Records',       icon: <Movie />,        path: 'records' },
      { id: 'media-files', label: 'Media Files',   icon: <VideoLibrary />, path: 'media-files' },
      { id: 'tag-management', label: 'Tags & Rails', icon: <LocalOffer />, path: 'tag-management' },
      { id: 'tmdb-sync',   label: 'TMDB Sync',     icon: <Sync />,         path: 'tmdb-sync' },
    ],
  },
  {
    id: 'activity',
    label: 'Activity',
    items: [
      { id: 'downloads',     label: 'Download Manager', icon: <Download />,     path: 'downloads' },
      { id: 'ingestion',     label: 'Media Ingestion',  icon: <Download />,     path: 'ingestion' },
      { id: 'user-activity', label: 'Cinema Activity',  icon: <TrackChanges />, path: 'user-activity' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { id: 'system-info', label: 'System Info',   icon: <Computer />,  path: 'system-info' },
      { id: 'logs',        label: 'Log Viewer',    icon: <Analytics />, path: 'logs' },
      { id: 'redis',       label: 'Redis Cache',   icon: <Storage />,   path: 'redis' },
      { id: 'files',       label: 'File Manager',  icon: <Folder />,    path: 'files' },
      { id: 'scheduler',   label: 'Scheduler',     icon: <Schedule />,  path: 'scheduler' },
    ],
  },
];

const SIDEBAR_W      = 240;
const SIDEBAR_MINI_W = 60;

// ─── Inline content-area loader ───────────────────────────────────────────────
const ContentLoader = () => {
  const T = useT();
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '100%', minHeight: 300, gap: 2,
    }}>
      <Box sx={{
        width: 40, height: 40, borderRadius: '50%',
        border: `3px solid ${T.glassBorder}`,
        borderTopColor: T.teal,
        animation: 'spin 0.8s linear infinite',
      }} />
      <Typography sx={{ fontSize: '0.78rem', color: T.textFaint, letterSpacing: '0.08em' }}>
        Loading…
      </Typography>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Box>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

const AdminLayoutInner = () => {
  const { T, mode, toggleMode } = useThemeMode();
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { auth, logout } = useAuth() ?? {};
  const user = auth?.user;
  const role = auth?.role;

  const [open,       setOpen]      = useState(!isMobile);
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
      bgcolor: T.sidebar, overflow: 'hidden',
      borderRight: `1px solid ${T.border}`,
    }}>
      {/* Logo / header */}
      <Box sx={{
        display: 'flex', alignItems: 'center',
        justifyContent: open ? 'space-between' : 'center',
        px: open ? 2 : 0, py: 2, minHeight: 60,
        borderBottom: `1px solid ${T.border}`,
      }}>
        {open && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AdminPanelSettings sx={{ color: T.teal, fontSize: 22 }} />
            <Typography sx={{ fontWeight: 800, color: T.text, fontSize: '0.95rem', letterSpacing: '-0.02em' }}>
              Admin Console
            </Typography>
          </Box>
        )}
        <IconButton
          size="small"
          onClick={() => setOpen(p => !p)}
          sx={{ color: T.textMuted, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}
        >
          {open ? <ChevronLeft /> : <MenuIcon />}
        </IconButton>
      </Box>

      {/* Nav */}
      <Box sx={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1,
        '&::-webkit-scrollbar': { width: 3 },
        '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 2 },
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
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: T.textFaint,
                  textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {section.label}
                </Typography>
                {collapsed[section.id]
                  ? <ExpandMore sx={{ fontSize: 14, color: T.textFaint }} />
                  : <ExpandLess sx={{ fontSize: 14, color: T.textFaint }} />}
              </Box>
            )}
            {!open && section.label && (
              <Divider sx={{ borderColor: T.border, mx: 1, my: 0.5 }} />
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
                        color: active ? T.teal : T.textMuted,
                        bgcolor: active ? T.tealBg : 'transparent',
                        '&:hover': { bgcolor: active ? T.tealBgHover : T.hoverBg, color: active ? T.teal : T.text },
                        '&.Mui-selected': { bgcolor: T.tealBg },
                        transition: 'all 0.15s',
                        borderLeft: active ? `3px solid ${T.teal}` : '3px solid transparent',
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 34, color: active ? T.teal : T.textMuted }}>
                        {React.cloneElement(item.icon, { sx: { fontSize: 18 } })}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: active ? 600 : 400, color: active ? T.teal : T.textMuted }}
                      />
                      {item.badge && (
                        <Chip label={item.badge} size="small" sx={{
                          height: 16, fontSize: '0.55rem', fontWeight: 700,
                          bgcolor: item.badge === 'Live' ? '#10b981' : item.badge === 'New' ? T.teal : '#f59e0b',
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
                          color: active ? T.teal : T.textMuted,
                          bgcolor: active ? T.tealBg : 'transparent',
                          '&:hover': { bgcolor: T.hoverBg, color: T.teal },
                          '&.Mui-selected': { bgcolor: T.tealBg },
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
        borderTop: `1px solid ${T.border}`,
        p: open ? 1.5 : 0.75,
        display: 'flex', alignItems: 'center',
        gap: open ? 1 : 0, justifyContent: open ? 'flex-start' : 'center',
      }}>
        <Avatar sx={{ width: 30, height: 30, bgcolor: T.teal, fontSize: '0.75rem' }}>
          {user?.firstName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? 'A'}
        </Avatar>
        {open && (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.78rem', color: T.text, fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.firstName ?? user?.email ?? 'Admin'}
            </Typography>
            <Typography sx={{ fontSize: '0.62rem', color: T.textFaint }}>
              {role ?? 'ADMIN'}
            </Typography>
          </Box>
        )}
        {open && (
          <Tooltip title="Sign out">
            <IconButton size="small" onClick={logout}
              sx={{ color: T.textFaint, '&:hover': { color: '#ef4444' } }}>
              <Logout sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: T.main, overflow: 'hidden' }}>

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
          PaperProps={{ sx: { width: SIDEBAR_W, bgcolor: T.sidebar, border: 'none' } }}
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
          borderBottom: `1px solid ${T.border}`,
          bgcolor: T.topbar,
          boxShadow: '0 1px 0 rgba(255,255,255,0.04)',
        }}>
          {isMobile && (
            <IconButton size="small" onClick={() => setMobileOpen(true)}
              sx={{ color: T.textMuted }}>
              <MenuIcon />
            </IconButton>
          )}
          {/* Home button */}
          <Tooltip title="DB World Home">
            <IconButton
              size="small"
              onClick={() => navigate(Constants.DB_WORLD_HOME_ROUTE)}
              sx={{ color: T.textMuted, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}
            >
              <Home sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          {/* Breadcrumb */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography
              onClick={() => handleNav('dashboard')}
              sx={{ fontSize: '0.78rem', color: T.textFaint, cursor: 'pointer',
                '&:hover': { color: T.teal } }}
            >
              Admin
            </Typography>
            {currentPath && currentPath !== 'admin' && <>
              <Typography sx={{ fontSize: '0.78rem', color: T.textFaint }}>/</Typography>
              <Typography sx={{ fontSize: '0.78rem', color: T.text, fontWeight: 600, textTransform: 'capitalize' }}>
                {currentPath.replace(/-/g, ' ')}
              </Typography>
            </>}
          </Box>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton size="small" onClick={toggleMode}
              sx={{ color: T.textMuted, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>
              {mode === 'dark' ? <LightModeIcon sx={{ fontSize: 18 }} /> : <DarkModeIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Circle sx={{ fontSize: 8, color: '#10b981' }} />
            <Typography sx={{ fontSize: '0.7rem', color: '#10b981' }}>Online</Typography>
          </Box>
        </Box>

        {/* Page content */}
        <Box sx={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 3 },
        }}>
          <Suspense fallback={<ContentLoader />}>
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
          </Suspense>
        </Box>
      </Box>
    </Box>
  );
};

/** Wraps admin content in a MUI ThemeProvider synced to the admin theme mode.
 *  This ensures MUI Paper, Card, Typography etc. use light/dark palette
 *  matching the admin toggle — not the global dark-default MUI theme.
 */
const AdminMuiThemeWrapper = ({ children }) => {
  const { mode } = useThemeMode();
  const muiTheme = useMemo(() => createTheme({
    palette: {
      mode,
      ...(mode === 'light' ? {
        background: { default: '#f8fafc', paper: '#ffffff' },
        text: { primary: '#000000', secondary: 'rgba(0,0,0,0.55)' },
      } : {
        background: { default: '#000000', paper: 'rgba(255,255,255,0.04)' },
        text: { primary: '#ffffff', secondary: 'rgba(255,255,255,0.55)' },
      }),
    },
  }), [mode]);
  return <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>;
};

const AdminLayout = () => (
  <AdminThemeProvider>
    <AdminMuiThemeWrapper>
      <AdminLayoutInner />
    </AdminMuiThemeWrapper>
  </AdminThemeProvider>
);

export default AdminLayout;
