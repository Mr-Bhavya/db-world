import {
  Box, Typography, IconButton, Button, Avatar, LinearProgress,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import SheetDialog from '@shared/components/SheetDialog';
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
 * A date picker's own text field.
 *
 * <p>Separate from {@link tallyFieldSx} because MUI X v8 does not build its field out of the
 * same parts as a TextField: it is {@code MuiPickersInputBase} / {@code MuiPickersOutlinedInput},
 * with the visible digits in a section list rather than in the {@code <input>} — which is one
 * pixel wide and only there for form semantics. So every selector in {@code tallyFieldSx}
 * silently matches nothing on a picker, and the field renders with no background, no outline and
 * the MUI theme's black ink. On this app's dark surfaces that is an invisible control: not
 * broken, not styled, simply not there.
 */
export const tallyPickerSx = (T) => ({
  '& .MuiPickersOutlinedInput-root': {
    bgcolor: T.glass, borderRadius: 2.5, fontSize: 14.5, color: T.textPrimary,
  },
  '& .MuiPickersOutlinedInput-notchedOutline': { borderColor: T.border },
  '&:hover .MuiPickersOutlinedInput-notchedOutline': { borderColor: T.borderHover },
  '& .Mui-focused .MuiPickersOutlinedInput-notchedOutline': {
    borderColor: T.teal, borderWidth: 1,
  },
  '& .MuiPickersSectionList-root': { color: T.textPrimary },
  '& .MuiPickersSectionList-section': { color: T.textPrimary },
  '& .MuiPickersInputBase-root .MuiIconButton-root': { color: T.textMuted },
});

/**
 * The calendar the picker opens, restyled onto this app's surfaces.
 *
 * <p>Shared rather than written out at each call site: MUI's default calendar is a light-theme
 * one, and a second copy of this drifting from the first would mean one screen's calendar
 * looking like the app and another's looking like stock MUI.
 */
export const tallyCalendarSx = (T) => ({
      '& .MuiPaper-root': {
        bgcolor: T.bg,
        backgroundImage: 'none',
        border: `1px solid ${T.glassBorder}`,
        borderRadius: 3,
      },
      '& .MuiPickersCalendarHeader-label, & .MuiDayCalendar-weekDayLabel': {
        color: T.textMuted,
      },
      '& .MuiPickersDay-root': { color: T.textPrimary, fontWeight: 600 },
      '& .MuiPickersDay-root:hover': { bgcolor: T.glassHover },
      '& .MuiPickersDay-root.Mui-selected': {
        bgcolor: T.teal, color: '#fff',
        '&:hover': { bgcolor: T.tealHover },
      },
      '& .MuiPickersDay-today': { borderColor: T.teal },
      '& .MuiPickersArrowSwitcher-button, & .MuiPickersCalendarHeader-switchViewButton': {
        color: T.textMuted,
      },
      '& .MuiPickersYear-yearButton.Mui-selected': { bgcolor: T.teal, color: '#fff' },
});

/**
 * One part of a form, in a box that says where it starts and stops.
 *
 * <h2>Why the sections needed boxes</h2>
 * They were a flat stack of bold 12.5px labels — "When", "Category", "Who paid?", "Split
 * between" — set in the same weight and nearly the same size as the labels on the fields
 * <em>inside</em> them. With nothing but a gap between one group and the next, and a heading that
 * did not outrank its own contents, the form read as one long list of controls rather than four
 * decisions. On a phone, where only two of them fit on screen at once, there was no way to tell
 * which label belonged to what.
 *
 * <p>So each gets a surface and a heading in the report's key style: small, spaced, uppercase and
 * quiet. Quiet matters — the heading has to lose to the content and still win against the field
 * labels, which is what uppercase at 11px does and what bold at 12.5px did not.
 *
 * @param hint a word like "optional" that belongs to the heading rather than to a field.
 * @param action something that acts on this section alone, kept on the heading row so it cannot
 *               be mistaken for acting on the whole form.
 */
export function TallyFormSection({ title, hint, action, children }) {
  const T = useT();

  return (
    <Box sx={{
      borderRadius: 3, border: `1px solid ${T.border}`, bgcolor: T.glass,
      p: { xs: 1.5, sm: 1.75 },
    }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 1, mb: 1.25,
      }}>
        <Typography sx={{
          fontSize: 11, fontWeight: 800, letterSpacing: 0.6,
          textTransform: 'uppercase', color: T.textFaint,
        }}>
          {title}
          {hint && (
            <Box component="span" sx={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
              {` \u00b7 ${hint}`}
            </Box>
          )}
        </Typography>
        {action}
      </Box>
      {children}
    </Box>
  );
}

/**
 * Dialog shell with a sticky header and footer.
 *
 * <p>Sticky at both ends because these forms are long enough to scroll on a phone — and a form
 * that scrolls its own Save button out of reach only reveals that after you have filled it in.
 *
 * <p>The presentation — a sheet on a phone, a centred dialog on a pointer device, Back closing
 * it, the height animating as the content changes — all belongs to {@link SheetDialog} now, which
 * every dialog in the app uses. What is left here is the chrome that is specific to a tally form:
 * the title block, the busy bar and the action row.
 *
 * @param fullScreen accepted and ignored. Callers computed it as "is this a phone"; SheetDialog
 *                   asks that question itself, so passing it is no longer necessary and getting it
 *                   wrong is no longer possible.
 */
export function TallyFormDialog({
  open, onClose, title, subtitle, busy, actions, maxWidth = 'sm', children,
}) {
  const T = useT();

  return (
    <SheetDialog
      open={open}
      onClose={busy ? undefined : onClose}
      disableBack={busy}
      fullWidth
      maxWidth={maxWidth}
      slotProps={{
        paper: {
          sx: {
            bgcolor: T.bg,
            backgroundImage: 'none',
            border: `1px solid ${T.glassBorder}`,
            borderRadius: 3.5,
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
        px: { xs: 2, sm: 2.5 }, pt: { xs: 1.5, sm: 2.5 }, pb: 1.5,
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
    </SheetDialog>
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
