import React from 'react';
import { Box, Typography } from '@mui/material';
import { ChevronRightRounded as OpenIcon } from '@mui/icons-material';

import { tallyGroupPath } from '@shared/constants';
import { useT } from '@shared/theme';
import { balanceColor, balanceTone, formatMoneyCompact } from '@features/tally/utils/tallyFormat';
import { clampTextSx } from '../../homeStyles';
import WidgetShell from '../WidgetShell';
import { SignedOutPanel, Stat, StatRow, WidgetFallback } from '../widgetParts';

/**
 * Tally's tile: whether anybody owes you, and which ledger to open first.
 *
 * <p>Led by the net figure rather than by a count, because "3 ledgers" is not a reason to open
 * anything and "you are owed 2,450" is. The wording and the colour both come from
 * {@code balanceTone}/{@code balanceColor}, the same helpers the app's own balance hero uses, so
 * the tile cannot describe a balance differently from the page it links to.
 *
 * <p>All square is a state of its own, not a ₹0.00 — zero is the good outcome here and reads badly
 * as a number, which is the same call {@code balanceTone} makes.
 */
export default function TallyWidget({
  widget,
  summary,
  isLoading,
  isAuthenticated,
  onSignIn,
  onNavigate,
  ...shell
}) {
  const T = useT();
  const tally = summary?.tally;

  // Nothing to count until there is an account: a ledger is shared with somebody by definition.
  if (!isAuthenticated) {
    return (
      <WidgetShell widget={widget} {...shell}>
        <SignedOutPanel
          widget={widget}
          onSignIn={onSignIn}
          blurb="Split a bill with anyone — even people who never sign up."
          pitch={['Settle up in one tap', 'Works without accounts', 'Every change logged']}
        />
      </WidgetShell>
    );
  }

  if (!tally && !isLoading) {
    return (
      <WidgetShell widget={widget} {...shell}>
        <WidgetFallback text={widget.description} />
      </WidgetShell>
    );
  }

  if (!isLoading && (tally?.ledgers ?? 0) === 0) {
    return (
      <WidgetShell widget={widget} {...shell}>
        <WidgetFallback text="No ledgers yet — start one with a person or a group and split the first bill." />
      </WidgetShell>
    );
  }

  const net = tally?.net ?? 0;
  const tone = balanceTone(net, { self: true });
  const colour = balanceColor(net, T);
  const top = tally?.top;
  const compact = widget.size === 'sm';

  return (
    <WidgetShell widget={widget} {...shell}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* The headline is the balance, not a count. `Stat` takes the already-formatted
              string: it is money, so it needs its symbol and its grouping. */}
          <StatRow>
            <Stat
              loading={isLoading}
              value={tone.amount ? formatMoneyCompact(Math.abs(net)) : 'All square'}
              label={tone.label}
              color={tone.amount ? colour : undefined}
              align={compact ? 'left' : 'center'}
              compact
            />
            {!compact && (
              <Stat
                loading={isLoading}
                value={tally?.ledgers ?? 0}
                label={(tally?.ledgers ?? 0) === 1 ? 'Ledger' : 'Ledgers'}
                compact
              />
            )}
          </StatRow>
        </Box>

        {/* One thing on the right: the ledger worth opening. Only when there IS one — with
            several outstanding, naming the biggest and hiding the rest would be a worse answer
            than the list on the page itself. */}
        {!isLoading && top && (
          <Box
            component={onNavigate ? 'button' : 'div'}
            type={onNavigate ? 'button' : undefined}
            onClick={onNavigate ? () => onNavigate(tallyGroupPath(top.id)) : undefined}
            sx={{
              flex: 1, minWidth: 0, textAlign: 'right',
              appearance: 'none', border: 'none', bgcolor: 'transparent', p: 0,
              font: 'inherit', color: 'inherit',
              cursor: onNavigate ? 'pointer' : 'default',
            }}
          >
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              gap: 0.25, minWidth: 0,
            }}>
              <Typography sx={{
                color: T.textPrimary,
                fontSize: { xs: '0.72rem', sm: '0.78rem' },
                fontWeight: 800,
                ...clampTextSx(1),
              }}>
                {top.name}
              </Typography>
              <OpenIcon sx={{ fontSize: 15, color: T.textMuted, flexShrink: 0 }} />
            </Box>
            <Typography
              sx={{ color: T.textMuted, fontSize: '0.68rem', fontWeight: 600, ...clampTextSx(1) }}
            >
              {balanceTone(top.balance).label.toLowerCase()} {formatMoneyCompact(Math.abs(Number(top.balance ?? 0)))}
            </Typography>
          </Box>
        )}

        {!isLoading && !top && (
          <Typography
            sx={{
              flex: 1, minWidth: 0, textAlign: 'right',
              color: T.textMuted, fontSize: '0.7rem', fontWeight: 600,
              ...clampTextSx(2),
            }}
          >
            Every ledger is settled.
          </Typography>
        )}
      </Box>
    </WidgetShell>
  );
}
