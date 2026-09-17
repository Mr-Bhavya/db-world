import { useNavigate } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { motion, useReducedMotion } from 'framer-motion';
import Constants from '@shared/constants';
import { useT } from '@shared/theme';

/**
 * The three ways to look at one group.
 *
 * <p>Two of these used to live in the overflow menu, where nobody found them. A spending report
 * and a change history are not <em>actions</em> — they are the same group seen differently — and
 * things you look at belong somewhere you can see, not behind three dots next to Archive.
 *
 * <p>Tabs, and only for these three. Edit and Archive stay in the menu because they are actions:
 * a tab you cannot navigate back out of is not a tab. And the balances deliberately sit
 * <em>above</em> this bar on the expenses view rather than becoming a fourth tab — the number you
 * opened the group to check should not be one tap away.
 *
 * <p>Real routes rather than local state, so a tab can be linked to, opened in a new window and
 * survives a refresh. Each page keeps its own header and its own data, and shares only this bar.
 */
const TABS = [
  {
    key: 'expenses',
    label: 'Expenses',
    icon: <ReceiptLongRoundedIcon sx={{ fontSize: 16 }} />,
    to: (id) => Constants.tallyGroupPath(id),
  },
  {
    key: 'report',
    label: 'Report',
    icon: <InsightsRoundedIcon sx={{ fontSize: 16 }} />,
    to: (id) => Constants.tallyGroupReportPath(id),
  },
  {
    key: 'history',
    label: 'History',
    icon: <HistoryRoundedIcon sx={{ fontSize: 16 }} />,
    to: (id) => Constants.tallyGroupHistoryPath(id),
  },
];

export default function GroupTabs({ groupId, active, dense = false }) {
  const T = useT();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  return (
    <Box
      role="tablist"
      sx={{
        display: 'flex', gap: 0.5, p: 0.5,
        borderRadius: 2.5, bgcolor: T.glass, border: `1px solid ${T.border}`,
        // Fits three tabs on the narrowest phone without wrapping or scrolling. The cap keeps
        // three tabs from stretching across a desktop; the shrink is for the one width where
        // the bar and the Add-expense button beside it are within a few pixels of the gutters.
        // Spacing is the toolbar row's to own -- this bar does not stand on its own line.
        ...(dense ? {
          // In the pinned bar it sits beside a title rather than owning the row, so it takes
          // only the width it needs.
          flexShrink: 0, minWidth: 0,
        } : {
          width: '100%', maxWidth: { sm: 360, md: 380 }, minWidth: 0, flexShrink: 1,
        }),
      }}
    >
      {TABS.map((tab) => {
        const selected = tab.key === active;
        return (
          <Box
            key={tab.key}
            component={motion.button}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={tab.label}
            whileTap={{ scale: 0.97 }}
            // `replace`, not push. Three tabs over one group are one place, not three, and
            // pushing made Back walk you through every tab you had looked at before it finally
            // let you out -- when what Back means here is "take me back to my ledgers".
            onClick={() => !selected && navigate(tab.to(groupId), { replace: true })}
            sx={{
              position: 'relative', minWidth: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.6,
              px: dense ? { xs: 0.9, md: 1 } : 1,
              py: dense ? 0.55 : 0.85,
              flex: dense ? '0 0 auto' : 1,
              borderRadius: 2,
              cursor: selected ? 'default' : 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              color: selected ? T.teal : T.textMuted,
              bgcolor: 'transparent', border: 'none',
              transition: 'color .18s ease',
              '&:hover': { color: selected ? T.teal : T.textPrimary },
              '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: -2 },
            }}
          >
            {/* The moving pill, not a per-tab background: with a shared layoutId it slides
                between tabs instead of one fading out while another fades in. */}
            {selected && (
              <Box
                component={motion.span}
                // The pinned bar renders a second copy of this bar, and two elements sharing one
                // layoutId make framer-motion treat them as the same pill -- so it flies across
                // the page between them the moment the pinned copy appears.
                layoutId={dense ? 'tally-group-tab-pinned' : 'tally-group-tab'}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                sx={{
                  position: 'absolute', inset: 0, borderRadius: 2,
                  bgcolor: T.tealBg, border: `1px solid ${T.glassBorderHover}`,
                }}
              />
            )}
            <Box sx={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
              {tab.icon}
            </Box>
            {/* The label goes on a phone's pinned bar and nowhere else. Three labelled tabs
                plus a group name do not fit across 375px, and the choice is between dropping
                the labels and dropping to two rows -- and two rows of pinned chrome under a
                56px app bar is a sixth of the screen gone before any expense is visible.
                The icons stay, and each tab keeps its accessible name either way. */}
            <Typography
              noWrap
              component="span"
              sx={{
                position: 'relative', fontSize: 13, fontWeight: 700, color: 'inherit',
                display: dense ? { xs: 'none', md: 'block' } : 'block',
              }}
            >
              {tab.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
