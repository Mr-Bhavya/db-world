import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import { MemberAvatar } from './tallyFormUi';

/** More than this and the row is wider than the name it sits beside. */
const SHOWN = 4;

/**
 * Who is in this group, in the header, as overlapping avatars.
 *
 * <p>Replaces an icon button that opened a sheet. "Who is in here" is a question you answer by
 * looking, not by tapping — and a group's members are most of what distinguishes one group from
 * another in the first place. The row is still the way into the sheet, so nothing is lost; it
 * just answers the common case without the trip.
 *
 * <p>Overlapped rather than spaced, so five people cost about the width of three. Past four it
 * counts the rest instead, because the point is a sense of who, not a roll call.
 *
 * <p>Departed members are left out. They keep appearing on the expenses they were part of —
 * that history is real — but "who is in this group" is the present tense.
 */
export default function MemberAvatarRow({ members = [], onOpen }) {
  const T = useT();

  const active = members.filter((m) => m.status === 'ACTIVE');
  if (!active.length) return null;

  const shown = active.slice(0, SHOWN);
  const rest = active.length - shown.length;

  return (
    <Box
      component={motion.button}
      type="button"
      whileTap={{ scale: 0.96 }}
      onClick={onOpen}
      aria-label={`${active.length} people in this group`}
      sx={{
        display: 'flex', alignItems: 'center', flexShrink: 0,
        p: 0.5, borderRadius: 999, cursor: 'pointer',
        bgcolor: 'transparent', border: 'none', fontFamily: 'inherit',
        transition: 'background-color .18s ease',
        '&:hover': { bgcolor: T.glass },
        '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
      }}
    >
      {shown.map((member, i) => (
        <Box key={member.id} sx={{
          ml: i === 0 ? 0 : '-9px',
          // A ring in the page colour is what separates one avatar from the one behind it.
          borderRadius: '50%', border: `2px solid ${T.bg}`, display: 'grid',
        }}>
          <MemberAvatar member={member} size={26} />
        </Box>
      ))}

      {rest > 0 && (
        <Box sx={{
          ml: '-9px', width: 30, height: 30, borderRadius: '50%',
          display: 'grid', placeItems: 'center',
          bgcolor: T.glass, border: `2px solid ${T.bg}`,
        }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: T.textMuted }}>
            +{rest}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
