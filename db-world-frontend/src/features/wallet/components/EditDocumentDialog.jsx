import { useEffect, useState } from 'react';
import { Box, TextField, CircularProgress, useMediaQuery, useTheme } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { editDocumentSchema, ACCEPTED_MIME } from '../schemas/documentSchemas';
import { fetchDocument, replaceDocumentFile } from '../api/walletApi';
import { useUpdateDocument, useDocumentTypes } from '../hooks/useWallet';
import HolderField from './HolderField';
import ScanNumberPanel from './ScanNumberPanel';
import {
  WalletFormDialog, FormSection, FilePickField, PrimaryButton, GhostButton, walletFieldSx,
} from './walletFormUi';

const MAX_BYTES = 10 * 1024 * 1024; // client mirror of the default cap; server is source of truth
const ACCEPT = '.pdf,image/png,image/jpeg';

/**
 * Edit document — the same layout as Add, so the two read as one form in two moods.
 *
 * Two things it must not get wrong, both learned the hard way:
 *
 * `issueDate` and `expiryDate` MUST be in the submitted body. The server's `update()` calls
 * `setIssueDate`/`setExpiryDate` unconditionally, so omitting them writes null over whatever was
 * stored — every save silently cleared the dates.
 *
 * A field is shown whenever it HAS a value, even if the type says it shouldn't have one. The form
 * posts what it renders, so hiding a populated field would strand it.
 */
export default function EditDocumentDialog({ docId, open, onClose }) {
  const T = useT();
  const queryClient = useQueryClient();
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'));
  const [newFile, setNewFile] = useState(null);
  const [progress, setProgress] = useState(0);

  const { data: doc, isLoading } = useQuery({
    queryKey: ['wallet', 'document', docId],
    queryFn: () => fetchDocument(docId),
  });
  const { data: types = [] } = useDocumentTypes();
  const docType = types.find((t) => t.id === doc?.typeId);

  const update = useUpdateDocument();
  const replaceFile = useMutation({
    mutationFn: () => replaceDocumentFile(docId, newFile, setProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'document', docId] });
      notify.success('File updated');
    },
  });

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(editDocumentSchema),
    defaultValues: { label: '', number: '', notes: '', holderName: '', issueDate: '', expiryDate: '' },
  });

  useEffect(() => {
    if (!doc) return;
    reset({
      label: doc.label ?? '',
      number: doc.documentNumber ?? '',
      notes: doc.notes ?? '',
      holderName: doc.holderName ?? '',
      issueDate: doc.issueDate ?? '',
      expiryDate: doc.expiryDate ?? '',
    });
  }, [doc, reset]);

  useEffect(() => { if (open) { setNewFile(null); setProgress(0); } }, [open]);

  const pickFile = (f) => {
    if (!f) return;
    if (!ACCEPTED_MIME.includes(f.type)) { notify.error('Only PDF, PNG or JPEG allowed'); return; }
    if (f.size > MAX_BYTES) { notify.error('File exceeds 10 MB'); return; }
    setNewFile(f);
  };

  const close = () => { setNewFile(null); onClose(); };

  const submit = (v) => {
    const body = {
      label: v.label,
      documentNumber: v.number || null,
      notes: v.notes || null,
      holderName: v.holderName || null,
      issueDate: v.issueDate || null,
      expiryDate: v.expiryDate || null,
    };
    update.mutate({ id: docId, body }, {
      onSuccess: () => {
        if (newFile) replaceFile.mutate(undefined, { onSuccess: close });
        else close();
      },
    });
  };

  const busy = update.isPending || replaceFile.isPending;
  const fieldSx = walletFieldSx(T);
  const showNumber = docType?.requiresNumber || !!doc?.documentNumber;
  const showExpiry = docType?.hasExpiry !== false || !!doc?.expiryDate;
  // Scanning reads whichever file is in hand — only a newly chosen one, since the stored file would
  // have to be downloaded and decrypted first for no gain over just typing the number.
  const scanFile = newFile;

  return (
    <WalletFormDialog
      open={open}
      onClose={close}
      busy={busy}
      fullScreen={fullScreen}
      title="Edit document"
      subtitle={doc?.typeDisplayName}
      actions={(
        <>
          <GhostButton onClick={close} disabled={busy}>Cancel</GhostButton>
          <PrimaryButton
            type="submit"
            form="edit-document-form"
            disabled={busy || isLoading}
            startIcon={busy ? <CircularProgress size={15} sx={{ color: '#fff' }} /> : null}
          >
            {busy ? 'Saving…' : 'Save changes'}
          </PrimaryButton>
        </>
      )}
    >
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress size={24} sx={{ color: T.teal }} />
        </Box>
      ) : (
        <Box
          component="form"
          id="edit-document-form"
          onSubmit={handleSubmit(submit)}
          sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
        >
          <FormSection title="What is it">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
              <Controller name="label" control={control} render={({ field }) => (
                <TextField
                  {...field} fullWidth size="small" label="Name this document" sx={fieldSx}
                  error={!!errors.label} helperText={errors.label?.message}
                />
              )} />
              {showNumber && (
                <Controller name="number" control={control} render={({ field }) => (
                  <Box>
                    <TextField
                      {...field} fullWidth size="small"
                      label={docType?.numberLabel || 'Document number'} sx={fieldSx}
                    />
                    <ScanNumberPanel
                      file={scanFile}
                      typeCode={docType?.code}
                      onAccept={(value) => field.onChange(value)}
                    />
                  </Box>
                )} />
              )}
            </Box>
          </FormSection>

          <FormSection title="Whose is it" hint="Documents filed under the same name are grouped together.">
            <HolderField control={control} sx={fieldSx} />
          </FormSection>

          <FormSection title="Dates">
            <Box sx={{ display: 'grid', gridTemplateColumns: showExpiry ? '1fr 1fr' : '1fr', gap: 1.5 }}>
              <Controller name="issueDate" control={control} render={({ field }) => (
                <TextField
                  {...field} fullWidth size="small" type="date" label="Issued on"
                  InputLabelProps={{ shrink: true }} sx={fieldSx}
                />
              )} />
              {showExpiry && (
                <Controller name="expiryDate" control={control} render={({ field }) => (
                  <TextField
                    {...field} fullWidth size="small" type="date" label="Expires on"
                    InputLabelProps={{ shrink: true }} sx={fieldSx}
                    error={!!errors.expiryDate} helperText={errors.expiryDate?.message}
                  />
                )} />
              )}
            </Box>
          </FormSection>

          <FormSection title="Notes">
            <Controller name="notes" control={control} render={({ field }) => (
              <TextField {...field} fullWidth size="small" multiline minRows={2} label="Notes" sx={fieldSx} />
            )} />
          </FormSection>

          <FormSection
            title="Replace the file"
            hint="Optional — leave this alone and the stored file is untouched."
          >
            <FilePickField
              file={newFile}
              onPick={pickFile}
              accept={ACCEPT}
              maxBytes={MAX_BYTES}
              disabled={busy}
              progress={progress}
            />
          </FormSection>
        </Box>
      )}
    </WalletFormDialog>
  );
}
