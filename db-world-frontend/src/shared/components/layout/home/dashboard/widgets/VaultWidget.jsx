import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  AddRounded as AddIcon,
  AutoAwesomeRounded as GenerateIcon,
  LockOutlined as LockIcon,
} from '@mui/icons-material';

import Constants from '@shared/constants';
import { useT } from '@shared/theme';
import { clampTextSx } from '../../homeStyles';
import WidgetShell from '../WidgetShell';
import { SignedOutPanel, Stat, WidgetFallback } from '../widgetParts';

/**
 * The two things anyone actually comes to a password manager to do.
 *
 * Deliberately not a third "view" shortcut: opening the list is what the tile itself already does,
 * so that button would spend space to duplicate the card's own tap target.
 */
const ACTIONS = [
  { label: 'Add', Icon: AddIcon, route: Constants.DB_ADD_PASSWORD_ROUTE },
  { label: 'Generate', Icon: GenerateIcon, route: Constants.DB_GENERATE_PASSWORD_ROUTE },
];

function QuickAction({ action, accent, onNavigate }) {
  const T = useT();
  const { Icon } = action;

  return (
    <Box
      component="button"
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onNavigate?.(action.route);
      }}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.1,
        height: 30,
        flexShrink: 0,
        borderRadius: 1.8,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: '0.74rem',
        fontWeight: 800,
        color: T.textMuted,
        bgcolor: T.glass,
        border: `1px solid ${T.glassBorder}`,
        transition: 'color 0.2s ease, border-color 0.2s ease',
        '&:hover': { color: accent, borderColor: `${accent}88` },
        '&:focus-visible': { outline: `2px solid ${accent}`, outlineOffset: 2 },
      }}
    >
      <Icon sx={{ fontSize: 15 }} />
      {action.label}
    </Box>
  );
}

/**
 * Vault's tile.
 *
 * Counts only, deliberately. A strength or reuse figure would make a better widget, but computing
 * one means decrypting every credential — on a page that is public, sits open on a desk, and is
 * the first thing a shoulder-surfer sees. That analysis belongs inside the vault, behind the app
 * lock, where it already lives.
 *
 * Signed in, the tile carries shortcuts into the two jobs worth one tap; signed out it makes the
 * case for having a vault at all. A count sitting alone on the left of a wide tile was the one
 * arrangement that served neither.
 */
export default function VaultWidget({
  widget,
  summary,
  isLoading,
  isAuthenticated,
  onSignIn,
  onNavigate,
  ...shell
}) {
  const T = useT();
  const vault = summary?.vault;

  if (!isAuthenticated) {
    return (
      <WidgetShell widget={widget} {...shell}>
        <SignedOutPanel
          widget={widget}
          onSignIn={onSignIn}
          blurb="An AES-256 password manager where only you hold the key."
          pitch={['Works offline', 'Strength checks', 'Built-in generator']}
        />
      </WidgetShell>
    );
  }

  if (!vault && !isLoading) {
    return (
      <WidgetShell widget={widget} {...shell}>
        <WidgetFallback text={widget.description} />
      </WidgetShell>
    );
  }

  const total = vault?.total ?? 0;
  const empty = !isLoading && total === 0;
  // A small tile has room for the figure and nothing else.
  const showActions = widget.size !== 'sm';

  return (
    <WidgetShell widget={widget} {...shell}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <Box sx={{ minWidth: 0 }}>
          {empty ? (
            <Typography
              sx={{
                color: T.textMuted,
                fontSize: { xs: '0.72rem', sm: '0.78rem' },
                lineHeight: 1.45,
                ...clampTextSx(2),
              }}
            >
              Nothing saved yet — add your first credential.
            </Typography>
          ) : (
            <Stat
              loading={isLoading}
              value={total}
              label="Saved"
              align="left"
              color={widget.accent}
              compact
            />
          )}

          {!isLoading && !empty && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75, minWidth: 0 }}>
              <LockIcon sx={{ fontSize: 13, color: T.textFaint, flexShrink: 0 }} />
              <Typography sx={{ color: T.textFaint, fontSize: '0.68rem', fontWeight: 600 }}>
                AES-256
              </Typography>
            </Box>
          )}
        </Box>

        {!isLoading && showActions && (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              gap: 0.75,
              ml: 'auto',
              minWidth: 0,
            }}
          >
            {ACTIONS.map((action) => (
              <QuickAction
                key={action.label}
                action={action}
                accent={widget.accent}
                onNavigate={onNavigate}
              />
            ))}
          </Box>
        )}
      </Box>
    </WidgetShell>
  );
}
