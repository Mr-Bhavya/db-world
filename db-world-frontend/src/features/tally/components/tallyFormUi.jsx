import { Box, Typography, Dialog, IconButton, Button, Avatar, LinearProgress } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import { initialsOf, avatarColor } from '../utils/tallyFormat';

/**
 * The chrome every tally form shares, so none of them drift into looking like a different app.
 */

/** One input style for every field in the feature. */
export const tallyFieldSx = (T) => ({
  '& .MuiInputBase-input': { color: T.textPrimary, fontSize: 14.5 },
  '& .MuiInputBase-root': { bgcolor: T.glass, borderRadius: 2.5 },
  '& .MuiInputLabel-root': { color: T.textMuted, fontSize: 13.5 },
  '& .MuiInputLabel-root.Mui-focused': { color: T.teal },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.borderHover },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: T.teal, borderWidth: 1 },
  '& .MuiFormHelperText-root': { fontSize: 11, mx: 0, color: T.textMuted },
  '& input::-webkit-calendar-picker-indicator': { filter: 'invert(0.5)', cursor: 'pointer' },
});

/**
 * Dialog shell with a sticky header and footer.
 *
 * Full-screen below `sm` and sticky at both ends, because these forms are long enough to scroll
 * on a phone — and a form that scrolls its own Save button out of reach only reveals that after
 * you have filled it in.
 */
export function TallyFormDialog({
  open, onClose, title, subtitle, busy, actions, fullScreen, maxWidth = 'sm', children,
}) {
  const T = useT();
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth={maxWidth}
      fullScreen={fullScreen}
      slotProps={{
        paper: {
          sx: {
            bgcolor: T.bg,
            backgroundImage: 'none',
            border: fullScreen ? 'none' : `1px solid ${T.glassBorder}`,
            borderRadius: fullScreen ? 0 : 3.5,
            overflowX: 'hidden',
          },
        },
      }}
    >
      {busy && (
        <LinearProgress
          sx={{
            position: 'sticky', top: 0, zIndex: 3, height: 2,
            bgcolor: 'transparent', '& .MuiLinearProgress-bar': { bgcolor: T.teal },
          }}
        />
      )}

      <Box sx={{
        position: 'sticky', top: 0, zIndex: 2, bgcolor: T.bg,
        px: { xs: 2, sm: 2.5 }, pt: { xs: 2, sm: 2.5 }, pb: 1.5,
        borderBottom: `1px solid ${T.border}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{
              fontSize: { xs: 17, sm: 19 }, fontWeight: 800,
              color: T.textPrimary, letterSpacing: -0.3,
            }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography sx={{ fontSize: 12.5, color: T.textMuted, mt: 0.25 }}>{subtitle}</Typography>
            )}
          </Box>
          <IconButton
            size="small"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            sx={{ color: T.textMuted, flexShrink: 0, mt: -0.5, mr: -0.5 }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{
        px: { xs: 2, sm: 2.5 }, py: 2,
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {children}
      </Box>

      <Box sx={{
        position: 'sticky', bottom: 0, zIndex: 2, bgcolor: T.bg,
        px: { xs: 2, sm: 2.5 }, py: 1.5, borderTop: `1px solid ${T.border}`,
        display: 'flex', justifyContent: 'flex-end', gap: 1,
        // Clears the home indicator on a full-screen phone dialog.
        pb: { xs: 'calc(12px + env(safe-area-inset-bottom))', sm: 1.5 },
      }}>
        {actions}
      </Box>
    </Dialog>
  );
}

/** The primary action in every tally dialog. */
export function TallySubmitButton({ children, busy, ...rest }) {
  const T = useT();
  return (
    <Button
      type="submit"
      variant="contained"
      disableElevation
      disabled={busy || rest.disabled}
      {...rest}
      sx={{
        textTransform: 'none', fontWeight: 700, fontSize: 14, borderRadius: 2.5,
        px: 2.5, bgcolor: T.teal, color: '#fff',
        '&:hover': { bgcolor: T.tealHover },
        '&.Mui-disabled': { bgcolor: T.glass, color: T.textMuted },
        ...rest.sx,
      }}
    >
      {busy ? 'Saving…' : children}
    </Button>
  );
}

export function TallyCancelButton({ children = 'Cancel', ...rest }) {
  const T = useT();
  return (
    <Button
      {...rest}
      sx={{
        textTransform: 'none', fontWeight: 600, fontSize: 14,
        borderRadius: 2.5, color: T.textMuted, ...rest.sx,
      }}
    >
      {children}
    </Button>
  );
}

/**
 * A person, as a coloured initial.
 *
 * The colour is derived from the member id, so one person is the same colour on the roster, on
 * every expense row and in the settle-up plan — which is what lets you scan a list without
 * reading it.
 */
export function MemberAvatar({ member, size = 34, dimmed = false }) {
  const T = useT();
  const tint = avatarColor(member?.id ?? '');
  return (
    <Avatar
      sx={{
        width: size, height: size, fontSize: size * 0.38, fontWeight: 800,
        bgcolor: dimmed ? T.glass : `${tint}22`,
        color: dimmed ? T.textMuted : tint,
        border: `1px solid ${dimmed ? T.border : `${tint}55`}`,
        flexShrink: 0,
      }}
    >
      {initialsOf(member?.displayName)}
    </Avatar>
  );
}

/** A tappable person row used by the payer and participant pickers. */
export function MemberToggleRow({ member, selected, onToggle, trailing, subtitle }) {
  const T = useT();
  return (
    <Box
      component={motion.div}
      whileTap={{ scale: 0.985 }}
      onClick={onToggle}
      role={onToggle ? 'button' : undefined}
      tabIndex={onToggle ? 0 : undefined}
      onKeyDown={onToggle ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } } : undefined}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25,
        px: 1.25, py: 1, borderRadius: 2.5,
        cursor: onToggle ? 'pointer' : 'default',
        bgcolor: selected ? T.tealBg : 'transparent',
        border: `1px solid ${selected ? T.glassBorderHover : 'transparent'}`,
        transition: 'background-color .15s ease, border-color .15s ease',
        '&:hover': onToggle ? { bgcolor: selected ? T.tealBgHover : T.glassHover } : undefined,
      }}
    >
      <MemberAvatar member={member} size={32} dimmed={!selected} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography noWrap sx={{
          fontSize: 14, fontWeight: 600,
          color: selected ? T.textPrimary : T.textMuted,
        }}>
          {member.displayName}
        </Typography>
        {subtitle && (
          <Typography noWrap sx={{ fontSize: 11.5, color: T.textMuted }}>{subtitle}</Typography>
        )}
      </Box>
      {trailing}
    </Box>
  );
}
