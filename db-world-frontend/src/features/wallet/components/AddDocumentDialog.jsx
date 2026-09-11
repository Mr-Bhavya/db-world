import { useState } from 'react';
import { Box, TextField, CircularProgress, useMediaQuery, useTheme } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { addDocumentSchema, ACCEPTED_MIME } from '../schemas/documentSchemas';
import { useAddDocument } from '../hooks/useWallet';
import WalletTypeSelect from './WalletTypeSelect';
import HolderField from './HolderField';
import ScanNumberPanel from './ScanNumberPanel';
import {
  WalletFormDialog, FormSection, FilePickField, PrimaryButton, GhostButton, walletFieldSx,
} from './walletFormUi';

const MAX_BYTES = 10 * 1024 * 1024; // client mirror of the default cap; server is source of truth
const ACCEPT = '.pdf,image/png,image/jpeg';

/**
 * Add document.
 *
 * Restructured around what the wallet actually needs to know, in the order you can answer it: the
 * file, what it is, and whose it is. All three used to be split — type and file at the top, holder
 * buried inside a collapsed "Add details (optional)" block along with the number and the dates.
 *
 * That collapse was doing real damage. "Belongs to" drives the person grouping, the Whose filter and
 * the label; the number field is where scanning lives. Hiding them behind a disclosure meant the
 * common case was a document with neither — the family view empty, and the scan button never found.
 * Only the label and the notes stay optional-and-out-of-the-way now, because the label has a sane
 * default and notes are genuinely rare.
 */
export default function AddDocumentDialog({ open, onClose }) {
  const T = useT();
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'));
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [pickedType, setPickedType] = useState(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(addDocumentSchema),
    defaultValues: {
      typeId: '', label: '', number: '', notes: '', holderName: '', issueDate: '', expiryDate: '',
    },
  });
  const { mutate, isPending } = useAddDocument();

  const pickFile = (f) => {
    if (!f) return;
    if (!ACCEPTED_MIME.includes(f.type)) { notify.error('Only PDF, PNG or JPEG allowed'); return; }
    if (f.size > MAX_BYTES) { notify.error('File exceeds 10 MB'); return; }
    setFile(f);
  };

  const close = () => {
    if (isPending) return;
    reset();
    setFile(null);
    setProgress(0);
    setPickedType(null);
    onClose();
  };

  const submit = (values) => {
    if (!file) { notify.error('Please choose a file'); return; }
    mutate({ values: { ...values, file }, onProgress: setProgress }, { onSuccess: close });
  };

  const fieldSx = walletFieldSx(T);
  // Nullable on purpose — null means nobody has said whether this type expires, and an
  // admin-created type should keep the field rather than quietly lose it.
  const showExpiry = pickedType?.hasExpiry !== false;

  return (
    <WalletFormDialog
      open={open}
      onClose={close}
      busy={isPending}
      fullScreen={fullScreen}
      title="Add document"
      subtitle="Encrypted before it is stored. Only you can open it."
      actions={(
        <>
          <GhostButton onClick={close} disabled={isPending}>Cancel</GhostButton>
          <PrimaryButton
            type="submit"
            form="add-document-form"
            disabled={isPending || !file}
            startIcon={isPending ? <CircularProgress size={15} sx={{ color: '#fff' }} /> : null}
          >
            {isPending ? 'Adding…' : 'Add document'}
          </PrimaryButton>
        </>
      )}
    >
      <Box
        component="form"
        id="add-document-form"
        onSubmit={handleSubmit(submit)}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
      >
        <FormSection title="The file">
          <FilePickField
            file={file}
            onPick={pickFile}
            accept={ACCEPT}
            maxBytes={MAX_BYTES}
            disabled={isPending}
            progress={progress}
          />
        </FormSection>

        <FormSection title="What is it">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
            <WalletTypeSelect control={control} errors={errors} T={T} onTypeChange={setPickedType} />

            {/* Only for types that carry one — and the scanner sits directly beneath it, which is
                the only place it makes sense and the reason it is no longer behind a disclosure. */}
            {pickedType?.requiresNumber && (
              <Controller name="number" control={control} render={({ field }) => (
                <Box>
                  <TextField
                    {...field}
                    fullWidth size="small"
                    label={pickedType?.numberLabel || 'Document number'}
                    sx={fieldSx}
                  />
                  <ScanNumberPanel
                    file={file}
                    typeCode={pickedType?.code}
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

        <FormSection title="Anything else" hint="Both optional — the name defaults to the document type.">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
            <Controller name="label" control={control} render={({ field }) => (
              <TextField {...field} fullWidth size="small" label="Name this document" sx={fieldSx} />
            )} />
            <Controller name="notes" control={control} render={({ field }) => (
              <TextField {...field} fullWidth size="small" multiline minRows={2} label="Notes" sx={fieldSx} />
            )} />
          </Box>
        </FormSection>
      </Box>
    </WalletFormDialog>
  );
}
