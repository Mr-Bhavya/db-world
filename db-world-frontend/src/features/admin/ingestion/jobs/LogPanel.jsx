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

export function LogPanel({
  logOpen,
  logLoading,
  logError,
  logHtml,
  onRefresh,
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
          bgcolor: isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.02)',
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            px: 1,
            py: 0.5,
            borderBottom: `1px solid ${alpha(T.text, 0.08)}`,
          }}
        >
          <Stack direction="row" spacing={0.65} alignItems="center">
            <Notes sx={{ fontSize: 15, color: 'text.secondary' }} />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: '0.72rem', fontWeight: 700 }}
            >
              Job Logs
            </Typography>
          </Stack>

          <Tooltip title="Refresh logs">
            <span>
              <IconButton
                size="small"
                aria-label="Refresh logs"
                sx={{ p: 0.45 }}
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

        {logLoading ? (
          <Box sx={{ px: 1.2, py: 1.1 }} aria-busy="true" aria-label="Loading logs">
            {[92, 78, 85, 60, 70].map((w, i) => (
              <Skeleton key={i} width={`${w}%`} height={14} />
            ))}
          </Box>
        ) : logError ? (
          <Box sx={{ py: 2.1, textAlign: 'center', px: 2 }}>
            <Typography variant="caption" color="error" sx={{ display: 'block', mb: 0.65 }}>
              Failed to load logs.
            </Typography>
            <Button size="small" onClick={onRefresh}>
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
              height: isSmDown ? 260 : 320,
              border: 'none',
              display: 'block',
            }}
            sandbox="allow-same-origin"
          />
        ) : (
          <Box sx={{ py: 2.1, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              No logs available yet.
            </Typography>
          </Box>
        )}
      </Paper>
    </Collapse>
  );
}
