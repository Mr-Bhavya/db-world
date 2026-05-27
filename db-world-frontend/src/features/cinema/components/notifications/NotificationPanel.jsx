import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, IconButton, CircularProgress, Divider,
  Popover, Drawer, List, ListItemButton,
  alpha, useTheme, useMediaQuery,
} from '@mui/material';
import { Close, RateReview, NotificationsNone, NotificationsActive } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications, markNotificationsRead } from '../../api/cinemaApi';
import Constants from '@shared/constants';

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getRecordRoute(recordType, recordTitle) {
  const encoded = encodeURIComponent(recordTitle);
  const isSeries = ['TV_SERIES', 'SERIES', 'TV'].includes((recordType ?? '').toUpperCase());
  if (isSeries) return Constants.DB_SERIES_DETIALS_ROUTE.replace(':title', encoded);
  return Constants.DB_MOVIE_DETIALS_ROUTE.replace(':title', encoded);
}

const NotificationItem = ({ notif, onNavigate }) => {
  const theme = useTheme();
  const isFulfilled = notif.type === 'REQUEST_FULFILLED';
  const accent = isFulfilled ? theme.palette.success.main : theme.palette.primary.main;
  return (
    <ListItemButton
      onClick={() => onNavigate(notif)}
      sx={{
        py: 1.5, px: 2, gap: 1.5,
        alignItems: 'flex-start',
        bgcolor: notif.read ? 'transparent' : alpha(accent, 0.07),
        borderLeft: `3px solid ${notif.read ? 'transparent' : accent}`,
        '&:hover': { bgcolor: alpha(accent, 0.12) },
      }}
    >
      <Box sx={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        bgcolor: alpha(accent, 0.15),
        display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 0.25,
      }}>
        {isFulfilled
          ? <NotificationsActive sx={{ fontSize: 15, color: accent }} />
          : <RateReview sx={{ fontSize: 15, color: accent }} />
        }
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.83rem', lineHeight: 1.45, fontWeight: notif.read ? 400 : 600 }}>
          {isFulfilled ? (
            <>
              <Box component="span" sx={{ fontWeight: 700 }}>{notif.recordTitle}</Box>
              {' is now available — your request was fulfilled.'}
            </>
          ) : (
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
        <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', mt: 0.3 }}>
          {relativeTime(notif.createdAt)}
        </Typography>
      </Box>
    </ListItemButton>
  );
};

const PanelContent = ({ onClose, onUnreadClear }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchNotifications(30)
      .then(data => setNotifications(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));

    markNotificationsRead()
      .then(() => onUnreadClear())
      .catch(() => {});
  }, [onUnreadClear]);

  const handleNavigate = useCallback((notif) => {
    onClose();
    navigate(getRecordRoute(notif.recordType, notif.recordTitle));
  }, [onClose, navigate]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1.5,
        borderBottom: `1px solid ${theme.palette.divider}`,
        flexShrink: 0,
      }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Notifications</Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <Close sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Body */}
      {loading ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      ) : notifications.length === 0 ? (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, color: 'text.disabled', px: 3 }}>
          <NotificationsNone sx={{ fontSize: 44, opacity: 0.3 }} />
          <Typography sx={{ fontSize: '0.85rem', textAlign: 'center', opacity: 0.6 }}>
            No notifications yet. They&apos;ll appear here when someone reviews a title you might like.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flex: 1, overflowY: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 } }}>
          <List disablePadding>
            {notifications.map((n, i) => (
              <React.Fragment key={n.id}>
                {i > 0 && <Divider />}
                <NotificationItem notif={n} onNavigate={handleNavigate} />
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
const NotificationPanel = ({ anchorEl, onClose, onUnreadClear }) => {
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
            borderTopLeftRadius: 16, borderTopRightRadius: 16,
            height: '70vh', overflow: 'hidden',
          },
        }}
      >
        <PanelContent onClose={onClose} onUnreadClear={onUnreadClear} />
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
          width: 360, height: 480, overflow: 'hidden',
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          mt: 0.5,
        },
      }}
      disableScrollLock
    >
      <PanelContent onClose={onClose} onUnreadClear={onUnreadClear} />
    </Popover>
  );
};

export default NotificationPanel;
