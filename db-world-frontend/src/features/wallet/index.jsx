import { useMemo, useState } from 'react';
import { Box, Typography, Button, TextField, Chip, Skeleton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { motion } from 'framer-motion';
import { useConfirm } from 'material-ui-confirm';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { useDocuments, useDocumentTypes, useDeleteDocument } from './hooks/useWallet';
import { fetchContentBlob } from './api/walletApi';
import { downloadBlob } from './utils/download';
import DocumentCard from './components/DocumentCard';
import AddDocumentDialog from './components/AddDocumentDialog';
import EditDocumentDialog from './components/EditDocumentDialog';
import DocumentPreviewDialog from './components/DocumentPreviewDialog';
import ShareDialog from './components/ShareDialog';

export default function WalletPage() {
  const T = useT();
  const confirm = useConfirm();
  const { enqueueSnackbar } = useSnackbar();
  const [q, setQ] = useState('');
  const [typeId, setTypeId] = useState('');
  const filters = useMemo(() => ({ typeId, q }), [typeId, q]);
  const { data: docs = [], isLoading } = useDocuments(filters);
  const { data: types = [] } = useDocumentTypes();
  const del = useDeleteDocument();

  const [addOpen, setAddOpen] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [shareDoc, setShareDoc] = useState(null);

  const onDownload = async (doc) => {
    try {
      const blob = await fetchContentBlob(doc.id, 'attachment');
      await downloadBlob(blob, doc.label || 'document');
    } catch (_e) {
      enqueueSnackbar('Failed to download document', { variant: 'error' });
    }
  };
  const onDelete = (doc) => {
    confirm({ title: 'Delete document?', description: `"${doc.label}" will be permanently deleted.` })
      .then(() => del.mutate(doc.id)).catch(() => {});
  };

  const gridTemplateColumns = { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(3,1fr)' };

  return (
    <Box sx={{ pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 24px)' }, px: { xs: 2, sm: 3 }, pb: 3, color: T.textPrimary }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 800 }}>Document Wallet</Typography>
          <Typography sx={{ fontSize: 13, color: T.textMuted, mt: 0.25 }}>
            Your encrypted documents, all in one place.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>Add document</Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search by label" value={q}
          onChange={(e) => setQ(e.target.value)} sx={{ minWidth: 220 }} />
        <Chip label="All" onClick={() => setTypeId('')} color={typeId === '' ? 'primary' : 'default'}
          sx={{ transition: 'all 0.15s' }} />
        {types.map((t) => (
          <Chip key={t.id} label={t.displayName} onClick={() => setTypeId(t.id)}
            color={typeId === t.id ? 'primary' : 'default'} sx={{ transition: 'all 0.15s' }} />
        ))}
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={230} sx={{ bgcolor: T.glass }} />
          ))}
        </Box>
      ) : docs.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
          <Box sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', gap: 1.5, py: 8,
          }}>
            <FolderOpenIcon sx={{ fontSize: 56, color: T.textFaint }} />
            <Typography sx={{ fontSize: 17, fontWeight: 700, color: T.textPrimary }}>No documents yet</Typography>
            <Typography sx={{ fontSize: 13, color: T.textMuted, maxWidth: 320 }}>
              Add your first ID, licence, or certificate to keep it safely encrypted and within reach.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
              sx={{ mt: 1, bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>Add document</Button>
          </Box>
        </motion.div>
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns }}>
          {docs.map((doc, i) => (
            <DocumentCard key={doc.id} doc={doc} index={i}
              onPreview={setPreviewDoc} onDownload={onDownload}
              onEdit={setEditDoc} onShare={setShareDoc} onDelete={onDelete} />
          ))}
        </Box>
      )}

      <AddDocumentDialog open={addOpen} onClose={() => setAddOpen(false)} />
      {editDoc && <EditDocumentDialog docId={editDoc.id} open onClose={() => setEditDoc(null)} />}
      {previewDoc && <DocumentPreviewDialog doc={previewDoc} open onClose={() => setPreviewDoc(null)} />}
      {shareDoc && <ShareDialog doc={shareDoc} open onClose={() => setShareDoc(null)} />}
    </Box>
  );
}
