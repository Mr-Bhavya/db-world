import React from 'react';
import { Box, IconButton, Stack, Tooltip, Button } from '@mui/material';
import { ContentCopy, ExpandLess, ExpandMore } from '@mui/icons-material';
import JobActions from './JobActions';

export function BottomActions({
  logOpen,
  onToggleLogs,
  onCopyUrl,
  hasUri,
  job,
  compact,
  spread,
}) {
  const pillSx = {
    minWidth: 0,
    px: 0.9,
    py: 0.35,
    borderRadius: 999,
    textTransform: 'none',
    fontSize: '0.7rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  };
  const iconSx = { width: 40, height: 40, borderRadius: 2 };

  const utility = compact ? (
    <>
      <Tooltip title={logOpen ? 'Hide logs' : 'Logs'}>
        <IconButton size="small" onClick={onToggleLogs} sx={iconSx}
          aria-label={logOpen ? 'Hide logs' : 'Show logs'} aria-expanded={logOpen}>
          {logOpen ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
        </IconButton>
      </Tooltip>
      {hasUri ? (
        <Tooltip title="Copy source URL">
          <IconButton size="small" onClick={onCopyUrl} sx={iconSx} aria-label="Copy source URL">
            <ContentCopy sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      ) : null}
    </>
  ) : (
    <>
      <Button
        size="small"
        variant="text"
        startIcon={logOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        onClick={onToggleLogs}
        aria-expanded={logOpen}
        sx={pillSx}
      >
        {logOpen ? 'Hide Logs' : 'Logs'}
      </Button>
      {hasUri ? (
        <Button size="small" variant="text" startIcon={<ContentCopy fontSize="small" />} onClick={onCopyUrl} sx={pillSx}>
          Copy URL
        </Button>
      ) : null}
    </>
  );

  return (
    <Box
      sx={{
        overflowX: spread ? 'visible' : 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        pb: 0.1,
        mx: -0.15,
      }}
    >
      {/* Desktop spreads the row (view/copy on the left, job actions on the right); mobile keeps a
          single left-aligned scroll row. */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.45}
        sx={spread
          ? { width: '100%', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 0.5 }
          : { width: 'max-content', minWidth: '100%', flexWrap: 'nowrap' }}
      >
        <Stack direction="row" spacing={0.45} alignItems="center">
          {utility}
        </Stack>
        <JobActions job={job} layout="mobile" compactMobile={compact} />
      </Stack>
    </Box>
  );
}
