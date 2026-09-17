import { Box, Typography, Button, CircularProgress, useMediaQuery, useTheme } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import { formatMoney, initialsOf, avatarColor } from '../utils/tallyFormat';
import { TallyFormDialog, TallyCancelButton } from './tallyFormUi';

/**
 * The shortest set of payments that would clear the group.
 *
 * <b>Advice, and it says so.</b> Nothing here writes anything — tapping a row opens the normal
 * record-a-payment form with the numbers filled in. That distinction is the reason the true
 * pairwise debts survive underneath: Splitwise rewrites who owes whom to shorten the list, and
 * then tells you to settle up with somebody you have never borrowed from.
 *
 * Greedy rather than optimal, because minimising transfers is NP-hard. It needs at most one
 * fewer transfer than there are people, which in a family group is two or three payments.
 */
export default function SettleUpSheet({
  open, onClose, plan = [], loading, onRecord, onRecordCustom, myMemberId,
}) {
  const T = useT();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <TallyFormDialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth="xs"
      title="Settle up"
      subtitle={plan.length ? 'Suggested payments — nothing happens until you record one' : undefined}
      actions={(
        <>
          <Button
            onClick={onRecordCustom}
            startIcon={<AddRoundedIcon />}
            sx={{
              textTransform: 'none', fontWeight: 700, fontSize: 13.5,
              borderRadius: 2.5, color: T.teal, mr: 'auto',
            }}
          >
            Something else
          </Button>
          <TallyCancelButton onClick={onClose}>Close</TallyCancelButton>
        </>
      )}
    >
      {loading && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
          <CircularProgress size={22} sx={{ color: T.teal }} />
        </Box>
      )}

      {!loading && plan.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <CheckCircleRoundedIcon sx={{ fontSize: 40, color: T.teal, mb: 1 }} />
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: T.textPrimary }}>
            Nothing to settle
          </Typography>
          <Typography sx={{ fontSize: 13, color: T.textMuted, mt: 0.5 }}>
            Everyone in this group is square.
          </Typography>
        </Box>
      )}

      {!loading && plan.map((transfer, i) => {
        const mine = transfer.fromMemberId === myMemberId || transfer.toMemberId === myMemberId;
        return (
          <Box
            key={`${transfer.fromMemberId}-${transfer.toMemberId}-${i}`}
            component={motion.div}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: Math.min(i * 0.06, 0.3) }}
            sx={{
              display: 'flex', alignItems: 'center',
              // Two lines on a phone, one from sm up.
              //
              // As a single row this collided. Both name bubbles are flexShrink: 0 with up to
              // 72px of name each, plus an arrow, the gaps, and the Record button -- about 350px
              // of content that cannot shrink, on a 360px screen. The only flexible item was the
              // amount, so a figure like 65,000.00 was squeezed into whatever was left and ran
              // straight over its neighbours. Wrapping gives the names the top line and the
              // amount its own, instead of asking four fixed things to fit in three things' room.
              flexWrap: { xs: 'wrap', sm: 'nowrap' },
              rowGap: 1, columnGap: 1.25,
              p: 1.25, borderRadius: 3,
              // The rows involving you are the ones you can act on, so they are the ones that
              // stand out. The rest are context.
              bgcolor: mine ? T.tealBg : T.glass,
              border: `1px solid ${mine ? T.glassBorderHover : T.border}`,
            }}
          >
            <NameBubble id={transfer.fromMemberId} name={transfer.fromMemberName} />
            <ArrowForwardRoundedIcon sx={{ fontSize: 16, color: T.textMuted, flexShrink: 0 }} />
            <NameBubble id={transfer.toMemberId} name={transfer.toMemberName} />

            {/* Forces the break on a phone: the names take the first line and this row of
                amount-plus-button takes the second. From sm it collapses back into the flow. */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1.25,
              flex: { xs: '1 0 100%', sm: '1 1 auto' }, minWidth: 0,
              justifyContent: 'flex-end',
            }}>
              <Typography noWrap sx={{
                fontSize: 15, fontWeight: 800, color: T.textPrimary,
                flex: 1, minWidth: 0, textAlign: 'right',
              }}>
                {formatMoney(transfer.amount)}
              </Typography>

              <Button
                size="small"
                onClick={() => onRecord(transfer)}
                variant={mine ? 'contained' : 'text'}
                disableElevation
                sx={{
                  textTransform: 'none', fontWeight: 700, fontSize: 12.5,
                  borderRadius: 2, flexShrink: 0, minWidth: 0, px: 1.5,
                  ...(mine
                    ? { bgcolor: T.teal, color: '#fff', '&:hover': { bgcolor: T.tealHover } }
                    : { color: T.teal }),
                }}
              >
                Record
              </Button>
            </Box>
          </Box>
        );
      })}

      {!loading && plan.length > 0 && (
        <Typography sx={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.55 }}>
          These are suggestions, not instructions. Pay whatever actually suits — a part payment
          still counts, and the balances will catch up.
        </Typography>
      )}
    </TallyFormDialog>
  );
}

function NameBubble({ id, name }) {
  const T = useT();
  const tint = avatarColor(id ?? '');
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0, flexShrink: 1 }}>
      <Box sx={{
        width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
        fontSize: 10.5, fontWeight: 800, flexShrink: 0,
        bgcolor: `${tint}22`, color: tint, border: `1px solid ${tint}55`,
      }}>
        {initialsOf(name)}
      </Box>
      {/* Truncates rather than pushing the row wider -- a long name is the other half of why
          this overflowed. */}
      <Typography noWrap sx={{
        fontSize: 12.5, fontWeight: 600, color: T.textPrimary,
        maxWidth: { xs: 96, sm: 72 }, minWidth: 0,
      }}>
        {name}
      </Typography>
    </Box>
  );
}
