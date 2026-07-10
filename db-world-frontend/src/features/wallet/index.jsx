import { useMemo, useState } from 'react';
import { Box, Typography, Button, TextField, Chip, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useConfirm } from 'material-ui-confirm';
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
    const blob = await fetchContentBlob(doc.id, 'attachment');
    await downloadBlob(blob, doc.label || 'document');
  };
  const onDelete = (doc) => {
    confirm({ title: 'Delete document?', description: `"${doc.label}" will be permanently deleted.` })
      .then(() => del.mutate(doc.id)).catch(() => {});
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, color: T.textPrimary }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 800 }}>Document Wallet</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>Add document</Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search by label" value={q}
          onChange={(e) => setQ(e.target.value)} sx={{ minWidth: 220 }} />
        <Chip label="All" onClick={() => setTypeId('')} color={typeId === '' ? 'primary' : 'default'} />
        {types.map((t) => (
          <Chip key={t.id} label={t.displayName} onClick={() => setTypeId(t.id)}
            color={typeId === t.id ? 'primary' : 'default'} />
        ))}
      </Box>

      {isLoading ? <CircularProgress sx={{ color: T.teal }} />
        : docs.length === 0 ? <Typography sx={{ color: T.textMuted }}>No documents yet. Add your first one.</Typography>
        : (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(3,1fr)' } }}>
            {docs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc}
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
