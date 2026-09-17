import { useState } from 'react';
import {
  Box, Typography, Button, IconButton, Menu, MenuItem, ListItemIcon, Divider,
  useMediaQuery, useTheme,
} from '@mui/material';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import PersonRemoveRoundedIcon from '@mui/icons-material/PersonRemoveRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import { formatMoney, balanceColor } from '../utils/tallyFormat';
import { TallyFormDialog, TallyCancelButton, MemberAvatar } from './tallyFormUi';

/**
 * The roster, and everything you can do to it.
 *
 * People who have left stay on the list, greyed out. They have to: their names are on the
 * expenses they were part of, and a roster that forgot them would turn old history into
 * "paid by (unknown)". Only the pickers filter them out.
 */
export default function MembersSheet({
  open, onClose, members = [], myMemberId, isOwner,
  onAdd, onRemove, onSetDelegation, onClearDelegation, onSetRole, onClaim,
}) {
  const T = useT();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [menuFor, setMenuFor] = useState(null);
  const [menuAt, setMenuAt] = useState(null);
  const [choosingPayerFor, setChoosingPayerFor] = useState(null);

  const active = members.filter((m) => m.status === 'ACTIVE');
  const departed = members.filter((m) => m.status !== 'ACTIVE');
  const nameOf = (id) => members.find((m) => m.id === id)?.displayName ?? 'someone';

  const closeMenu = () => { setMenuAt(null); setMenuFor(null); };

  // Depth one, enforced on the server and mirrored here so the menu never offers a move that
  // will be refused: somebody who already has a payer cannot become one.
  const eligiblePayers = (member) => active.filter(
    (m) => m.id !== member.id && !m.paidForByMemberId,
  );

  return (
    <TallyFormDialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      title="Who's in this group"
      subtitle={`${active.length} ${active.length === 1 ? 'person' : 'people'}`}
      actions={(
        <>
          <Button
            onClick={onAdd}
            startIcon={<PersonAddAlt1RoundedIcon />}
            sx={{
              textTransform: 'none', fontWeight: 700, fontSize: 13.5,
              borderRadius: 2.5, color: T.teal, mr: 'auto',
            }}
          >
            Add somebody
          </Button>
          <TallyCancelButton onClick={onClose}>Done</TallyCancelButton>
        </>
      )}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {active.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            isMe={member.id === myMemberId}
            payerName={member.paidForByMemberId ? nameOf(member.paidForByMemberId) : null}
            onMenu={(el) => { setMenuAt(el); setMenuFor(member); }}
          />
        ))}
      </Box>

      {departed.length > 0 && (
        <>
          <Divider sx={{ borderColor: T.border, my: 0.5 }} />
          <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: T.textMuted }}>
            NO LONGER IN THIS GROUP
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {departed.map((member) => (
              <MemberRow key={member.id} member={member} departed />
            ))}
          </Box>
          <Typography sx={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.5 }}>
            They stay here so their name still reads correctly on the expenses they were part of.
          </Typography>
        </>
      )}

      {/* ── Per-member actions ─────────────────────────────────────────── */}
      <Menu
        anchorEl={menuAt}
        open={Boolean(menuAt) && !choosingPayerFor}
        onClose={closeMenu}
        slotProps={{
          paper: {
            sx: {
              bgcolor: T.bg, backgroundImage: 'none', borderRadius: 2.5,
              border: `1px solid ${T.glassBorder}`, minWidth: 230,
            },
          },
        }}
      >
        {menuFor?.ghost && (
          <MenuItem
            onClick={() => { onClaim(menuFor); closeMenu(); }}
            sx={{ fontSize: 14, color: T.textPrimary }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <HowToRegRoundedIcon sx={{ fontSize: 18, color: T.teal }} />
            </ListItemIcon>
            This is me
          </MenuItem>
        )}

        {menuFor?.paidForByMemberId ? (
          <MenuItem
            onClick={() => { onClearDelegation(menuFor); closeMenu(); }}
            sx={{ fontSize: 14, color: T.textPrimary }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <UndoRoundedIcon sx={{ fontSize: 18, color: T.textMuted }} />
            </ListItemIcon>
            They pay for themselves
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => setChoosingPayerFor(menuFor)}
            disabled={eligiblePayers(menuFor ?? {}).length === 0}
            sx={{ fontSize: 14, color: T.textPrimary }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <PaymentsRoundedIcon sx={{ fontSize: 18, color: T.textMuted }} />
            </ListItemIcon>
            Somebody else pays for them
          </MenuItem>
        )}

        {isOwner && (
          <MenuItem
            onClick={() => { onSetRole(menuFor, menuFor.role === 'OWNER' ? 'MEMBER' : 'OWNER'); closeMenu(); }}
            sx={{ fontSize: 14, color: T.textPrimary }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <ShieldRoundedIcon sx={{ fontSize: 18, color: T.textMuted }} />
            </ListItemIcon>
            {menuFor?.role === 'OWNER' ? 'Remove owner rights' : 'Make an owner'}
          </MenuItem>
        )}

        <MenuItem
          onClick={() => { onRemove(menuFor); closeMenu(); }}
          sx={{ fontSize: 14, color: '#ef4444' }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <PersonRemoveRoundedIcon sx={{ fontSize: 18, color: '#ef4444' }} />
          </ListItemIcon>
          {menuFor?.id === myMemberId ? 'Leave the group' : 'Remove from group'}
        </MenuItem>
      </Menu>

      {/* ── Choosing who pays for somebody ─────────────────────────────── */}
      <Menu
        anchorEl={menuAt}
        open={Boolean(choosingPayerFor)}
        onClose={() => { setChoosingPayerFor(null); closeMenu(); }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: T.bg, backgroundImage: 'none', borderRadius: 2.5,
              border: `1px solid ${T.glassBorder}`, minWidth: 230,
            },
          },
        }}
      >
        <Typography sx={{ px: 2, py: 1, fontSize: 11.5, fontWeight: 800, color: T.textMuted }}>
          WHO PAYS FOR {choosingPayerFor?.displayName?.toUpperCase()}?
        </Typography>
        {eligiblePayers(choosingPayerFor ?? {}).map((candidate) => (
          <MenuItem
            key={candidate.id}
            onClick={() => {
              onSetDelegation(choosingPayerFor, candidate.id);
              setChoosingPayerFor(null); closeMenu();
            }}
            sx={{ fontSize: 14, color: T.textPrimary, gap: 1.25 }}
          >
            <MemberAvatar member={candidate} size={26} />
            {candidate.displayName}
          </MenuItem>
        ))}
      </Menu>
    </TallyFormDialog>
  );
}

