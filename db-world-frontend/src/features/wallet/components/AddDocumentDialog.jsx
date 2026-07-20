import { useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Box, Typography,
  LinearProgress, Collapse, Grid, TextField, useMediaQuery, useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { addDocumentSchema, ACCEPTED_MIME } from '../schemas/documentSchemas';
import { useAddDocument } from '../hooks/useWallet';
import WalletTypeSelect from './WalletTypeSelect';

const MAX_BYTES = 10 * 1024 * 1024; // client mirror of the default cap; server is source of truth

export default function AddDocumentDialog({ open, onClose }) {
  const T = useT();
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'));
  const inputRef = useRef();
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [showMore, setShowMore] = useState(false);
  const [pickedType, setPickedType] = useState(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(addDocumentSchema),
    defaultValues: { typeId: '', label: '', number: '', notes: '', holderName: '' },
  });
  const { mutate, isPending } = useAddDocument();

  const pickFile = (f) => {
    if (!f) return;
    if (!ACCEPTED_MIME.includes(f.type)) { notify.error('Only PDF, PNG or JPEG allowed'); return; }
    if (f.size > MAX_BYTES) { notify.error('File exceeds 10 MB'); return; }
    setFile(f);
  };

  const close = () => { if (isPending) return; reset(); setFile(null); setProgress(0); setShowMore(false); setPickedType(null); onClose(); };

  const submit = (values) => {
    if (!file) { notify.error('Please choose a file'); return; }
    mutate(
      { values: { ...values, file }, onProgress: setProgress },
      { onSuccess: close },
    );
  };

  const fieldSx = { '& .MuiInputBase-root': { color: T.textPrimary }, '& label': { color: T.textMuted } };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm" fullScreen={fullScreen}
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, borderRadius: fullScreen ? 0 : 3 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: T.textPrimary, fontWeight: 700 }}>
        Add document
        <IconButton size="small" onClick={close} sx={{ color: T.textFaint }}><CloseIcon /></IconButton>
      </DialogTitle>
      <form onSubmit={handleSubmit(submit)}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <WalletTypeSelect control={control} errors={errors} T={T} onTypeChange={setPickedType} />

          {/* File dropzone */}
          <Box
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]); }}
            sx={{ border: `2px dashed ${T.border}`, borderRadius: 2, p: 3, textAlign: 'center', cursor: 'pointer',
                  '&:hover': { borderColor: T.teal, bgcolor: T.tealBg } }}>
            <CloudUploadIcon sx={{ fontSize: 32, color: T.textFaint }} />
            <Typography sx={{ fontSize: 13, color: T.textMuted }}>
              {file ? file.name : 'Drop a PDF/image or click to browse (max 10 MB)'}
            </Typography>
            <input ref={inputRef} type="file" hidden accept=".pdf,image/png,image/jpeg"
                   onChange={(e) => pickFile(e.target.files?.[0])} />
          </Box>
          {isPending && <LinearProgress variant="determinate" value={progress}
            sx={{ '& .MuiLinearProgress-bar': { bgcolor: T.teal } }} />}

          <Button onClick={() => setShowMore((s) => !s)} startIcon={<ExpandMoreIcon />}
            sx={{ color: T.textMuted, justifyContent: 'flex-start' }}>
            {showMore ? 'Hide details' : 'Add details (optional)'}
          </Button>
          <Collapse in={showMore}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller name="label" control={control} render={({ field }) => (
                  <TextField {...field} fullWidth size="small" label="Label (optional)" sx={fieldSx} />
                )} />
              </Grid>
              <Grid item xs={12}>
                <Controller name="holderName" control={control} render={({ field }) => (
                  <TextField {...field} fullWidth size="small" label="Belongs to (e.g. Self, Spouse, Father)" sx={fieldSx} />
                )} />
              </Grid>
              {(pickedType?.requiresNumber ?? false) && (
                <Grid item xs={12}>
                  <Controller name="number" control={control} render={({ field }) => (
                    <TextField {...field} fullWidth size="small"
                      label={pickedType?.numberLabel || 'Document number'} sx={fieldSx} />
                  )} />
                </Grid>
              )}
              <Grid item xs={12}>
                <Controller name="notes" control={control} render={({ field }) => (
                  <TextField {...field} fullWidth size="small" multiline minRows={2} label="Notes" sx={fieldSx} />
                )} />
              </Grid>
            </Grid>
          </Collapse>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={close} sx={{ color: T.textMuted }}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isPending || !file}
            sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>
            {isPending ? 'Adding…' : 'Add document'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
