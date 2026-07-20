import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, Box, Button, Grid, TextField, MenuItem, IconButton, CircularProgress, Tabs, Tab, InputAdornment, Tooltip, Typography, useMediaQuery, useTheme as useMuiTheme } from '@mui/material';
import CloseIcon        from '@mui/icons-material/Close';
import VisibilityIcon   from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ContentCopyIcon  from '@mui/icons-material/ContentCopy';
import AutoFixHighIcon  from '@mui/icons-material/AutoFixHigh';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { updateUser, getUserById, updateUserRole, adminSetPassword } from '../api/adminApi';
import { updateUserSchema, adminPasswordSchema } from '../schemas/userSchemas';
import { getInputSx, getDialogSx, getTabSx } from './constants';
import { TextInput, SelectInput, GENDER_OPTIONS, ROLE_OPTIONS, canonicalGender } from './formFields';

function ProfileTab({ userId, onClose }) {
  const T  = useT();
  const qc = useQueryClient();
  const { data: user } = useQuery({ queryKey: ['user', userId], queryFn: () => getUserById(userId), enabled: !!userId });

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { firstName: '', lastName: '', email: '', dob: '', gender: '', mobileNo: '' },
  });

  useEffect(() => {
    if (user) reset({
      firstName: user.firstName ?? '', lastName: user.lastName ?? '', email: user.email ?? '',
      dob: user.dob ?? '', gender: canonicalGender(user.gender), mobileNo: user.mobileNo ?? '',
    });
  }, [user, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (d) => updateUser(userId, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['user', userId] });
      notify.success('User updated');
      onClose();
    },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Update failed'),
  });

  const fp = { control, errors, T };

  return (
    <form onSubmit={handleSubmit(d => mutate(d))}>
      <Grid container spacing={2} sx={{ pt: 1 }}>
        <Grid item xs={12} sm={6}><TextInput {...fp} name="firstName" label="First Name" /></Grid>
        <Grid item xs={12} sm={6}><TextInput {...fp} name="lastName"  label="Last Name" /></Grid>
        <Grid item xs={12}><TextInput {...fp} name="email" label="Email (login ID)" type="email" /></Grid>
        <Grid item xs={12} sm={6}><TextInput {...fp} name="mobileNo" label="Mobile" type="number" /></Grid>
        <Grid item xs={12} sm={6}><TextInput {...fp} name="dob" label="Date of Birth" type="date" InputLabelProps={{ shrink: true }} /></Grid>
        <Grid item xs={12} sm={6}><SelectInput {...fp} name="gender" label="Gender" options={GENDER_OPTIONS} /></Grid>
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

  // Dedicated admin endpoint — resets only the password (no full-profile payload,
  // which is what used to fail validation).
  const { mutate, isPending } = useMutation({
    mutationFn: (d) => adminSetPassword(userId, d.newPassword),
    onSuccess: () => {
      notify.success('Password reset');
      onClose();
    },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Failed'),
  });

  const eyeBtn = (
    <InputAdornment position="end">
      <IconButton size="small" onClick={() => setShow(s => !s)} edge="end" sx={{ color: T.textMuted }}>
        {show ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <form onSubmit={handleSubmit(d => mutate(d))}>
      <Box sx={{ pt: 1 }}>
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

        <Controller name="newPassword" control={control} render={({ field }) => (
          <TextField {...field} value={field.value ?? ''} label="New Password" type={show ? 'text' : 'password'}
            size="small" fullWidth sx={{ ...getInputSx(T), mb: 2 }}
            error={!!errors.newPassword} helperText={errors.newPassword?.message}
            InputProps={{ endAdornment: eyeBtn }} />
        )} />
        <Controller name="confirmPassword" control={control} render={({ field }) => (
          <TextField {...field} value={field.value ?? ''} label="Confirm Password" type={show ? 'text' : 'password'}
            size="small" fullWidth sx={{ ...getInputSx(T), mb: 2 }}
            error={!!errors.confirmPassword} helperText={errors.confirmPassword?.message}
            InputProps={{ endAdornment: eyeBtn }} />
        )} />

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
      notify.success('Role updated');
      onClose();
    },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Role update failed'),
  });

  return (
    <Box sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <TextField select label="Role" value={roleId} onChange={e => setRoleId(e.target.value)}
        size="small" fullWidth sx={getInputSx(T)} SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}` } } } }}>
        {ROLE_OPTIONS.map(r => <MenuItem key={r.value} value={r.value} sx={{ color: T.textPrimary }}>{r.label}</MenuItem>)}
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
  const muiTheme = useMuiTheme();
  const mobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const [tab, setTab] = useState(0);
  const { data: user } = useQuery({ queryKey: ['user', userId], queryFn: () => getUserById(userId), enabled: !!userId && open });
  const name = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '';

  return (
    <Dialog open={open} onClose={onClose} {...getDialogSx(T)} fullWidth maxWidth="sm" fullScreen={mobile}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pb: 0.5, color: T.textPrimary }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: T.textPrimary }}>Edit User</Typography>
          {name && <Typography sx={{ fontSize: 12, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name} · {user?.email}</Typography>}
        </Box>
        <IconButton onClick={onClose} sx={{ color: T.textMuted, flexShrink: 0 }}><CloseIcon /></IconButton>
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
