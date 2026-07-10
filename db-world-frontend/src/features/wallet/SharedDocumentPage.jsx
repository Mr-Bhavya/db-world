import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useT } from '@shared/theme';
import { fetchSharedInfo, sharedContentUrl } from './api/walletApi';

export default function SharedDocumentPage() {
  const T = useT();
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSharedInfo(token)
      .then(setInfo)
      .catch((e) => setError(e?.response?.data?.message ?? 'This link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress sx={{ color: T.teal }} /></Box>;
  if (error)   return <Box sx={{ p: 4, textAlign: 'center', color: T.textMuted }}><Typography>{error}</Typography></Box>;

  const isPdf = info.contentType === 'application/pdf';
  const inlineUrl = sharedContentUrl(token, 'inline');

  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, color: T.textPrimary, maxWidth: 900, mx: 'auto' }}>
      <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{info.label}</Typography>
      {info.typeDisplayName && <Typography sx={{ color: T.textMuted, mb: 2 }}>{info.typeDisplayName}</Typography>}
      <Box sx={{ my: 2, border: `1px solid ${T.border}`, borderRadius: 2, overflow: 'hidden' }}>
        {isPdf ? <iframe title={info.label} src={inlineUrl} style={{ width: '100%', height: '75vh', border: 0 }} />
               : <img alt={info.label} src={inlineUrl} style={{ maxWidth: '100%' }} />}
      </Box>
      <Button variant="contained" href={sharedContentUrl(token, 'attachment')}
        sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>Download</Button>
    </Box>
  );
}
