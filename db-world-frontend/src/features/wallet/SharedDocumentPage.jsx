import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress, useMediaQuery, useTheme } from '@mui/material';
import { useT } from '@shared/theme';
import { fetchSharedInfo, fetchSharedContentBlob } from './api/walletApi';
import { downloadBlob } from './utils/download';

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

  const isPdf = info.contentType === 'application/pdf';
  return (
    <Box sx={{ pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 24px)' }, px: { xs: 2, sm: 4 }, pb: 4, color: T.textPrimary, maxWidth: 900, mx: 'auto' }}>
      <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{info.label}</Typography>
      {info.typeDisplayName && <Typography sx={{ color: T.textMuted, mb: 2 }}>{info.typeDisplayName}</Typography>}
      <Box sx={{ my: 2, border: `1px solid ${T.border}`, borderRadius: 2, overflow: 'hidden' }}>
        {isPdf ? <iframe title={info.label} src={url} style={{ width: '100%', height: isPhone ? '60vh' : '75vh', border: 0 }} />
               : <img alt={info.label} src={url} style={{ maxWidth: '100%', maxHeight: isPhone ? '60vh' : '75vh' }} />}
      </Box>
      <Button variant="contained" onClick={() => downloadBlob(blob, info.originalFileName || info.label || 'document')}
        sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>Download</Button>
    </Box>
  );
}
