import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, IconButton, CircularProgress, Divider,
  Popover, Drawer, List, ListItemButton,
  alpha, useTheme, useMediaQuery,
} from '@mui/material';
import { Close, RateReview, NotificationsNone, NotificationsActive, Block, NewReleases, Search as SearchIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications, markNotificationsRead } from './notificationsApi';
import { recordRoute } from '@shared/components/layout/home/dashboard/recordRoute';

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * The panel's own colours.
 *
 * It hangs off two different app bars now — the always-dark cinema navbar and the global header,
 * which follows the light/dark theme — so the surface is a prop rather than a constant. The dark
 * default matches GenreMenu, keeping the two cinema panels reading as one system.
 *
 * Body text colours are part of the surface too: they used to be MUI's `text.secondary` /
 * `text.disabled`, which follow the app theme and would have rendered dark-on-dark the moment this
 * panel was opened over a light-mode header.
 */
export const DARK_SURFACE = {
  bg: '#0b0b0b',
  border: 'rgba(255,255,255,0.14)',
  hairline: 'rgba(255,255,255,0.08)',
  divider: 'rgba(255,255,255,0.06)',
  grip: 'rgba(255,255,255,0.20)',
  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.68)',
  textFaint: 'rgba(255,255,255,0.46)',
};

/** Builds a surface from the app's own `useT()` tokens, for the themed global header. */
export const surfaceFromTokens = (T) => ({
  bg: T.sidebar ?? T.bg,
  border: T.glassBorder,
  hairline: T.border,
  divider: T.border,
  grip: T.borderHover,
  text: T.text,
  textMuted: T.textMuted,
  textFaint: T.textFaint,
});
const HIDE_SCROLLBAR = {
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
};

const NotificationItem = ({ notif, onNavigate, surface }) => {
  const theme = useTheme();
  const isFulfilled = notif.type === 'REQUEST_FULFILLED';
  const isDismissed = notif.type === 'REQUEST_DISMISSED';
  const isCatalogIn = notif.type === 'CATALOG_INGESTED';
  const isCatalogBySearch = notif.type === 'CATALOG_FULFILLED_BY_SEARCH';
  const accent = isFulfilled || isCatalogIn || isCatalogBySearch
    ? theme.palette.success.main
    : isDismissed
      ? theme.palette.warning.main
      : theme.palette.primary.main;
  const Icon = isCatalogBySearch ? SearchIcon
    : isCatalogIn ? NewReleases
    : isFulfilled ? NotificationsActive
    : isDismissed ? Block
    : RateReview;

  // Dismissals for a not-yet-created catalog record have nowhere to go.
  const navigable = Boolean(notif.recordId);

  return (
    <ListItemButton
      onClick={() => onNavigate(notif)}
      disableRipple={!navigable}
      sx={{
        py: 1.5, px: 2, gap: 1.5,
        minHeight: 56,
        alignItems: 'flex-start',
        cursor: navigable ? 'pointer' : 'default',
        bgcolor: notif.read ? 'transparent' : alpha(accent, 0.09),
        borderLeft: `3px solid ${notif.read ? 'transparent' : accent}`,
        '&:hover': { bgcolor: alpha(accent, navigable ? 0.14 : 0.09) },
      }}
    >
      <Box sx={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        bgcolor: alpha(accent, 0.15),
        display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 0.25,
      }}>
        <Icon sx={{ fontSize: 17, color: accent }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* 0.875rem floor — 0.83rem/0.7rem was under the readable minimum on a phone. */}
        <Typography sx={{ fontSize: '0.875rem', lineHeight: 1.45, color: surface.text, fontWeight: notif.read ? 400 : 600 }}>
          {isCatalogIn && (
            <>
              <Box component="span" sx={{ fontWeight: 700 }}>{notif.recordTitle}</Box>
              {' has been added to the catalog. We’ll notify you again when media files are uploaded.'}
            </>
          )}
          {isCatalogBySearch && (
            <>
              <Box component="span" sx={{ fontWeight: 700 }}>{notif.recordTitle}</Box>
              {' is now available — use search to download the file.'}
            </>
          )}
          {isFulfilled && !isCatalogIn && !isCatalogBySearch && (
            <>
              <Box component="span" sx={{ fontWeight: 700 }}>{notif.recordTitle}</Box>
              {' is now available — your request was fulfilled.'}
            </>
          )}
          {isDismissed && (
            <>
              {'Your request for '}
              <Box component="span" sx={{ fontWeight: 700 }}>{notif.recordTitle}</Box>
              {' was dismissed by an admin.'}
            </>
          )}
          {!isFulfilled && !isDismissed && !isCatalogIn && !isCatalogBySearch && (
            <>
              <Box component="span" sx={{ color: accent, fontWeight: 700 }}>
                {notif.actorUsername}
              </Box>
              {' reviewed '}
              <Box component="span" sx={{ fontWeight: 700 }}>
                {notif.recordTitle}
              </Box>
            </>
          )}
        </Typography>
        {isDismissed && notif.message && (
          <Typography sx={{ fontSize: '0.8rem', color: surface.textMuted, mt: 0.4, fontStyle: 'italic' }}>
            “{notif.message}”
          </Typography>
        )}
        <Typography sx={{ fontSize: '0.75rem', color: surface.textFaint, mt: 0.4 }}>
          {relativeTime(notif.createdAt)}
        </Typography>
      </Box>
    </ListItemButton>
  );
};

