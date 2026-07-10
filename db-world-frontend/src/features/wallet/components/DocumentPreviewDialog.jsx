import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Box, CircularProgress, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { fetchContentBlob } from '../api/walletApi';
import { downloadBlob } from '../utils/download';

export default function DocumentPreviewDialog({ doc, open, onClose }) {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const isPdf = doc.contentType === 'application/pdf';

  useEffect(() => {
    let objectUrl; let cancelled = false;
    setLoading(true);
    fetchContentBlob(doc.id, 'inline')
      .then((blob) => { if (cancelled) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); })
      .catch(() => { if (!cancelled) enqueueSnackbar('Failed to load document', { variant: 'error' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [doc.id, enqueueSnackbar]);

  const onDownload = async () => {
    try {
      const blob = await fetchContentBlob(doc.id, 'attachment');
      await downloadBlob(blob, doc.label || 'document');
    } catch (_e) {
      enqueueSnackbar('Failed to download document', { variant: 'error' });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: T.sidebar } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: T.textPrimary }}>
        {doc.label}
        <Box>
          <Button startIcon={<DownloadIcon />} onClick={onDownload} sx={{ color: T.teal }}>Download</Button>
          <IconButton onClick={onClose} sx={{ color: T.textFaint }}><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loading ? <CircularProgress sx={{ color: T.teal }} />
          : isPdf ? <iframe title={doc.label} src={url} style={{ width: '100%', height: '70vh', border: 0 }} />
          : <img alt={doc.label} src={url} style={{ maxWidth: '100%', maxHeight: '70vh' }} />}
      </DialogContent>
    </Dialog>
  );
}
