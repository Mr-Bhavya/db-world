import { useState } from 'react';
import {
  Avatar, Box, Popover, Typography, List, ListItem, ListItemAvatar, ListItemText, Divider,
} from '@mui/material';
import { useT } from '@shared/theme';

/**
 * Click-to-reveal voter list for the admin requests tables. Shows a colour-coded
 * avatar with the vote count; clicking it opens a popover listing each voter's
 * display name and email. Reused by media-requests and catalog-requests.
 *
 * Falls back gracefully when `voters` is omitted (older payloads): the avatar
 * still shows the count, but the popover is suppressed so we never reveal an
 * empty list and confuse the admin.
 */
export default function VotersPopover({ voters, voteCount }) {
  const T = useT();
  const [anchor, setAnchor] = useState(null);
  const list = Array.isArray(voters) ? voters : [];
  const count = voteCount ?? list.length;
  const interactive = list.length > 0;

  const tone =
    count >= 5 ? { bg: '#10b98122', fg: '#10b981' } :
    count >= 2 ? { bg: '#f59e0b22', fg: '#f59e0b' } :
                 { bg: `${T.text}11`, fg: T.textMuted };

  return (
    <>
      <Avatar
        onClick={interactive ? (e) => setAnchor(e.currentTarget) : undefined}
        sx={{
          width: 28, height: 28, mx: 'auto',
          bgcolor: tone.bg, color: tone.fg,
          fontSize: 12, fontWeight: 800,
          cursor: interactive ? 'pointer' : 'default',
          transition: 'transform 0.12s, box-shadow 0.12s',
          '&:hover': interactive ? {
            transform: 'scale(1.08)',
            boxShadow: `0 0 0 3px ${tone.bg}`,
          } : undefined,
        }}
      >
        {count}
      </Avatar>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75,
              minWidth: 260, maxWidth: 360, maxHeight: 320,
              border: `1px solid ${T.glassBorder}`,
              bgcolor: T.glass,
              backdropFilter: 'blur(14px)',
              borderRadius: 2,
              boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
            },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography sx={{
            fontSize: '0.72rem', fontWeight: 800, color: T.textMuted,
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Voters ({count})
          </Typography>
        </Box>
        <Divider sx={{ borderColor: T.glassBorder }} />
        <List dense disablePadding sx={{ py: 0.5, maxHeight: 250, overflowY: 'auto' }}>
          {list.map((v) => (
            <ListItem key={v.userId} sx={{ py: 0.5 }}>
              <ListItemAvatar sx={{ minWidth: 38 }}>
                <Avatar sx={{
                  width: 28, height: 28, fontSize: 11, fontWeight: 800,
                  bgcolor: T.tealBg, color: T.teal,
                }}>
                  {initials(v.name, v.email)}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={v.name || (v.email ?? `User #${v.userId}`)}
                secondary={v.name && v.email ? v.email : null}
                primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 600, color: T.text }}
                secondaryTypographyProps={{ fontSize: '0.7rem', color: T.textMuted }}
              />
            </ListItem>
          ))}
        </List>
      </Popover>
    </>
  );
}

function initials(name, email) {
  const source = (name && name.trim()) || email || '';
  if (!source) return '?';
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
