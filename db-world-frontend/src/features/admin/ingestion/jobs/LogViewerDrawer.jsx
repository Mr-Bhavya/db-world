import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  alpha,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Slide,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useT } from '@shared/theme';
import {
  Close,
  Download,
  Notes,
  OpenInFull,
  Refresh,
} from '@mui/icons-material';
import { getJobReport } from '../services/ingestionApi';

// ─────────────────────────────────────────────────────────────────────────────
// Transition
// ─────────────────────────────────────────────────────────────────────────────

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// ─────────────────────────────────────────────────────────────────────────────
// Theme-aware HTML injection
// ─────────────────────────────────────────────────────────────────────────────

function injectTheme(html, isDark) {
  const bg = isDark ? '#111827' : '#ffffff';
  const fg = isDark ? '#d1d5db' : '#111827';

  const css = `
    html, body {
      background: ${bg} !important;
      color: ${fg} !important;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 12px;
      margin: 0;
      padding: 10px;
      word-break: break-word;
    }
    pre, code { white-space: pre-wrap; }
    a { color: ${isDark ? '#60a5fa' : '#2563eb'} !important; }
    *[style*="color:red"], *[style*="color:#"], .error, .fail, .FAIL, .FAILED {
      color: #f87171 !important;
    }
    .success, .ok, .SUCCESS { color: #4ade80 !important; }
    .warn, .warning, .WARN { color: #fbbf24 !important; }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    td, th {
      padding: 4px 7px;
      border: 1px solid ${isDark ? '#374151' : '#d1d5db'};
    }
  `;

  const styleTag = `<style>${css}</style>`;

  if (html.includes('</head>')) return html.replace('</head>', `${styleTag}</head>`);
  if (html.includes('<head>')) return html.replace('<head>', `<head>${styleTag}`);
  return `<html><head>${styleTag}</head><body>${html}</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

function LogViewerDrawerComponent({ jobId, open, onClose }) {
  const T = useT();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const iframeRef = useRef(null);

  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const themedHtml = useMemo(() => {
    if (!html || typeof html !== 'string') return '';
    return injectTheme(html, isDark);
  }, [html, isDark]);

  const fetchReport = useCallback(async () => {
    if (!jobId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await getJobReport(jobId);
      setHtml(typeof res?.data === 'string' ? res.data : '');
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to load report');
      setHtml('');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (open && jobId) {
      fetchReport();
    }
  }, [open, jobId, fetchReport]);

  const downloadHtml = useCallback(() => {
    if (!html || !jobId) return;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `job-${jobId}.html`;
    a.click();

    URL.revokeObjectURL(url);
  }, [html, jobId]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="xl"
      TransitionComponent={Transition}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: '92vw', lg: '88vw' },
          maxWidth: { xs: '100%', sm: 1100, xl: 1360 },
          height: { xs: '100%', sm: '88vh' },
          borderRadius: { xs: 0, sm: 4 },
          overflow: 'hidden',
          background:
            theme.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)'
              : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)',
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 18px 50px rgba(0,0,0,0.45)'
              : '0 18px 50px rgba(15,23,42,0.16)',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          px: { xs: 1.5, sm: 2.25 },
          py: 1.35,
          borderBottom: `1px solid ${alpha(T.border, 0.95)}`,
          bgcolor: alpha(theme.palette.background.paper, 0.75),
          backdropFilter: 'blur(12px)',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1.1} alignItems="center" minWidth={0}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2.25,
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                color: 'primary.main',
                flexShrink: 0,
              }}
            >
              <Notes sx={{ fontSize: 19 }} />
            </Box>

            <Box minWidth={0}>
              <Typography variant="subtitle1" fontWeight={800}>
                Job Logs
              </Typography>
              <Typography variant="caption" color="text.secondary">
                HTML execution report viewer
              </Typography>
            </Box>
          </Stack>

          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
          >
            {jobId ? (
              <Chip
                label={`${jobId.slice(0, 8)}…`}
                size="small"
                variant="outlined"
                sx={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  borderRadius: 999,
                }}
              />
            ) : null}

            {!isMobile ? (
              <Chip
                icon={<OpenInFull sx={{ fontSize: '14px !important' }} />}
                label="Large viewer"
                size="small"
                variant="outlined"
                sx={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  borderRadius: 999,
                }}
              />
            ) : null}

            <Tooltip title="Refresh">
              <span>
                <IconButton size="small" onClick={fetchReport} disabled={loading}>
                  {loading ? <CircularProgress size={16} /> : <Refresh fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>

            {html ? (
              <Tooltip title="Download HTML report">
                <IconButton size="small" onClick={downloadHtml}>
                  <Download fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}

            <Tooltip title="Close">
              <IconButton size="small" onClick={onClose}>
                <Close fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </DialogTitle>

      {/* Content */}
      <DialogContent
        sx={{
          p: { xs: 1.25, sm: 1.5 },
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {loading ? (
          <Paper
            variant="outlined"
            sx={{
              flex: 1,
              borderRadius: 4,
              display: 'grid',
              placeItems: 'center',
              minHeight: 280,
            }}
          >
            <Stack spacing={1.25} alignItems="center">
              <CircularProgress />
              <Typography variant="body2" fontWeight={700}>
                Loading report…
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Fetching the latest HTML job output.
              </Typography>
            </Stack>
          </Paper>
        ) : error ? (
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 4,
            }}
          >
            <Stack spacing={1.25}>
              <Alert severity="error" sx={{ borderRadius: 3 }}>
                {error}
              </Alert>

              <Stack direction="row" spacing={1}>
                <Button variant="outlined" size="small" onClick={fetchReport}>
                  Retry
                </Button>
                <Button variant="text" size="small" onClick={onClose}>
                  Close
                </Button>
              </Stack>
            </Stack>
          </Paper>
        ) : themedHtml ? (
          <Paper
            variant="outlined"
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              borderRadius: 4,
              bgcolor: isDark ? 'rgba(0,0,0,0.18)' : alpha('#0f172a', 0.02),
            }}
          >
            <iframe
              ref={iframeRef}
              title="Job Report"
              srcDoc={themedHtml}
              style={{
                width: '100%',
                height: '100%',
                minHeight: isMobile ? 420 : 560,
                border: 'none',
                display: 'block',
                backgroundColor: 'transparent',
              }}
              sandbox="allow-same-origin"
            />
          </Paper>
        ) : (
          <Paper
            variant="outlined"
            sx={{
              flex: 1,
              borderRadius: 4,
              display: 'grid',
              placeItems: 'center',
              minHeight: 280,
              px: 2,
              textAlign: 'center',
              borderStyle: 'dashed',
            }}
          >
            <Stack spacing={1.1} alignItems="center">
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  color: 'primary.main',
                }}
              >
                <Notes sx={{ fontSize: 28 }} />
              </Box>

              <Typography variant="h6" fontWeight={800}>
                No logs available yet
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440 }}>
                This job does not have an HTML report available yet. Try refreshing after the job progresses.
              </Typography>

              <Button variant="outlined" size="small" onClick={fetchReport}>
                Refresh
              </Button>
            </Stack>
          </Paper>
        )}
      </DialogContent>
    </Dialog>
  );
}

const LogViewerDrawer = memo(LogViewerDrawerComponent);
export default LogViewerDrawer;