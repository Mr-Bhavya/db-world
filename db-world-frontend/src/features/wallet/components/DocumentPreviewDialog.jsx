import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, IconButton, Box, CircularProgress, Button, Typography, Divider,
  useMediaQuery, useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { fetchContentBlob, fetchDocument } from '../api/walletApi';
import { downloadBlob } from '../utils/download';

const PdfViewer = lazy(() => import('@shared/components/pdf/PdfViewer'));

export default function DocumentPreviewDialog({ doc, open, onClose }) {
  const T = useT();
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const [url, setUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const isPdf = doc.contentType === 'application/pdf';

  const { data: detail } = useQuery({
    queryKey: ['wallet', 'document', doc.id],
    queryFn: () => fetchDocument(doc.id),
  });

  useEffect(() => {
    let objectUrl; let cancelled = false;
    setLoading(true); setBlob(null); setUrl(null);
    fetchContentBlob(doc.id, 'inline')
      .then((b) => {
        if (cancelled) return;
        setBlob(b);
        // PDFs are handed to pdf.js as a Blob; only images need an object URL for <img>.
        if (!isPdf) { objectUrl = URL.createObjectURL(b); setUrl(objectUrl); }
      })
      .catch(() => { if (!cancelled) notify.error('Failed to load document'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [doc.id, isPdf]);

  const onDownload = async () => {
    try {
      const blob = await fetchContentBlob(doc.id, 'attachment');
      await downloadBlob(blob, doc.label || 'document');
    } catch (_e) {
      notify.error('Failed to download document');
    }
  };

  const onCopyNumber = async () => {
    if (!detail?.documentNumber) return;
    try {
      await navigator.clipboard.writeText(detail.documentNumber);
      notify.success('Number copied');
    } catch (_e) {
      notify.error('Failed to copy number');
    }
  };

  const typeDisplayName = detail?.typeDisplayName ?? doc.typeDisplayName;
  const holderName = detail?.holderName ?? doc.holderName;
  const hasNumber = !!(doc.maskedNumber || detail?.documentNumber);
  const numberValue = revealed && detail?.documentNumber ? detail.documentNumber : doc.maskedNumber;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={isPhone}
      PaperProps={{ sx: { bgcolor: T.sidebar } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: T.textPrimary }}>
        {doc.label}
        <Box>
          <Button startIcon={<DownloadIcon />} onClick={onDownload} sx={{ color: T.teal }}>Download</Button>
          <IconButton onClick={onClose} sx={{ color: T.textFaint }}><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, minHeight: 400 }}>
        <Box sx={{ flex: { xs: '0 0 auto', md: '1 1 60%' }, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
          {loading ? <CircularProgress sx={{ color: T.teal }} />
            : isPdf ? (
              <Box sx={{ width: '100%', height: isPhone ? '50vh' : '70vh' }}>
                <Suspense fallback={<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><CircularProgress sx={{ color: T.teal }} /></Box>}>
                  <PdfViewer src={blob} T={T} />
                </Suspense>
              </Box>
            )
            : <img alt={doc.label} src={url} style={{ maxWidth: '100%', maxHeight: isPhone ? '50vh' : '70vh' }} />}
        </Box>

        <Box sx={{ flex: { xs: '0 0 auto', md: '0 0 260px' }, display: { xs: 'block', md: 'flex' } }}>
          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' }, borderColor: T.glassBorder, mr: 2 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
            {typeDisplayName && <MetaRow label="Type" T={T}>{typeDisplayName}</MetaRow>}
            {holderName && <MetaRow label="Belongs to" T={T}>{holderName}</MetaRow>}

            {hasNumber && (
              <MetaRow label="Document number" T={T}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: 13, color: T.textPrimary, fontFamily: 'monospace' }}>
                    {numberValue}
                  </Typography>
                  <IconButton size="small" aria-label="Toggle number visibility"
                    onClick={() => setRevealed((r) => !r)} sx={{ color: T.textFaint }}>
                    {revealed ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" aria-label="Copy number" disabled={!detail?.documentNumber}
                    onClick={onCopyNumber} sx={{ color: T.textFaint }}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Box>
              </MetaRow>
            )}

            {detail?.notes && (
              <MetaRow label="Notes" T={T}>
                <Typography sx={{ fontSize: 13, color: T.textPrimary, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {detail.notes}
                </Typography>
              </MetaRow>
            )}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function MetaRow({ label, T, children }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: T.textFaint }}>
        {label}
      </Typography>
      {typeof children === 'string' || typeof children === 'number' ? (
        <Typography sx={{ fontSize: 13, color: T.textPrimary, mt: 0.25 }}>{children}</Typography>
      ) : (
        <Box sx={{ mt: 0.25 }}>{children}</Box>
      )}
    </Box>
  );
}
