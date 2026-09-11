import React, { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, IconButton, Tooltip } from '@mui/material';
import { NotificationsOutlined as BellIcon } from '@mui/icons-material';

import NotificationPanel, { surfaceFromTokens } from '@shared/notifications/NotificationPanel';
import { fetchUnreadCount } from '@shared/notifications/notificationsApi';
import { useT } from '@shared/theme';

/**
 * The global unread bell.
 *
 * This existed only inside the cinema navbar, which meant that everywhere else in the app —
 * including the IPO tracker whose alerts land in this very list — a user had no idea anything had
 * arrived. It is the same panel component; only the surface differs, because the global header
 * follows the light/dark theme while the cinema bar is always dark.
 *
 * The count is fetched once and refreshed on window focus rather than polled: notifications also
 * arrive as pushes, so a background timer would be load without a purpose.
 */
export default function NotificationBell({ size = 36, iconSize = 21 }) {
  const T = useT();
  const queryClient = useQueryClient();
  const [anchorEl, setAnchorEl] = useState(null);

  const { data: unread = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadCount,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const handleUnreadClear = useCallback(() => {
    queryClient.setQueryData(['notifications', 'unread-count'], 0);
  }, [queryClient]);

  return (
    <>
      <Tooltip title={unread > 0 ? `${unread} unread` : 'Notifications'}>
        <IconButton
          onClick={(event) => setAnchorEl(event.currentTarget)}
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          sx={{
            color: T.textMuted,
            width: size,
            height: size,
            '&:focus-visible': { outline: `3px solid ${T.teal}`, outlineOffset: 3 },
            '&:hover': { color: T.teal, bgcolor: T.tealBg },
          }}
        >
          <Badge
            badgeContent={unread > 0 ? unread : null}
            color="error"
            max={99}
            sx={{ '& .MuiBadge-badge': { fontSize: '0.55rem', height: 15, minWidth: 15, p: '0 4px' } }}
          >
            <BellIcon sx={{ fontSize: iconSize }} />
          </Badge>
        </IconButton>
      </Tooltip>

      <NotificationPanel
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        onUnreadClear={handleUnreadClear}
        hasUnread={unread > 0}
        surface={surfaceFromTokens(T)}
      />
    </>
  );
}
