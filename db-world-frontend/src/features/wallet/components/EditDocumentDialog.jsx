import { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Grid, TextField,
  CircularProgress, Box, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { editDocumentSchema, ACCEPTED_MIME } from '../schemas/documentSchemas';
import { fetchDocument, replaceDocumentFile } from '../api/walletApi';
import { useUpdateDocument } from '../hooks/useWallet';

const MAX_BYTES = 10 * 1024 * 1024; // client mirror of the default cap; server is source of truth

export default function EditDocumentDialog({ docId, open, onClose }) {
  const T = useT();
  const queryClient = useQueryClient();
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'));
  const inputRef = useRef();
  const [newFile, setNewFile] = useState(null);
  const { data: doc, isLoading } = useQuery({ queryKey: ['wallet', 'document', docId], queryFn: () => fetchDocument(docId) });
  const update = useUpdateDocument();
  const replaceFile = useMutation({
    mutationFn: () => replaceDocumentFile(docId, newFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'document', docId] });
      notify.success('File updated');
    },
  });
  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(editDocumentSchema),
    defaultValues: { label: '', number: '', notes: '', holderName: '' },
  });

  useEffect(() => {
    if (doc) reset({
      label: doc.label ?? '', number: doc.documentNumber ?? '',
      notes: doc.notes ?? '', holderName: doc.holderName ?? '',
    });
  }, [doc, reset]);

  useEffect(() => {
    if (open) setNewFile(null);
  }, [open]);

  const pickFile = (f) => {
    if (!f) return;
    if (!ACCEPTED_MIME.includes(f.type)) { notify.error('Only PDF, PNG or JPEG allowed'); return; }
    if (f.size > MAX_BYTES) { notify.error('File exceeds 10 MB'); return; }
    setNewFile(f);
  };

  const close = () => { setNewFile(null); onClose(); };

  const submit = (v) => {
    const body = { label: v.label, documentNumber: v.number || null, notes: v.notes || null, holderName: v.holderName || null };
    update.mutate({ id: docId, body }, {
      onSuccess: () => {
        if (newFile) {
          replaceFile.mutate(undefined, { onSuccess: close });
        } else {
          close();
        }
      },
    });
  };

  const busy = update.isPending || replaceFile.isPending;

  const sx = { '& .MuiInputBase-root': { color: T.textPrimary }, '& label': { color: T.textMuted } };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm" fullScreen={fullScreen}
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, borderRadius: fullScreen ? 0 : 3 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: T.textPrimary, fontWeight: 700 }}>
        Edit document
        <IconButton size="small" onClick={close} sx={{ color: T.textFaint }}><CloseIcon /></IconButton>
      </DialogTitle>
      {isLoading ? <DialogContent><CircularProgress sx={{ color: T.teal }} /></DialogContent> : (
        <form onSubmit={handleSubmit(submit)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}><Controller name="label" control={control} render={({ field }) => (
                <TextField {...field} fullWidth size="small" label="Label" sx={sx}
                  error={!!errors.label} helperText={errors.label?.message} />)} /></Grid>
              <Grid item xs={12}><Controller name="holderName" control={control} render={({ field }) => (
                <TextField {...field} fullWidth size="small" label="Belongs to" sx={sx} />)} /></Grid>
              <Grid item xs={12}><Controller name="number" control={control} render={({ field }) => (
                <TextField {...field} fullWidth size="small" label="Document number" sx={sx} />)} /></Grid>
              <Grid item xs={12}><Controller name="notes" control={control} render={({ field }) => (
                <TextField {...field} fullWidth size="small" multiline minRows={2} label="Notes" sx={sx} />)} /></Grid>
              <Grid item xs={12}>
                <Box sx={{ border: `1px dashed ${T.border}`, borderRadius: 2, p: 2 }}>
                  <Typography sx={{ fontSize: 13, color: T.textMuted, mb: 1 }}>
                    Replace file (optional) — leave empty to keep the current file
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <Button startIcon={<AttachFileIcon />} variant="outlined" size="small"
                      onClick={() => inputRef.current?.click()} disabled={busy}
                      sx={{ color: T.textPrimary, borderColor: T.border }}>
                      Choose new file
                    </Button>
                    {newFile && (
                      <Typography sx={{ fontSize: 13, color: T.textPrimary }}>{newFile.name}</Typography>
                    )}
                    <input ref={inputRef} type="file" hidden accept=".pdf,image/png,image/jpeg"
                      onChange={(e) => pickFile(e.target.files?.[0])} />
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={close} sx={{ color: T.textMuted }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={busy}
              sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}
