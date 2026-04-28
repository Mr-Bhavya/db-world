import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, Box, Button, Grid, TextField, MenuItem, IconButton, CircularProgress, Tabs, Tab, InputAdornment, Tooltip, Typography } from '@mui/material';
import CloseIcon        from '@mui/icons-material/Close';
import VisibilityIcon   from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ContentCopyIcon  from '@mui/icons-material/ContentCopy';
import AutoFixHighIcon  from '@mui/icons-material/AutoFixHigh';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { z } from 'zod';
import { useT, getSelectMenuProps } from '@shared/theme';
import { updateUser, getUserById, updateUserRole } from '../api/adminApi';
import { getInputSx, getDialogSx, getTabSx } from './constants';

const profileSchema = z.object({
  firstName: z.string().min(2, 'Min 2 chars').max(20, 'Max 20 chars'),
  lastName:  z.string().min(1, 'Min 1 char').max(20, 'Max 20 chars'),
  dob:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: yyyy-MM-dd').optional().or(z.literal('')),
  gender:    z.string().min(1, 'Required'),
  mobileNo:  z.coerce.number().min(999999999, 'Must be at least 9 digits').max(9999999999, 'Must be at most 10 digits'),
});

const adminPasswordSchema = z.object({
  newPassword:     z.string().min(6, 'Min 6 chars').max(100, 'Max 100 chars'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

function ProfileTab({ userId, onClose }) {
  const T  = useT();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { data: user } = useQuery({ queryKey: ['user', userId], queryFn: () => getUserById(userId), enabled: !!userId });

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName: '', lastName: '', dob: '', gender: '', mobileNo: '' },
  });

  useEffect(() => {
    if (user) reset({ firstName: user.firstName ?? '', lastName: user.lastName ?? '', dob: user.dob ?? '', gender: user.gender ?? '', mobileNo: user.mobileNo ?? '' });
  }, [user, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (d) => updateUser(userId, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['user', userId] });
      enqueueSnackbar('User updated', { variant: 'success' });
      onClose();
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Update failed', { variant: 'error' }),
  });

  const F = ({ name, label, ...props }) => (
    <Controller name={name} control={control} render={({ field }) => (
      <TextField {...field} label={label} size="small" fullWidth sx={getInputSx(T)} error={!!errors[name]} helperText={errors[name]?.message} {...props} />
    )} />
  );

  return (
    <form onSubmit={handleSubmit(d => mutate(d))}>
      <Grid container spacing={2} sx={{ pt: 1 }}>
        <Grid item xs={6}><F name="firstName" label="First Name" /></Grid>
        <Grid item xs={6}><F name="lastName"  label="Last Name" /></Grid>
        <Grid item xs={6}><F name="mobileNo"  label="Mobile" type="number" /></Grid>
        <Grid item xs={6}><F name="dob"       label="Date of Birth" type="date" InputLabelProps={{ shrink: true }} /></Grid>
        <Grid item xs={6}>
          <Controller name="gender" control={control} render={({ field }) => (
            <TextField {...field} select label="Gender" size="small" fullWidth sx={getInputSx(T)}
              SelectProps={{ MenuProps: getSelectMenuProps(T) }}>
              {['Male', 'Female', 'Other'].map(g => <MenuItem key={g} value={g} sx={{ color: T.textPrimary }}>{g}</MenuItem>)}
            </TextField>
          )} />
        </Grid>
      </Grid>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={isPending}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600 }}>
          {isPending ? <CircularProgress size={18} color="inherit" /> : 'Save Changes'}
        </Button>
      </Box>
    </form>
  );
}

const CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$';
function generatePassword(len = 12) {
  return Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

function PasswordTab({ userId, onClose }) {
  const T  = useT();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm({ resolver: zodResolver(adminPasswordSchema) });
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  const newPassword = watch('newPassword') ?? '';

  const handleGenerate = () => {
    const pwd = generatePassword();
    setValue('newPassword',     pwd, { shouldValidate: true });
    setValue('confirmPassword', pwd, { shouldValidate: true });
    setShow(true);
    setCopied(false);
  };

  const handleCopy = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const { mutate, isPending } = useMutation({
    mutationFn: (d) => updateUser(userId, { password: d.newPassword }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['user', userId] });
      enqueueSnackbar('Password changed', { variant: 'success' });
      onClose();
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Failed', { variant: 'error' }),
  });

  const eyeBtn = (
    <InputAdornment position="end">
      <IconButton size="small" onClick={() => setShow(s => !s)} edge="end" sx={{ color: T.textMuted }}>
        {show ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
      </IconButton>
    </InputAdornment>
  );

  const F = ({ name, label }) => (
    <Controller name={name} control={control} render={({ field }) => (
      <TextField
        {...field} label={label} type={show ? 'text' : 'password'} size="small" fullWidth
        sx={{ ...getInputSx(T), mb: 2 }} error={!!errors[name]} helperText={errors[name]?.message}
        InputProps={{ endAdornment: eyeBtn }}
      />
    )} />
  );

  return (
    <form onSubmit={handleSubmit(d => mutate(d))}>
      <Box sx={{ pt: 1 }}>
        {/* Generate shortcut */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1.5, borderRadius: 2, bgcolor: `${T.teal}12`, border: `1px solid ${T.teal}30` }}>
          <AutoFixHighIcon sx={{ fontSize: 16, color: T.teal, flexShrink: 0 }} />
          <Typography sx={{ fontSize: 12, color: T.textMuted, flex: 1 }}>
            Generate a temporary password to share with the user
          </Typography>
          <Button size="small" onClick={handleGenerate}
            sx={{ fontSize: 11, fontWeight: 700, color: T.teal, borderColor: T.teal, border: '1px solid', px: 1.5, py: 0.25, minWidth: 0, borderRadius: 1.5, '&:hover': { bgcolor: `${T.teal}18` } }}>
            Generate
          </Button>
        </Box>

        <F name="newPassword"     label="New Password" />
        <F name="confirmPassword" label="Confirm Password" />

        {/* Copy row — only shows when there's a password typed */}
        {newPassword.length >= 6 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1.25, borderRadius: 1.5, bgcolor: T.glass, border: `1px solid ${T.border}` }}>
            <Typography sx={{ fontSize: 12, color: T.textMuted, flex: 1, fontFamily: 'monospace', letterSpacing: show ? 0 : 2 }}>
              {show ? newPassword : '•'.repeat(newPassword.length)}
            </Typography>
            <Tooltip title={copied ? 'Copied!' : 'Copy password'}>
              <IconButton size="small" onClick={handleCopy} sx={{ color: copied ? T.teal : T.textMuted }}>
                <ContentCopyIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isPending}
            sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600 }}>
            {isPending ? <CircularProgress size={18} color="inherit" /> : 'Set Password'}
          </Button>
        </Box>
      </Box>
    </form>
  );
}

function RoleTab({ userId, onClose }) {
  const T  = useT();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { data: user } = useQuery({ queryKey: ['user', userId], queryFn: () => getUserById(userId), enabled: !!userId });
  const [roleId, setRoleId] = useState('');

  useEffect(() => {
    if (user?.userRole?.id) setRoleId(user.userRole.id);
  }, [user]);

  const { mutate, isPending } = useMutation({
    mutationFn: () => updateUserRole(userId, roleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['user', userId] });
      enqueueSnackbar('Role updated', { variant: 'success' });
      onClose();
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Role update failed', { variant: 'error' }),
  });

  return (
    <Box sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <TextField select label="Role" value={roleId} onChange={e => setRoleId(e.target.value)}
        size="small" fullWidth sx={getInputSx(T)} SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}` } } } }}>
        <MenuItem value={1} sx={{ color: T.textPrimary }}>Owner</MenuItem>
        <MenuItem value={2} sx={{ color: T.textPrimary }}>Admin</MenuItem>
        <MenuItem value={3} sx={{ color: T.textPrimary }}>Viewer</MenuItem>
      </TextField>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
        <Button onClick={() => mutate()} variant="contained" disabled={!roleId || isPending}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600 }}>
          {isPending ? <CircularProgress size={18} color="inherit" /> : 'Update Role'}
        </Button>
      </Box>
    </Box>
  );
}

export default function UserEditModal({ open, userId, onClose }) {
  const T   = useT();
  const [tab, setTab] = useState(0);
  return (
    <Dialog open={open} onClose={onClose} {...getDialogSx(T)} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', pb: 0, color: T.textPrimary }}>
        Edit User
        <IconButton onClick={onClose} sx={{ color: T.textMuted }}><CloseIcon /></IconButton>
      </DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: `1px solid ${T.border}`, '& .MuiTabs-indicator': { bgcolor: T.teal } }}>
        <Tab label="Profile"  sx={getTabSx(T)} />
        <Tab label="Password" sx={getTabSx(T)} />
        <Tab label="Role"     sx={getTabSx(T)} />
      </Tabs>
      <DialogContent>
        {tab === 0 && <ProfileTab  userId={userId} onClose={onClose} />}
        {tab === 1 && <PasswordTab userId={userId} onClose={onClose} />}
        {tab === 2 && <RoleTab     userId={userId} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
