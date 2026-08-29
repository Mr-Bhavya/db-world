import { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Button, TextField, MenuItem, CircularProgress } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useConfirm } from 'material-ui-confirm';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import DomainOutlinedIcon from '@mui/icons-material/DomainOutlined';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useT, getSelectMenuProps } from '@shared/theme';
import { useAuth } from '@features/auth/context/Authentication';
import Constants from '@shared/constants';
import { useMyApplication, useSaveApplication, useDeleteApplication } from '../hooks/useIpo';
import { applicationSchema, APPLICATION_DEFAULT_VALUES, ALLOTMENT_RESULT_OPTIONS } from '../schemas/applicationSchema';
import { formatStageDate, allotmentResultMeta, daysUntil } from '../utils/format';
import SectionCard, { SectionStack } from './SectionCard';
import GuidedCheckButton from './GuidedCheckButton';
import AllotmentGuide from './AllotmentGuide';

/** One "label: value" line with a leading icon, for the status card's supporting facts. */
function StatusLine({ icon: Icon, label, value }) {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mt: 0.5, minWidth: 0 }}>
      <Icon sx={{ fontSize: 13, color: T.textFaint, flexShrink: 0, mt: 0.2 }} />
      <Typography sx={{ fontSize: 12, color: T.textMuted, lineHeight: 1.45 }}>
        <Box component="span" sx={{ color: T.textFaint }}>{label}: </Box>
        {value}
      </Typography>
    </Box>
  );
}

/**
 * Registrar-reported allotment status (Awaited/Finalized/etc — from the IPO itself, not the
 * applicant's own result) plus its date, and the shared guided-check CTA.
 *
 * The status headline now says WHEN as well as WHAT. "Not announced yet" on its own left the
 * reader to go and find the date themselves; a registrar publishing on the allotment date means
 * "not announced yet, and it's due today" and "not announced yet, in four days" are different
 * answers to the question they're actually asking. The CTA is emphasized once the status reads
 * "Finalized", which is the moment checking becomes worth doing.
 */
function AllotmentStatusCard({ ipo }) {
  const T = useT();
  const finalized = /final/i.test(ipo.allotmentStatus ?? '');
  const dateInfo = formatStageDate(ipo.allotmentDate);
  const days = daysUntil(ipo.allotmentDate);

  const due = finalized || days == null
    ? null
    : days > 0 ? `due in ${days}d` : days === 0 ? 'due today' : 'past due';

  return (
    <SectionCard title="Allotment status" icon={<FactCheckOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{
              fontSize: 18, fontWeight: 800, color: finalized ? T.success : T.textPrimary, lineHeight: 1.25,
            }}>
              {ipo.allotmentStatus ?? 'Not announced yet'}
            </Typography>
            {due && (
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: days === 0 ? T.warning : T.textMuted }}>
                {due}
              </Typography>
            )}
          </Box>
          {dateInfo && (
            <StatusLine
              icon={EventAvailableOutlinedIcon}
              label="Allotment date"
              value={`${dateInfo.dayMonth} ${dateInfo.year}`}
            />
          )}
          {ipo.registrar && (
            <StatusLine icon={DomainOutlinedIcon} label="Registrar" value={ipo.registrar} />
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
 * What a signed-out visitor sees in place of the form.
 *
 * The IPO detail page is public, but saving an application is not — the record is per-account. The
 * form used to render for everyone, so an anonymous visitor could fill in five fields, including
 * their PAN, and only discover on submit that it went nowhere. Asking first costs one tap and
 * never collects anything it can't keep.
 */
function SignInToSave() {
  const T = useT();
  return (
    <SectionCard title="My application" icon={<AssignmentIndOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
      <Box sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        gap: 1.25, py: 2.5, px: 2, borderRadius: 2.5, border: `1px dashed ${T.border}`,
      }}>
        <Box sx={{
          width: 40, height: 40, borderRadius: '50%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', bgcolor: T.tealBg,
        }}>
          <LockOutlinedIcon sx={{ fontSize: 20, color: T.teal }} />
        </Box>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: T.textPrimary }}>
          Sign in to save your application
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: T.textMuted, maxWidth: 380, lineHeight: 1.6 }}>
          Keep your application number, DP/client ID and allotment result on file against this IPO.
          Checking allotment on the registrar&rsquo;s site doesn&rsquo;t need an account.
        </Typography>
        <Button
          component={RouterLink}
          to={Constants.LOGIN_ROUTE}
          variant="outlined"
          size="small"
          sx={{
            mt: 0.5, textTransform: 'none', fontWeight: 700,
            borderColor: T.teal, color: T.teal, '&:hover': { borderColor: T.tealHover, bgcolor: T.tealBg },
          }}
        >
          Sign in
        </Button>
      </Box>
    </SectionCard>
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
    <SectionCard
      title="My application"
      subtitle="For your own records — we can’t auto-check allotment, because the registrar requires a CAPTCHA."
      icon={<AssignmentIndOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}
    >
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
 * Allotment tab — the registrar's reported status and the guided check, a collapsed step-by-step
 * guide, and the applicant's own record for this IPO.
 *
 * Order matters here more than on the other tabs, because one of the three is an action and the
 * other two are not. The check comes first, the form second, and the five-step explainer — read
 * once, then never again — sits collapsed between them instead of pushing the form ~350px down
 * the page on every visit.
 */
export default function AllotmentTab({ ipo }) {
  const { auth } = useAuth();
  return (
    <SectionStack>
      <AllotmentStatusCard ipo={ipo} />
      <AllotmentGuide />
      {auth?.isAuthenticated ? <MyApplicationForm ipoId={ipo.id} /> : <SignInToSave />}
    </SectionStack>
  );
}
