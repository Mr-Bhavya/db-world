import { Box, IconButton, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useT } from '@shared/theme';
import LedgerAvatar from './LedgerAvatar';
import GroupTabs from './GroupTabs';

/**
 * The scroll range over which the header hands over to the bar.
 *
 * <p>The two overlap on purpose. Ending one before the other begins would read as the header
 * leaving and then, separately, a bar arriving — which is what it used to do, appearing all at
 * once the moment a threshold was crossed. Overlapping them makes it one movement: the header
 * gives way <em>into</em> the bar, and at any point in between both are partly there.
 */
const HEADER_FADE = [24, 150];
const BAR_FADE = [96, 170];

/** One row now, at every width — see {@link GroupTabs}'s `dense` note for how that fits. */
export const GROUP_BAR_H = 52;

/** Where the app bar ends and this one begins. */
export const APP_BAR_H = { xs: 56, md: 64 };

/**
 * The offset for anything else sticking to the top of a group page.
 *
 * <p>Exported because anything else that sticks has to clear this. The expense feed's date labels
 * are the case that matters: left at the app bar's height they slide underneath and disappear.
 */
export const GROUP_STICKY_TOP = {
  xs: APP_BAR_H.xs + GROUP_BAR_H,
  md: APP_BAR_H.md + GROUP_BAR_H,
};

/**
 * What the page's own header becomes once you have scrolled past it.
 *
 * <h2>Fixed, and tied to the scroll rather than to a threshold</h2>
 * Fixed because the bar is a different shape from the header it replaces, and a sticky element
 * changing shape as it pins drags the content under it around at the exact moment the reader is
 * moving. Tied to scroll position because a bar that fades in over 200ms when you cross a line
 * announces itself as a second header arriving; one whose opacity <em>is</em> a function of how
 * far you have scrolled reads as the first header turning into it. Scrub back up and it turns
 * back, at whatever speed your thumb chose.
 *
 * <p>It carries the back arrow and the overflow menu, not just the tabs: once the real header is
 * gone those are the only ways out of the page, and a reader forty expenses down should not have
 * to scroll back to the top to leave or to edit.
 *
 * <p>Deliberately below the app bar in the stack and above everything else. Modals and drawers
 * sit higher still, so this never covers a dialog.
 */
export default function GroupStickyBar({ group, groupId, active, onBack, onMenu }) {
  const T = useT();
  const { scrollY } = useScroll();

  const opacity = useTransform(scrollY, BAR_FADE, [0, 1]);
  const y = useTransform(scrollY, BAR_FADE, [-14, 0]);
  // Transparent chrome must not eat a tap meant for the page it is lying over.
  const pointerEvents = useTransform(scrollY, (value) => (value > BAR_FADE[0] ? 'auto' : 'none'));

  return (
    <Box
      component={motion.div}
      style={{ opacity, y, pointerEvents }}
      sx={{
        position: 'fixed', left: 0, right: 0, top: APP_BAR_H,
        zIndex: (theme) => theme.zIndex.appBar - 10,
        bgcolor: T.bg, borderBottom: `1px solid ${T.border}`,
        px: { xs: 2, sm: 3, md: 4 },
      }}
    >
      <Box sx={{
        maxWidth: 1080, mx: 'auto', width: '100%', height: GROUP_BAR_H,
        display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 2 },
      }}>
        <IconButton
          onClick={onBack}
          aria-label="Back to your groups"
          size="small"
          sx={{ color: T.textMuted, ml: -0.5, flexShrink: 0 }}
        >
          <ArrowBackRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>

        {group && <LedgerAvatar ledger={group} size="sm" />}

        <Typography noWrap sx={{
          fontSize: 14.5, fontWeight: 800, color: T.textPrimary,
          letterSpacing: -0.3, minWidth: 0, flex: 1,
        }}>
          {group?.name}
        </Typography>

        <GroupTabs groupId={groupId} active={active} dense />

        <IconButton
          onClick={onMenu}
          aria-label="Group options"
          size="small"
          sx={{ color: T.textMuted, mr: -0.5, flexShrink: 0 }}
        >
          <MoreVertRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>
    </Box>
  );
}

/**
 * The other half of the handover: what the page's own header does as you scroll away from it.
 *
 * <p>A hook rather than a component so the header keeps its entry animation. Both would otherwise
 * be animating {@code opacity} and {@code y} on one element, and the last one to write wins —
 * which in practice means the header arrives invisible.
 */
export function useHeaderFade() {
  const { scrollY } = useScroll();
  return {
    opacity: useTransform(scrollY, HEADER_FADE, [1, 0]),
    y: useTransform(scrollY, HEADER_FADE, [0, -12]),
  };
}
