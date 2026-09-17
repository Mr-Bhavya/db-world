import { Box, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { motion, useReducedMotion } from 'framer-motion';
import { useT } from '@shared/theme';
import { balanceColor, formatMoney } from '../utils/tallyFormat';
import { MemberAvatar } from './tallyFormUi';

/**
 * The transfers that would clear the group, and everybody's standing beneath them.
 *
 * <h2>Why the plan comes first</h2>
 * The page used to show a side-scrolling rail of per-member balance cards and nothing else.
 * Balances are the raw fact; the plan is the answer. Four people owing four different amounts is
 * a puzzle the reader has to solve — "so do I pay Rahul or does Rahul pay Jaykishan?" — and the
 * server already solves it. The rail also scrolled sideways, which hides content: a group of five
 * had two balances off the edge of a phone with nothing to say so.
 *
 * <p>Balances are kept underneath, vertically, because the plan is a suggestion and people do
 * check the underlying figures against it. Settled members sit at the bottom, dimmed — they are
 * part of the group and their absence would read as somebody having left.
 *
 * <p>Transfers involving the reader are marked, since a group of six produces a plan where most
 * legs are none of their business.
 */
export default function WhoPaysWhom({ members = [], plan = [], myMemberId, loading }) {
  const T = useT();
  const reduce = useReducedMotion();

  const active = members.filter((m) => m.status === 'ACTIVE');
  const owing = active
    .filter((m) => Number(m.balance ?? 0) !== 0)
    .sort((a, b) => Math.abs(Number(b.balance)) - Math.abs(Number(a.balance)));
  const square = active.filter((m) => Number(m.balance ?? 0) === 0);

  return (
    <Box>
      {(plan.length > 0 || loading) && (
        <Box sx={{ mb: 2.5 }}>
          <Label T={T}>Who pays whom</Label>
          <Box sx={{
            borderRadius: 3, border: `1px solid ${T.glassBorder}`, overflow: 'hidden',
            opacity: loading ? 0.5 : 1, transition: 'opacity .2s ease',
          }}>
            {plan.map((transfer, i) => {
              const involvesMe = transfer.fromMemberId === myMemberId
                || transfer.toMemberId === myMemberId;
              const iPay = transfer.fromMemberId === myMemberId;
              return (
                <Box
                  key={`${transfer.fromMemberId}-${transfer.toMemberId}`}
                  component={motion.div}
                  initial={reduce ? false : { opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: reduce ? 0 : Math.min(i * 0.05, 0.25) }}
                  sx={{
                    p: 1.5,
                    bgcolor: involvesMe ? T.tealBg : 'transparent',
                    borderBottom: i < plan.length - 1 ? `1px solid ${T.border}` : 'none',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.6 }}>
                    <MemberAvatar
                      member={{ id: transfer.fromMemberId, displayName: transfer.fromMemberName }}
                      size={24}
                    />
                    <ArrowForwardRoundedIcon sx={{ fontSize: 15, color: T.textFaint }} />
                    <MemberAvatar
                      member={{ id: transfer.toMemberId, displayName: transfer.toMemberName }}
                      size={24}
                    />
                    <Typography noWrap sx={{
                      fontSize: 12.5, ml: 0.25, minWidth: 0,
                      color: involvesMe ? T.textPrimary : T.textMuted,
                      fontWeight: involvesMe ? 700 : 400,
                    }}>
                      {iPay
                        ? `You pay ${transfer.toMemberName}`
                        : transfer.toMemberId === myMemberId
                          ? `${transfer.fromMemberName} pays you`
                          : `${transfer.fromMemberName} pays ${transfer.toMemberName}`}
                    </Typography>
                  </Box>
                  <Typography sx={{
                    fontSize: 16, fontWeight: 800, letterSpacing: -0.3,
                    color: involvesMe ? balanceColor(iPay ? -1 : 1, T) : T.textMuted,
                  }}>
                    {formatMoney(transfer.amount)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      <Label T={T}>Everyone</Label>
      <Box sx={{ borderRadius: 3, border: `1px solid ${T.glassBorder}`, overflow: 'hidden' }}>
        {[...owing, ...square].map((member, i, all) => {
          const balance = Number(member.balance ?? 0);
          const isMe = member.id === myMemberId;
          const settled = balance === 0;
          return (
            <Box
              key={member.id}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1.1,
                bgcolor: isMe ? T.tealBg : 'transparent',
                borderBottom: i < all.length - 1 ? `1px solid ${T.border}` : 'none',
              }}
            >
              <MemberAvatar member={member} size={26} dimmed={settled} />
              <Typography noWrap sx={{
                flex: 1, minWidth: 0, fontSize: 12.5,
                fontWeight: isMe ? 700 : 400,
                color: settled ? T.textFaint : T.textPrimary,
              }}>
                {isMe ? 'You' : member.displayName}
              </Typography>
              <Typography sx={{
                fontSize: settled ? 11.5 : 12.5, fontWeight: settled ? 400 : 800,
                color: settled ? T.textFaint : balanceColor(balance, T), whiteSpace: 'nowrap',
              }}>
                {settled
                  ? 'settled'
                  : `${balance > 0 ? '+' : '−'}${formatMoney(Math.abs(balance))}`}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function Label({ T, children }) {
  return (
    <Typography sx={{
      fontSize: 11, fontWeight: 800, letterSpacing: 0.7,
      textTransform: 'uppercase', color: T.textFaint, mb: 1,
    }}>
      {children}
    </Typography>
  );
}
