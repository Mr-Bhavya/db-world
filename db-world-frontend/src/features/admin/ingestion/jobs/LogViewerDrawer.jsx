import React, { useEffect, useRef, useState } from 'react';
import {
  Drawer, Box, Typography, IconButton,
  CircularProgress, Alert, Tooltip, Stack, Chip,
} from '@mui/material';
import { useT } from '@shared/theme';
import { Close, Refresh, Download } from '@mui/icons-material';
import { getJobReport } from '../services/ingestionApi';

/**
 * Right-side drawer that shows the HTML report for a job.
 * Props: jobId, open, onClose
 */
export default function LogViewerDrawer({ jobId, open, onClose }) {
  const T = useT();
  const [html, setHtml]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const iframeRef             = useRef(null);

  const fetchReport = async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getJobReport(jobId);
      setHtml(typeof res?.data === 'string' ? res.data : '');
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && jobId) fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobId]);

  const downloadHtml = () => {
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `job-${jobId}.html`;
    a.click();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: 600, md: 700 },
          bgcolor: 'background.paper',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <Typography variant="subtitle1" fontWeight={600} flex={1}>
          Job Logs
        </Typography>
        {jobId && (
          <Chip
            label={jobId.slice(0, 8) + '…'}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.7rem' }}
          />
        )}
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={fetchReport} disabled={loading}>
              {loading ? <CircularProgress size={16} /> : <Refresh fontSize="small" />}
            </IconButton>
          </Tooltip>
          {html && (
            <Tooltip title="Download HTML report">
              <IconButton size="small" onClick={downloadHtml}>
                <Download fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <IconButton size="small" onClick={onClose}>
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {error && !loading && (
          <Box sx={{ p: 2 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        {typeof html === 'string' && html && !loading && (
          <iframe
            ref={iframeRef}
            title="Job Report"
            srcDoc={html}
            style={{
              flex: 1,
              border: 'none',
              width: '100%',
              height: '100%',
              minHeight: 400,
              backgroundColor: T.glass,
            }}
          />
        )}

        {(!html || typeof html !== 'string') && !loading && !error && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">No logs available yet.</Typography>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