function MemberRow({ member, isMe, payerName, departed, onMenu }) {
  const T = useT();
  const balance = Number(member.balance ?? 0);

  return (
    <Box
      component={motion.div}
      whileTap={onMenu ? { scale: 0.995 } : undefined}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25,
        px: 1, py: 1, borderRadius: 2.5,
        opacity: departed ? 0.55 : 1,
        '&:hover': { bgcolor: T.glassHover },
      }}
    >
      <MemberAvatar member={member} size={36} dimmed={departed} />

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <Typography noWrap sx={{ fontSize: 14.5, fontWeight: 700, color: T.textPrimary }}>
            {isMe ? 'You' : member.displayName}
          </Typography>
          {member.role === 'OWNER' && (
            <ShieldRoundedIcon sx={{ fontSize: 13, color: T.teal }} titleAccess="Owner" />
          )}
          {member.ghost && !departed && (
            <Box sx={{
              px: 0.7, py: 0.1, borderRadius: 999, fontSize: 9.5, fontWeight: 800,
              bgcolor: T.glass, color: T.textMuted, border: `1px solid ${T.border}`,
            }}>
              NO ACCOUNT
            </Box>
          )}
        </Box>
        <Typography noWrap sx={{ fontSize: 11.5, color: T.textMuted }}>
          {departed ? 'Left the group'
            : payerName ? `${payerName} pays for them`
              : balance === 0 ? 'Settled up'
                : balance > 0 ? `Is owed ${formatMoney(balance)}`
                  : `Owes ${formatMoney(-balance)}`}
        </Typography>
      </Box>

      {!departed && balance !== 0 && (
        <Typography sx={{
          fontSize: 13.5, fontWeight: 800, flexShrink: 0,
          color: balanceColor(balance, T),
        }}>
          {formatMoney(Math.abs(balance))}
        </Typography>
      )}

      {onMenu && (
        <IconButton
          size="small"
          aria-label={`Options for ${member.displayName}`}
          onClick={(e) => onMenu(e.currentTarget)}
          sx={{ color: T.textMuted, flexShrink: 0 }}
        >
          <MoreVertRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      )}
    </Box>
  );
}
