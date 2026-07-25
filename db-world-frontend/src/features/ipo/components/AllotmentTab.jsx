import { useEffect } from 'react';
import { Box, Typography, Button, TextField, MenuItem, CircularProgress } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useConfirm } from 'material-ui-confirm';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { useT, getSelectMenuProps } from '@shared/theme';
import { useMyApplication, useSaveApplication, useDeleteApplication } from '../hooks/useIpo';
import { applicationSchema, APPLICATION_DEFAULT_VALUES, ALLOTMENT_RESULT_OPTIONS } from '../schemas/applicationSchema';
import { formatStageDate, allotmentResultMeta } from '../utils/format';
import SectionCard from './SectionCard';
import GuidedCheckButton from './GuidedCheckButton';

/**
 * Registrar-reported allotment status (Awaited/Finalized/etc, from the IPO itself — not the
 * applicant's own result) plus its date from the timeline, and the shared guided-check CTA.
 * The CTA is visually emphasized once the status reads "Finalized", since that's the moment
 * actually checking becomes useful.
 */
function AllotmentStatusCard({ ipo }) {
  const T = useT();
  const finalized = /final/i.test(ipo.allotmentStatus ?? '');
  const dateInfo = formatStageDate(ipo.allotmentDate);
  return (
    <SectionCard title="Allotment status" icon={<FactCheckOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 12, color: T.textFaint }}>Status</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, mt: 0.25 }}>
            {ipo.allotmentStatus ?? 'Not announced yet'}
          </Typography>
          {dateInfo && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.5 }}>
              <EventAvailableOutlinedIcon sx={{ fontSize: 13, color: T.textFaint, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12, color: T.textMuted }}>
                Allotment date: {dateInfo.dayMonth} {dateInfo.year}
              </Typography>
            </Box>
          )}
          {ipo.registrar && (
            <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.5 }}>
              Registrar: {ipo.registrar}
            </Typography>
          )}
        </Box>
        <GuidedCheckButton registrarUrl={ipo.registrarUrl} emphasize={finalized} />
      </Box>
    </SectionCard>
  );
}

/** "Saved • App no ••• • PAN ••••1234" summary strip, shown above the form once an application
 * exists — plus the user's own self-recorded allotment result as a small status chip. */
function SavedSummary({ application }) {
  const T = useT();
  const meta = allotmentResultMeta(application.allotmentResult, T);
  const parts = [
    'Saved',
    application.applicationNo ? `App no ${application.applicationNo}` : null,
    application.panLast4 ? `PAN ••••${application.panLast4}` : null,
  ].filter(Boolean);
  return (
    <Box sx={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mb: 1.5,
      px: 1.25, py: 0.85, borderRadius: 2, bgcolor: T.tealBg, border: `1px solid ${T.teal}33`,
    }}>
      <CheckCircleOutlineRoundedIcon sx={{ fontSize: 16, color: T.teal, flexShrink: 0 }} />
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: T.textPrimary, minWidth: 0 }}>
        {parts.join(' • ')}
      </Typography>
      <Box sx={{ ml: 'auto', px: 0.9, py: 0.2, borderRadius: 999, bgcolor: meta.bg, flexShrink: 0 }}>
        <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: meta.color }}>{meta.label}</Typography>
      </Box>
    </Box>
  );
}

/**
 * "My application" — a small form to save this applicant's own details for THIS IPO
 * (application no, DP/client id, PAN, self-recorded allotment result). All fields are
 * optional. A saved application shows only `panLast4` back (never a full PAN); leaving the
 * PAN field blank on a later save preserves whatever's already stored rather than clearing it.
 */
