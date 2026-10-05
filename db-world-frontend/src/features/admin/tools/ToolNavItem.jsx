import React from 'react';
import { Box, ListItemButton, ListItemIcon, ListItemText, Tooltip } from '@mui/material';
import { OpenInNewRounded } from '@mui/icons-material';
import { useT } from '@shared/theme';

/** Colour for a doctor status, from the CURRENT theme tokens. */
function dotColor(T, status) {
  switch (status) {
    case 'ok':   return T.success;
    case 'warn': return T.warning;
    case 'fail': return T.error;
    default:     return T.textFaint;
  }
}

export function ToolStatusDot({ indicator, size = 7, sx }) {
  const T = useT();
  if (!indicator) return null;
  return (
    <Box
      component="span"
      aria-label={indicator.text}
      sx={{ display: 'inline-block', flexShrink: 0, width: size, height: size, borderRadius: '50%', bgcolor: dotColor(T, indicator.status), ...sx }}
    />
  );
}

/**
 * A sidebar entry for a tool outside the app (the Tools section): a real link that opens in
 * a new tab, never "active", with the tool's status dot. `showFull` is the sidebar's open
 * state: the collapsed sidebar shows only the icon, with the details in its tooltip.
 */
export default function ToolNavItem({ item, showFull, indicator }) {
  const T = useT();
  const Icon = item.icon;
  const hint = [item.title, indicator?.text, 'opens in a new tab'].filter(Boolean).join(' · ');
  const linkProps = { component: 'a', href: item.href, target: '_blank', rel: 'noopener noreferrer' };

  if (!showFull) {
    return (
      <Tooltip title={`${item.label}: ${hint}`} placement="right" arrow>
        <ListItemButton
          {...linkProps}
          sx={{
            position: 'relative', borderRadius: 1.5, mb: 0.3, py: 0.9, px: 0, justifyContent: 'center',
            color: T.textMuted, '&:hover': { bgcolor: T.hoverBg, color: T.teal },
          }}
        >
          <Icon sx={{ fontSize: 20 }} />
          <ToolStatusDot indicator={indicator} sx={{ position: 'absolute', top: 7, right: 9 }} />
        </ListItemButton>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={hint} placement="right" enterDelay={600}>
      <ListItemButton
        {...linkProps}
        sx={{
          borderRadius: 1.5, mb: 0.3, py: 0.9, px: 1.5, color: T.textMuted,
          borderLeft: '3px solid transparent', transition: 'all 0.15s',
          '&:hover': { bgcolor: T.hoverBg, color: T.text },
          '&:hover .tool-open': { opacity: 1 },
        }}
      >
        <ListItemIcon sx={{ minWidth: 34, color: T.textMuted }}>
          <Icon sx={{ fontSize: 18 }} />
        </ListItemIcon>
        <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.82rem', color: T.textMuted }} />
        <ToolStatusDot indicator={indicator} sx={{ mr: 0.75 }} />
        <OpenInNewRounded className="tool-open" sx={{ fontSize: 13, color: T.textFaint, opacity: 0.55, transition: 'opacity .15s' }} />
      </ListItemButton>
    </Tooltip>
  );
}
