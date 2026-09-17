import { Box } from '@mui/material';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import { useT } from '@shared/theme';
import { avatarColor, groupIcon, initialsOf } from '../utils/tallyFormat';

const SIZES = {
  sm: { box: 32, radius: 2, glyph: 16, initials: 12 },
  md: { box: 40, radius: 2.5, glyph: 20, initials: 14 },
};

/**
 * How a ledger is depicted, decided in one place.
 *
 * <p>Three kinds, three treatments, because they are three different sorts of thing:
 *
 * <ul>
 *   <li><b>One-to-one</b> gets an <em>initials avatar</em>. This is the fix for a real problem —
 *       every direct ledger used to render the same handshake emoji, so three of them in a list
 *       were indistinguishable and you had to read the names to tell Rashmi from Jainaksh. A
 *       ledger with one other person in it <em>is</em> that person, and the app already draws
 *       people as initials on a colour derived from their id.</li>
 *   <li><b>A group</b> keeps its emoji. That was a deliberate choice: the server guesses one from
 *       the name, there is a picker for disagreeing with it, and it is stored as the emoji itself.
 *       Swapping it for an icon set would make the stored column meaningless.</li>
 *   <li><b>Your own spending</b> gets a wallet, because it is the one ledger with nobody on the
 *       other side and should not look like a group of one.</li>
 * </ul>
 *
 * <p>The tint comes from the id rather than the name, so renaming a group does not change its
 * colour and two ledgers that picked the same emoji still look different.
 */
export default function LedgerAvatar({ ledger, size = 'md' }) {
  const T = useT();
  const s = SIZES[size] ?? SIZES.md;

  if (ledger?.kind === 'PERSONAL') {
    return (
      <Box sx={{
        width: s.box, height: s.box, borderRadius: s.radius, flexShrink: 0,
        display: 'grid', placeItems: 'center',
        bgcolor: T.tealBg, border: `1px solid ${T.glassBorder}`,
      }}>
        <AccountBalanceWalletRoundedIcon sx={{ fontSize: s.glyph, color: T.teal }} />
      </Box>
    );
  }

  const tint = avatarColor(ledger?.id ?? '');

  if (ledger?.kind === 'DIRECT') {
    return (
      <Box
        aria-hidden="true"
        sx={{
          width: s.box, height: s.box, borderRadius: '50%', flexShrink: 0,
          display: 'grid', placeItems: 'center',
          fontSize: s.initials, fontWeight: 800, color: '#fff',
          bgcolor: tint,
        }}
      >
        {initialsOf(ledger?.name)}
      </Box>
    );
  }

  return (
    <Box sx={{
      width: s.box, height: s.box, borderRadius: s.radius, flexShrink: 0,
      display: 'grid', placeItems: 'center', fontSize: s.glyph,
      // The emoji carries the colour, so the tile only needs enough tint to sit it on.
      bgcolor: `${tint}1f`, border: `1px solid ${tint}40`,
    }}>
      {groupIcon(ledger)}
    </Box>
  );
}
