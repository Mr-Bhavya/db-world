import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  ErrorOutline as ExpiredIcon,
  EventBusy as ExpiringIcon,
} from '@mui/icons-material';

import { useT } from '@shared/theme';
import { clampTextSx } from '../../homeStyles';
import WidgetShell from '../WidgetShell';
import { SignedOutPanel, Stat, StatRow, WidgetFallback } from '../widgetParts';

const expiryLabel = (daysLeft) => {
  if (daysLeft == null) return null;
  if (daysLeft <= 0) return 'expires today';
  if (daysLeft === 1) return 'expires tomorrow';
  if (daysLeft < 31) return `expires in ${daysLeft} days`;
  if (daysLeft < 365) return `expires in ${Math.round(daysLeft / 30)} months`;
  return `expires in ${Math.floor(daysLeft / 365)}+ years`;
};

/**
 * Wallet's tile, built around expiry — the only thing about a stored document that changes on its
 * own, and the only reason to look at this app when you are not actively fetching a document.
 *
 * Figures on the left, the one thing that needs attention on the right. Stacked instead, the three
 * figures plus a lapsed warning plus the next renewal ran to 100px inside a 71px tile on a phone
 * and the last line was cut off; side by side the tile uses the width it has.
 *
 * The document's label is shown, never its number: the hub is a page that sits open on a desk.
 */
export default function WalletWidget({
  widget,
  summary,
  isLoading,
  isAuthenticated,
  onSignIn,
  ...shell
}) {
  const T = useT();
  const wallet = summary?.wallet;

  // Signed out there are no documents to count, so the tile makes the case for having some
  // instead of showing an empty shell.
  if (!isAuthenticated) {
    return (
      <WidgetShell widget={widget} {...shell}>
        <SignedOutPanel
          widget={widget}
          onSignIn={onSignIn}
          blurb="Keep Aadhaar, PAN, licence and passport encrypted — and never miss a renewal."
          pitch={['Expiry reminders', 'Encrypted at rest', 'Share a time-limited link']}
        />
      </WidgetShell>
    );
  }

  if (!wallet && !isLoading) {
    return (
      <WidgetShell widget={widget} {...shell}>
        <WidgetFallback text={widget.description} />
      </WidgetShell>
    );
  }

  const expiring = wallet?.expiringSoon ?? 0;
  const expired = wallet?.expired ?? 0;
  const next = wallet?.next;

  if (!isLoading && (wallet?.total ?? 0) === 0) {
    return (
      <WidgetShell widget={widget} {...shell}>
        <WidgetFallback text="Nothing stored yet — add Aadhaar, PAN or a licence to keep them encrypted and handy." />
      </WidgetShell>
    );
  }

  const compact = widget.size === 'sm';

  // One thing on the right, chosen by urgency: something already lapsed beats something merely
  // due, and either beats a reassurance that nothing needs doing.
  const attention = expired > 0
    ? {
        icon: ExpiredIcon,
        colour: T.error,
        title: `${expired} lapsed`,
        detail: expired === 1 ? 'needs renewing' : 'need renewing',
      }
    : next
      ? { icon: ExpiringIcon, colour: T.textMuted, title: next.label, detail: expiryLabel(next.daysLeft) }
      : null;

  return (
    <WidgetShell widget={widget} {...shell}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <StatRow>
            <Stat
              loading={isLoading}
              value={wallet?.total ?? 0}
              label="Documents"
              align={compact ? 'left' : 'center'}
              compact
            />
            {!compact && (
              <Stat
                loading={isLoading}
                value={expiring}
                label="Expiring"
                color={expiring > 0 ? '#f59e0b' : undefined}
                compact
              />
            )}
            {!compact && expired > 0 && (
              <Stat loading={isLoading} value={expired} label="Expired" color={T.error} compact />
            )}
          </StatRow>
        </Box>

        {!isLoading && attention && (
          <Box sx={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 0.5,
                minWidth: 0,
              }}
            >
              <attention.icon sx={{ fontSize: 14, color: attention.colour, flexShrink: 0 }} />
              <Typography
                sx={{
                  color: expired > 0 ? T.error : T.textPrimary,
                  fontSize: { xs: '0.72rem', sm: '0.78rem' },
                  fontWeight: 800,
                  ...clampTextSx(1),
                }}
              >
                {attention.title}
              </Typography>
            </Box>

            <Typography
              sx={{ color: T.textMuted, fontSize: '0.68rem', fontWeight: 600, ...clampTextSx(1) }}
            >
              {attention.detail}
            </Typography>
          </Box>
        )}

        {!isLoading && !attention && (
          <Typography
            sx={{
              flex: 1,
              minWidth: 0,
              textAlign: 'right',
              color: T.textMuted,
              fontSize: '0.7rem',
              fontWeight: 600,
              ...clampTextSx(2),
            }}
          >
            Nothing expiring in the next month.
          </Typography>
        )}
      </Box>
    </WidgetShell>
  );
}
