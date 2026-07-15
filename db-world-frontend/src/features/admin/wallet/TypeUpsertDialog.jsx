import { useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Grid, TextField, FormControlLabel, Switch } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { typeSchema } from './typeSchemas';
import { createType, updateType } from './adminWalletApi';

export default function TypeUpsertDialog({ open, onClose, editItem }) {
  const T = useT();
  const qc = useQueryClient();
  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(typeSchema),
    defaultValues: { code: '', displayName: '', description: '', numberLabel: '', requiresNumber: false, active: true, sortOrder: 0 },
  });
  useEffect(() => { if (editItem) reset(editItem); else reset({ code: '', displayName: '', description: '', numberLabel: '', requiresNumber: false, active: true, sortOrder: 0 }); }, [editItem, reset]);

  const mut = useMutation({
    mutationFn: (v) => (editItem ? updateType(editItem.id, v) : createType(v)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wallet-admin', 'types'] }); notify.success('Saved'); onClose(); },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Failed to save'),
  });
  const sx = { '& .MuiInputBase-root': { color: T.textPrimary }, '& label': { color: T.textMuted } };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: T.sidebar } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', color: T.textPrimary }}>
        {editItem ? 'Edit document type' : 'New document type'}
        <IconButton onClick={onClose} sx={{ color: T.textFaint }}><CloseIcon /></IconButton>
      </DialogTitle>
      <form onSubmit={handleSubmit((v) => mut.mutate(v))}>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={6}><Controller name="code" control={control} render={({ field }) => (
              <TextField {...field} fullWidth size="small" label="Code" sx={sx} error={!!errors.code} helperText={errors.code?.message} />)} /></Grid>
            <Grid item xs={6}><Controller name="displayName" control={control} render={({ field }) => (
              <TextField {...field} fullWidth size="small" label="Display name" sx={sx} error={!!errors.displayName} helperText={errors.displayName?.message} />)} /></Grid>
            <Grid item xs={12}><Controller name="description" control={control} render={({ field }) => (
              <TextField {...field} fullWidth size="small" label="Description" sx={sx} />)} /></Grid>
            <Grid item xs={6}><Controller name="numberLabel" control={control} render={({ field }) => (
              <TextField {...field} fullWidth size="small" label="Number label" sx={sx} />)} /></Grid>
            <Grid item xs={6}><Controller name="sortOrder" control={control} render={({ field }) => (
              <TextField {...field} fullWidth size="small" type="number" label="Sort order" sx={sx} />)} /></Grid>
            <Grid item xs={6}><Controller name="requiresNumber" control={control} render={({ field }) => (
              <FormControlLabel control={<Switch checked={field.value} onChange={field.onChange} />} label="Requires number" sx={{ color: T.textMuted }} />)} /></Grid>
            <Grid item xs={6}><Controller name="active" control={control} render={({ field }) => (
              <FormControlLabel control={<Switch checked={field.value} onChange={field.onChange} />} label="Active" sx={{ color: T.textMuted }} />)} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={mut.isPending} sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>Save</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
