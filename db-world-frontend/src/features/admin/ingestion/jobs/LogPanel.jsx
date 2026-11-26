import React from 'react';
import {
  alpha,
  Box,
  CircularProgress,
  Collapse,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  Button,
} from '@mui/material';
import { Refresh, Notes } from '@mui/icons-material';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';

export function LogPanel({
  logOpen,
  logLoading,
  logError,
  logHtml,
  onRefresh,
  onExpand,
  isDark,
  T,
  isSmDown,
}) {
  return (
    <Collapse in={logOpen} unmountOnExit>
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          mt: 0.8,
          borderRadius: 2.5,
          overflow: 'hidden',
          borderColor: alpha(T.border, 0.9),
          bgcolor: isDark ? 'rgba(3,7,18,0.35)' : 'rgba(248,250,252,0.72)',
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            px: 1.15,
            py: 0.7,
            borderBottom: `1px solid ${alpha(T.text, 0.08)}`,
          }}
        >
          <Stack direction="row" spacing={0.75} alignItems="center" minWidth={0}>
            <Box sx={{
              width: 26, height: 26, display: 'grid', placeItems: 'center',
              borderRadius: 1.5, bgcolor: alpha(T.teal, 0.1), color: T.teal,
            }}>
              <Notes sx={{ fontSize: 15 }} />
            </Box>
            <Box minWidth={0}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: T.text, lineHeight: 1.2 }}>
                Execution log
              </Typography>
              <Typography sx={{ fontSize: 10, color: T.textFaint, lineHeight: 1.3 }}>
                HTML job report
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={0.25}>
            <Tooltip title="Open full log viewer">
              <IconButton size="small" aria-label="Open full log viewer" onClick={onExpand}>
                <OpenInFullIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh logs">
              <span>
                <IconButton
                  size="small"
                  aria-label="Refresh logs"
                  disabled={logLoading}
                  onClick={onRefresh}
                >
                  {logLoading ? (
                    <CircularProgress size={13} />
                  ) : (
                    <Refresh sx={{ fontSize: 15 }} />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {logLoading ? (
          <Box sx={{ px: 1.2, py: 1.1 }} aria-busy="true" aria-label="Loading logs">
            {[92, 78, 85, 60, 70].map((w, i) => (
              <Skeleton key={i} width={`${w}%`} height={14} />
            ))}
          </Box>
        ) : logError ? (
          <Box sx={{ py: 2.1, textAlign: 'center', px: 2 }}>
            <Typography variant="caption" color="error" sx={{ display: 'block', mb: 0.65, fontWeight: 700 }}>
              Failed to load logs.
            </Typography>
            <Button size="small" variant="outlined" onClick={onRefresh}>
              Retry
            </Button>
          </Box>
        ) : logHtml ? (
          <iframe
            key={isDark ? 'dark' : 'light'}
            srcDoc={logHtml}
            title="Job logs"
            style={{
              width: '100%',
              height: isSmDown ? 300 : 360,
              border: 'none',
              display: 'block',
            }}
            sandbox="allow-same-origin"
          />
        ) : (
          <Box sx={{ py: 3, px: 2, textAlign: 'center' }}>
            <Notes sx={{ fontSize: 24, color: T.textFaint, mb: 0.5 }} />
            <Typography sx={{ fontSize: 12, color: T.textMuted, fontWeight: 700 }}>
              No log events yet
            </Typography>
            <Typography sx={{ fontSize: 10, color: T.textFaint }}>
              Refresh after the job advances to the next step.
            </Typography>
          </Box>
        )}
      </Paper>
    </Collapse>
  );
}