const PanelContent = ({ onClose, onUnreadClear, hasUnread = true, surface }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchNotifications(30)
      .then(data => setNotifications(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));

    // Only POST when there is actually something to clear — this used to fire
    // on every open, including the common case of opening an already-read list.
    if (!hasUnread) return;
    markNotificationsRead()
      .then(() => onUnreadClear())
      .catch(() => {});
  }, [onUnreadClear, hasUnread]);

  const handleNavigate = useCallback((notif) => {
    // Catalog-request dismissals have no record yet (recordId is the 0 sentinel)
    // so there's nowhere to navigate to — keep the panel open and do nothing.
    if (!notif.recordId || notif.recordId === 0) return;
    onClose();
    navigate(recordRoute(notif.recordType, notif.recordTitle, notif.recordId));
  }, [onClose, navigate]);

  return (
    // `flex: 1; min-height: 0` — NOT `height: 100%`. The paper's height is
    // driven by max-height, so it is indefinite, and a percentage height
    // against it resolves to auto: the list then grew past the paper and was
    // simply clipped by `overflow: hidden`, with nothing scrollable.
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1.25,
        borderBottom: `1px solid ${surface.hairline}`,
        flexShrink: 0,
      }}>
        <Typography sx={{
          fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: surface.textFaint,
        }}>
          Notifications
        </Typography>
        {/* 40px, not `size="small"` (~30px) — this is the panel's only control. */}
        <IconButton
          onClick={onClose}
          aria-label="Close notifications"
          sx={{ width: 40, height: 40, mr: -1, color: surface.textFaint, '&:hover': { color: surface.text } }}
        >
          <Close sx={{ fontSize: 19 }} />
        </IconButton>
      </Box>

      {/* Body */}
      {loading ? (
        <Box sx={{ flex: 1, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      ) : notifications.length === 0 ? (
        <Box sx={{ flex: 1, minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, color: surface.textFaint, px: 3, py: 4 }}>
          <NotificationsNone sx={{ fontSize: 44, opacity: 0.3 }} />
          <Typography sx={{ fontSize: '0.875rem', textAlign: 'center', opacity: 0.6, lineHeight: 1.5 }}>
            Nothing here yet. New titles, fulfilled requests and reviews will show up in this list.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', ...HIDE_SCROLLBAR }}>
          <List disablePadding>
            {notifications.map((n, i) => (
              <React.Fragment key={n.id}>
                {i > 0 && <Divider sx={{ borderColor: surface.divider }} />}
                <NotificationItem notif={n} onNavigate={handleNavigate} surface={surface} />
              </React.Fragment>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
};

/**
 * Props:
 *   anchorEl      — DOM element the Popover anchors to (null = closed)
 *   onClose       — called when panel should close
 *   onUnreadClear — called after markNotificationsRead succeeds (to zero the badge)
 */
const NotificationPanel = ({ anchorEl, onClose, onUnreadClear, hasUnread = true, surface = DARK_SURFACE }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const open = Boolean(anchorEl);

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            background: surface.bg,
            backgroundImage: 'none',
            // The paper must be the flex column, otherwise the scrollable body
            // inside has no bounded height to scroll within.
            display: 'flex', flexDirection: 'column',
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            borderTop: `1px solid ${surface.hairline}`,
            // maxHeight, not a fixed 70vh: a two-item list used to leave most
            // of the sheet empty.
            maxHeight: '76vh',
            overflow: 'hidden',
            // Clear the floating bottom-nav pill + the gesture bar, which were
            // sitting on top of the last notification.
            pb: 'calc(80px + env(safe-area-inset-bottom, 0px))',
          },
        }}
      >
        {/* Drag handle — matches the genre sheet */}
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5, flexShrink: 0 }}>
          <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: surface.grip }} />
        </Box>
        <PanelContent onClose={onClose} onUnreadClear={onUnreadClear} hasUnread={hasUnread} surface={surface} />
      </Drawer>
    );
  }

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      PaperProps={{
        sx: {
          width: 'min(380px, calc(100vw - 32px))',
          // maxHeight so a short list isn't a tall half-empty box.
          maxHeight: 'min(520px, 70vh)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          background: surface.bg,
          backgroundImage: 'none',
          borderRadius: 2,
          border: `1px solid ${surface.border}`,
          boxShadow: `0 16px 48px ${alpha('#000', 0.7)}`,
          mt: 1,
        },
      }}
      disableScrollLock
    >
      <PanelContent onClose={onClose} onUnreadClear={onUnreadClear} hasUnread={hasUnread} surface={surface} />
    </Popover>
  );
};

export default NotificationPanel;