function MyApplicationForm({ ipoId }) {
  const T = useT();
  const confirm = useConfirm();
  const { data: application, isLoading } = useMyApplication(ipoId);
  const saveMutation = useSaveApplication(ipoId);
  const deleteMutation = useDeleteApplication(ipoId);

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(applicationSchema),
    defaultValues: APPLICATION_DEFAULT_VALUES,
  });

  // Prefill from the saved application once it loads — the PAN field itself always starts
  // blank (only `panLast4` ever comes back from the server); its placeholder shows the masked
  // last 4 instead, so a fresh full PAN typed here always means "replace it".
  useEffect(() => {
    if (!application) return;
    reset({
      applicantName: application.applicantName ?? '',
      applicationNo: application.applicationNo ?? '',
      dpClientId: application.dpClientId ?? '',
      pan: '',
      allotmentResult: application.allotmentResult ?? 'unknown',
    });
  }, [application, reset]);

  const submit = (values) => {
    const toNullable = (v) => (v && v.trim() ? v.trim() : null);
    saveMutation.mutate({
      applicantName: toNullable(values.applicantName),
      applicationNo: toNullable(values.applicationNo),
      dpClientId: toNullable(values.dpClientId),
      pan: toNullable(values.pan),
      allotmentResult: values.allotmentResult || 'unknown',
    }, { onSuccess: () => reset({ ...values, pan: '' }) });
  };

  const onRemove = () => {
    confirm({
      title: 'Remove this application?',
      description: 'Your saved application details for this IPO will be deleted.',
      confirmationText: 'Remove',
      confirmationButtonProps: { color: 'error' },
    })
      .then(() => deleteMutation.mutate(undefined, { onSuccess: () => reset(APPLICATION_DEFAULT_VALUES) }))
      .catch(() => {});
  };

  const fieldSx = {
    '& .MuiInputBase-input': { color: T.textPrimary, fontSize: 13 },
    '& .MuiInputLabel-root': { color: T.textMuted, fontSize: 13 },
    '& .MuiFormHelperText-root': { fontSize: 10.5, mx: 0 },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.borderHover },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: T.teal },
  };

  if (isLoading) {
    return (
      <SectionCard title="My application" icon={<AssignmentIndOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={22} sx={{ color: T.teal }} />
        </Box>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="My application" icon={<AssignmentIndOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
      <Typography sx={{ fontSize: 12, color: T.textMuted, mb: 1.5 }}>
        Save your application details here so they&rsquo;re ready when allotment is out.
      </Typography>

      {application && <SavedSummary application={application} />}

      <Box component="form" onSubmit={handleSubmit(submit)}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <Controller name="applicantName" control={control} render={({ field }) => (
            <TextField
              {...field} fullWidth size="small" label="Applicant name (optional)"
              error={!!errors.applicantName} helperText={errors.applicantName?.message} sx={fieldSx}
            />
          )} />
          <Controller name="applicationNo" control={control} render={({ field }) => (
            <TextField
              {...field} fullWidth size="small" label="Application number (optional)"
              error={!!errors.applicationNo} helperText={errors.applicationNo?.message} sx={fieldSx}
            />
          )} />
          <Controller name="dpClientId" control={control} render={({ field }) => (
            <TextField
              {...field} fullWidth size="small" label="DP / Client ID (optional)"
              error={!!errors.dpClientId} helperText={errors.dpClientId?.message} sx={fieldSx}
            />
          )} />
          <Controller name="pan" control={control} render={({ field }) => (
            <TextField
              {...field}
              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
              fullWidth size="small" label="PAN (optional)"
              placeholder={application?.panLast4 ? `•••• ${application.panLast4}` : 'ABCDE1234F'}
              error={!!errors.pan}
              helperText={errors.pan?.message
                ?? (application?.panLast4
                  ? 'Enter a fresh PAN to replace the saved one — only the last 4 digits are ever stored.'
                  : 'Only the last 4 digits are ever stored.')}
              inputProps={{ maxLength: 10 }}
              sx={fieldSx}
            />
          )} />
          <Controller name="allotmentResult" control={control} render={({ field }) => (
            <TextField
              {...field} select fullWidth size="small" label="My allotment result"
              SelectProps={{ MenuProps: getSelectMenuProps(T) }}
              sx={fieldSx}
            >
              {ALLOTMENT_RESULT_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 13 }}>{opt.label}</MenuItem>
              ))}
            </TextField>
          )} />
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mt: 2 }}>
          <Button
            type="submit" variant="contained" disabled={saveMutation.isPending}
            startIcon={saveMutation.isPending
              ? <CircularProgress size={15} sx={{ color: '#fff' }} />
              : <SaveOutlinedIcon sx={{ fontSize: 17 }} />}
            sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}
          >
            {saveMutation.isPending ? 'Saving…' : application ? 'Update application' : 'Save application'}
          </Button>
          {application && (
            <Button
              onClick={onRemove}
              disabled={deleteMutation.isPending}
              startIcon={<DeleteOutlineIcon sx={{ fontSize: 17 }} />}
              sx={{ color: T.error, '&:hover': { bgcolor: T.errorBg } }}
            >
              Remove
            </Button>
          )}
        </Box>
      </Box>
    </SectionCard>
  );
}

/**
 * Allotment tab — the registrar's reported status + guided allotment check, and the applicant's
 * own "My application" record for this IPO. Uses `ipo.id` (not a separate prop) so
 * `IpoDetailPage` never needs to change to accommodate this — see the historical placeholder
 * comment this replaced.
 */
export default function AllotmentTab({ ipo }) {
  return (
    <Box>
      <AllotmentStatusCard ipo={ipo} />
      <MyApplicationForm ipoId={ipo.id} />
    </Box>
  );
}
