import React, { useState, useCallback, Suspense } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, SwipeableDrawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, IconButton, Tooltip, Avatar, Chip,
  useTheme, useMediaQuery, Collapse
} from '@mui/material';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import {
  Menu as MenuIcon, ChevronLeft, AdminPanelSettings,
  ExpandLess, ExpandMore, Logout, Home, RefreshRounded,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@features/auth/context/Authentication';
import { AdminThemeProvider, useThemeMode, useT } from '@shared/theme';
import Constants from '@shared/constants';
import usePageMeta from '@shared/hooks/usePageMeta';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import usePendingRequestCounts from '@features/admin/requests/hooks/usePendingRequestCounts';
import { groupedAdminModules } from '@features/admin/adminModules';
import { useAdminMuiTheme, useAdminHeaderValue } from '@features/admin/adminUi';

// Sidebar sections are derived from the single admin module registry — add a
// module there and it appears here (and in the dashboard + router) automatically.
const NAV = groupedAdminModules();

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
  usePageMeta('Admin');

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

  // On mobile the drawer always shows the full sidebar regardless of `open`
  const showFull = open || isMobile;

  const currentPath = location.pathname.split('/').pop();

  // Live pending-request counter (media + catalog). Drives the numeric badge on
  // the 'Requests' sidebar item so admins notice new requests without opening the page.
  const { total: pendingRequests } = usePendingRequestCounts();

  // Active page header (single-header model) — pages register it via AdminPage.
  const header = useAdminHeaderValue();
  const HeaderIcon = header?.icon;

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
        justifyContent: showFull ? 'space-between' : 'center',
        px: showFull ? 2 : 0, py: 2, minHeight: 60,
        borderBottom: `1px solid ${T.border}`,
      }}>
        {showFull && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AdminPanelSettings sx={{ color: T.teal, fontSize: 22 }} />
            <Typography sx={{ fontWeight: 800, color: T.text, fontSize: '0.95rem', letterSpacing: '-0.02em' }}>
              Admin Console
            </Typography>
          </Box>
        )}
        {!isMobile && (
          <IconButton
            size="small"
            onClick={() => setOpen(p => !p)}
            sx={{ color: T.textMuted, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}
          >
            {open ? <ChevronLeft /> : <MenuIcon />}
          </IconButton>
        )}
      </Box>

      {/* Nav */}
      <Box sx={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1,
        '&::-webkit-scrollbar': { width: 3 },
        '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 2 },
      }}>
        {NAV.map((section) => (
          <Box key={section.group}>
            {/* Section label — the 'Overview' group renders without a header */}
            {showFull && section.group !== 'Overview' && (
              <Box
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  px: 2, pt: 2, pb: 0.5, cursor: 'pointer' }}
                onClick={() => toggleSection(section.group)}
              >
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: T.textFaint,
                  textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {section.group}
                </Typography>
                {collapsed[section.group]
                  ? <ExpandMore sx={{ fontSize: 14, color: T.textFaint }} />
                  : <ExpandLess sx={{ fontSize: 14, color: T.textFaint }} />}
              </Box>
            )}
            {!showFull && section.group !== 'Overview' && (
              <Divider sx={{ borderColor: T.border, mx: 1, my: 0.5 }} />
            )}

            <Collapse in={!collapsed[section.group]} timeout="auto">
              <List dense disablePadding sx={{ px: showFull ? 1 : 0.5 }}>
                {section.items.map((item) => {
                  const active = currentPath === item.path || location.pathname.endsWith('/' + item.path);
                  // Live numeric badge for 'requests' overrides any static label.
                  const dynamicBadge = item.id === 'requests' && pendingRequests > 0
                    ? pendingRequests
                    : item.badge;
                  const isCountBadge = typeof dynamicBadge === 'number';
                  return showFull ? (
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
                        <item.icon sx={{ fontSize: 18 }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: active ? 600 : 400, color: active ? T.teal : T.textMuted }}
                      />
                      {dynamicBadge != null && dynamicBadge !== false && dynamicBadge !== '' && (
                        <Chip
                          label={isCountBadge && dynamicBadge > 99 ? '99+' : dynamicBadge}
                          size="small"
                          sx={{
                            height: isCountBadge ? 18 : 16,
                            minWidth: isCountBadge ? 22 : undefined,
                            fontSize: isCountBadge ? '0.65rem' : '0.55rem',
                            fontWeight: 800,
                            bgcolor: isCountBadge
                              ? '#ef4444'
                              : dynamicBadge === 'Live' ? '#10b981'
                              : dynamicBadge === 'New'  ? T.teal
                              : '#f59e0b',
                            color: '#fff',
                            '& .MuiChip-label': { px: 0.8 },
                            animation: isCountBadge ? 'pulseBadge 1.8s ease-in-out infinite' : 'none',
                            '@keyframes pulseBadge': {
                              '0%, 100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0.55)' },
                              '50%':      { boxShadow: '0 0 0 4px rgba(239,68,68,0)' },
                            },
                          }}
                        />
                      )}
                    </ListItemButton>
                  ) : (
                    <Tooltip
                      key={item.id}
                      title={isCountBadge ? `${item.label} (${dynamicBadge} pending)` : item.label}
                      placement="right"
                      arrow
                    >
                      <ListItemButton
                        selected={active}
                        onClick={() => handleNav(item.path)}
                        sx={{
                          position: 'relative',
                          borderRadius: 1.5, mb: 0.3, py: 0.9, px: 0, justifyContent: 'center',
                          color: active ? T.teal : T.textMuted,
                          bgcolor: active ? T.tealBg : 'transparent',
                          '&:hover': { bgcolor: T.hoverBg, color: T.teal },
                          '&.Mui-selected': { bgcolor: T.tealBg },
                        }}
                      >
                        <item.icon sx={{ fontSize: 20 }} />
                        {isCountBadge && (
                          <Box sx={{
                            position: 'absolute', top: 6, right: 8,
                            width: 8, height: 8, borderRadius: '50%',
                            bgcolor: '#ef4444',
                            boxShadow: '0 0 0 2px rgba(239,68,68,0.35)',
                          }} />
                        )}
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
        p: showFull ? 1.5 : 0.75,
        display: 'flex', alignItems: 'center',
        gap: showFull ? 1 : 0, justifyContent: showFull ? 'flex-start' : 'center',
      }}>
        <Avatar sx={{ width: 30, height: 30, bgcolor: T.teal, fontSize: '0.75rem' }}>
          {user?.firstName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? 'A'}
        </Avatar>
        {showFull && (
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
        {showFull && (
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

      {/* ── Mobile drawer (open via the menu button; swipe to close) ──────────── */}
      {/* disableSwipeToOpen: the left-edge open gesture collided with the
          browser's back-navigation swipe. Open with the hamburger instead. */}
      {isMobile && (
        <SwipeableDrawer
          open={mobileOpen}
          onOpen={() => setMobileOpen(true)}
          onClose={() => setMobileOpen(false)}
          disableBackdropTransition
          disableDiscovery
          disableSwipeToOpen
          swipeAreaWidth={0}
          ModalProps={{ keepMounted: true }}
          PaperProps={{ sx: { width: SIDEBAR_W, bgcolor: T.sidebar, border: 'none' } }}
        >
          {sidebarContent}
        </SwipeableDrawer>
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
          {/* Breadcrumb + page title — the single header lives here */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flex: 1 }}>
            <Typography
              onClick={() => handleNav('dashboard')}
              sx={{ fontSize: '0.78rem', color: T.textFaint, cursor: 'pointer', flexShrink: 0,
                display: { xs: 'none', sm: 'block' }, '&:hover': { color: T.teal } }}
            >
              Admin
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: T.textFaint, display: { xs: 'none', sm: 'block' } }}>/</Typography>
            {HeaderIcon && (
              <Box sx={{ width: 28, height: 28, borderRadius: 1.5, display: 'grid', placeItems: 'center', bgcolor: T.tealBg, color: T.teal, flexShrink: 0 }}>
                <HeaderIcon sx={{ fontSize: 17 }} />
              </Box>
            )}
            <Typography
              title={header?.subtitle || undefined}
              sx={{ fontSize: '0.92rem', color: T.text, fontWeight: 800, letterSpacing: '-0.01em', textTransform: 'capitalize',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
            >
              {header?.title ?? (currentPath && currentPath !== 'admin' ? currentPath.replace(/-/g, ' ') : 'Admin')}
            </Typography>
          </Box>

          {/* Page actions (desktop) + refresh — registered by AdminPage */}
          {header?.actions && (
            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1, flexShrink: 0 }}>
              {header.actions}
            </Box>
          )}
          {header?.onRefresh && (
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={header.onRefresh} disabled={header.refreshing} aria-label="Refresh"
                sx={{ color: T.textMuted, flexShrink: 0, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>
                <RefreshRounded sx={{ fontSize: 18, animation: header.refreshing ? 'adminTopSpin 1s linear infinite' : 'none', '@keyframes adminTopSpin': { to: { transform: 'rotate(360deg)' } } }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton size="small" onClick={toggleMode}
              sx={{ color: T.textMuted, flexShrink: 0, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>
              {mode === 'dark' ? <LightModeIcon sx={{ fontSize: 18 }} /> : <DarkModeIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Mobile action bar — page actions don't fit the top bar on phones, so
            they get their own slim scrollable row here (only when a page has any). */}
        {isMobile && header?.actions && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: 2, py: 1, flexShrink: 0,
            borderBottom: `1px solid ${T.border}`, bgcolor: T.topbar,
            overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' },
          }}>
            {header.actions}
          </Box>
        )}

        {/* Page content */}
        <Box sx={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 3 },
        }}>
          <Suspense fallback={<ContentLoader />}>
            <AnimatePresence mode="wait">
              {/* Opacity-only (no transform): a transformed ancestor would break
                  position:sticky filter/sort bars inside pages. */}
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
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
  const muiTheme = useAdminMuiTheme();
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
