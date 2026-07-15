import { lazy, Suspense, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress, useMediaQuery, useTheme } from '@mui/material';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { fetchSharedInfo, fetchSharedContentBlob } from './api/walletApi';
import { downloadBlob, openDownloaded } from './utils/download';

const PdfViewer = lazy(() => import('@shared/components/pdf/PdfViewer'));

export default function SharedDocumentPage() {
  const T = useT();
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [blob, setBlob] = useState(null);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl; let cancelled = false;
    setLoading(true);
    Promise.all([fetchSharedInfo(token), fetchSharedContentBlob(token, 'inline')])
      .then(([i, b]) => {
        if (cancelled) return;
        setInfo(i); setBlob(b);
        objectUrl = URL.createObjectURL(b); setUrl(objectUrl);
      })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.message ?? 'This link is invalid or has expired.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [token]);

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress sx={{ color: T.teal }} /></Box>;
  if (error)   return <Box sx={{ p: 4, textAlign: 'center', color: T.textMuted }}><Typography>{error}</Typography></Box>;

  const onDownload = async () => {
    try {
      const saved = await downloadBlob(blob, info.originalFileName || info.label || 'document');
      if (saved?.uri) {
        notify.success('Saved to Downloads', {
          action: { label: 'Open', onClick: () => { openDownloaded(saved).catch(() => {}); } },
        });
      }
    } catch (_e) {
      notify.error('Failed to download document');
    }
  };

  const isPdf = info.contentType === 'application/pdf';
  return (
    <Box sx={{ pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 24px)' }, px: { xs: 2, sm: 4 }, pb: 4, color: T.textPrimary, maxWidth: 900, mx: 'auto' }}>
      <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{info.label}</Typography>
      {info.typeDisplayName && <Typography sx={{ color: T.textMuted, mb: 2 }}>{info.typeDisplayName}</Typography>}
      <Box sx={{ my: 2, border: `1px solid ${T.border}`, borderRadius: 2, overflow: 'hidden' }}>
        {isPdf ? (
          <Box sx={{ width: '100%', height: isPhone ? '60vh' : '75vh' }}>
            <Suspense fallback={<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><CircularProgress sx={{ color: T.teal }} /></Box>}>
              <PdfViewer src={blob} T={T} />
            </Suspense>
          </Box>
        ) : <img alt={info.label} src={url} style={{ maxWidth: '100%', maxHeight: isPhone ? '60vh' : '75vh' }} />}
      </Box>
      <Button variant="contained" onClick={onDownload}
        sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>Download</Button>
    </Box>
  );
}
