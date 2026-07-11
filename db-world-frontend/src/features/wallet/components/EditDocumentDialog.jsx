import { useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Grid, TextField, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@shared/theme';
import { editDocumentSchema } from '../schemas/documentSchemas';
import { fetchDocument } from '../api/walletApi';
import { useUpdateDocument } from '../hooks/useWallet';

export default function EditDocumentDialog({ docId, open, onClose }) {
  const T = useT();
  const { data: doc, isLoading } = useQuery({ queryKey: ['wallet', 'document', docId], queryFn: () => fetchDocument(docId) });
  const update = useUpdateDocument();
  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(editDocumentSchema),
    defaultValues: { label: '', number: '', issueDate: '', expiryDate: '', notes: '', holderName: '' },
  });

  useEffect(() => {
    if (doc) reset({
      label: doc.label ?? '', number: doc.documentNumber ?? '',
      issueDate: doc.issueDate ?? '', expiryDate: doc.expiryDate ?? '', notes: doc.notes ?? '',
      holderName: doc.holderName ?? '',
    });
  }, [doc, reset]);

  const submit = (v) => update.mutate(
    { id: docId, body: { label: v.label, documentNumber: v.number || null, issueDate: v.issueDate || null, expiryDate: v.expiryDate || null, notes: v.notes || null, holderName: v.holderName || null } },
    { onSuccess: onClose },
  );

  const sx = { '& .MuiInputBase-root': { color: T.textPrimary }, '& label': { color: T.textMuted } };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: T.textPrimary, fontWeight: 700 }}>
        Edit document
        <IconButton size="small" onClick={onClose} sx={{ color: T.textFaint }}><CloseIcon /></IconButton>
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
              <Grid item xs={6}><Controller name="issueDate" control={control} render={({ field }) => (
                <TextField {...field} fullWidth size="small" type="date" label="Issue date" InputLabelProps={{ shrink: true }} sx={sx} />)} /></Grid>
              <Grid item xs={6}><Controller name="expiryDate" control={control} render={({ field }) => (
                <TextField {...field} fullWidth size="small" type="date" label="Expiry date" InputLabelProps={{ shrink: true }} sx={sx} />)} /></Grid>
              <Grid item xs={12}><Controller name="notes" control={control} render={({ field }) => (
                <TextField {...field} fullWidth size="small" multiline minRows={2} label="Notes" sx={sx} />)} /></Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={update.isPending}
              sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>Save</Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}
