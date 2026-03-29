import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, Box, Button, Grid, TextField, MenuItem, IconButton, CircularProgress, Tabs, Tab } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { z } from 'zod';
import { updateUser, getUserById } from '../api/adminApi';
import { inputSx, dialogSx, tabSx } from './constants';

const profileSchema = z.object({
  firstName: z.string().min(2, 'Min 2 chars').max(20, 'Max 20 chars'),
  lastName:  z.string().min(1, 'Min 1 char').max(20, 'Max 20 chars'),
  dob:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: yyyy-MM-dd').optional().or(z.literal('')),
  gender:    z.string().min(1, 'Required'),
  mobileNo:  z.coerce.number().min(999999999, 'Must be at least 9 digits').max(9999999999, 'Must be at most 10 digits'),
});

const adminPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Min 6 chars').max(100, 'Max 100 chars'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

function ProfileTab({ userId, onClose }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { data: user } = useQuery({ queryKey:['user', userId], queryFn:() => getUserById(userId), enabled:!!userId });

  const { control, handleSubmit, reset, formState:{ errors } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName:'', lastName:'', dob:'', gender:'', mobileNo:'' },
  });

  useEffect(() => {
    if (user) reset({ firstName:user.firstName??'', lastName:user.lastName??'', dob:user.dob??'', gender:user.gender??'', mobileNo:user.mobileNo??'' });
  }, [user, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (d) => updateUser(userId, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['users'] });
      qc.invalidateQueries({ queryKey:['user', userId] });
      enqueueSnackbar('User updated', { variant:'success' });
      onClose();
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Update failed', { variant:'error' }),
  });

  const F = ({ name, label, ...props }) => (
    <Controller name={name} control={control} render={({ field }) => (
      <TextField {...field} label={label} size="small" fullWidth sx={inputSx} error={!!errors[name]} helperText={errors[name]?.message} {...props} />
    )} />
  );

  return (
    <form onSubmit={handleSubmit(d => mutate(d))}>
      <Grid container spacing={2} sx={{ pt:1 }}>
        <Grid item xs={6}><F name="firstName" label="First Name" /></Grid>
        <Grid item xs={6}><F name="lastName"  label="Last Name" /></Grid>
        <Grid item xs={6}><F name="mobileNo"  label="Mobile" type="number" /></Grid>
        <Grid item xs={6}><F name="dob"       label="Date of Birth" type="date" InputLabelProps={{ shrink:true }} /></Grid>
        <Grid item xs={6}>
          <Controller name="gender" control={control} render={({ field }) => (
            <TextField {...field} select label="Gender" size="small" fullWidth sx={inputSx}>
              {['Male','Female','Other'].map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
            </TextField>
          )} />
        </Grid>
      </Grid>
      <Box sx={{ display:'flex', justifyContent:'flex-end', mt:2, gap:1 }}>
        <Button onClick={onClose} sx={{ color:'rgba(15,23,42,0.5)' }}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={isPending} sx={{ bgcolor:'#0d9488','&:hover':{ bgcolor:'#0f766e' } }}>
          {isPending ? <CircularProgress size={18} color="inherit" /> : 'Save Changes'}
        </Button>
      </Box>
    </form>
  );
}

function PasswordTab({ userId, onClose }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { control, handleSubmit, formState:{ errors } } = useForm({ resolver: zodResolver(adminPasswordSchema) });

  const { mutate, isPending } = useMutation({
    mutationFn: (d) => updateUser(userId, { password: d.newPassword }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['users'] });
      qc.invalidateQueries({ queryKey:['user', userId] });
      enqueueSnackbar('Password changed', { variant:'success' });
      onClose();
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Failed', { variant:'error' }),
  });

  const F = ({ name, label }) => (
    <Controller name={name} control={control} render={({ field }) => (
      <TextField {...field} label={label} type="password" size="small" fullWidth sx={{ ...inputSx, mb:2 }} error={!!errors[name]} helperText={errors[name]?.message} />
    )} />
  );

  return (
    <form onSubmit={handleSubmit(d => mutate(d))}>
      <Box sx={{ pt:1 }}>
        <F name="newPassword"     label="New Password" />
        <F name="confirmPassword" label="Confirm Password" />
        <Box sx={{ display:'flex', justifyContent:'flex-end', gap:1 }}>
          <Button onClick={onClose} sx={{ color:'rgba(15,23,42,0.5)' }}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isPending} sx={{ bgcolor:'#0d9488','&:hover':{ bgcolor:'#0f766e' } }}>
            {isPending ? <CircularProgress size={18} color="inherit" /> : 'Change Password'}
          </Button>
        </Box>
      </Box>
    </form>
  );
}

export default function UserEditModal({ open, userId, onClose }) {
  const [tab, setTab] = useState(0);
  return (
    <Dialog open={open} onClose={onClose} sx={dialogSx} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display:'flex', justifyContent:'space-between', pb:0 }}>
        Edit User
        <IconButton onClick={onClose} sx={{ color:'rgba(15,23,42,0.45)' }}><CloseIcon /></IconButton>
      </DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px:2, borderBottom:'1px solid rgba(0,0,0,0.07)', '& .MuiTabs-indicator':{ bgcolor:'#0d9488' } }}>
        <Tab label="Profile" sx={tabSx} />
        <Tab label="Password" sx={tabSx} />
      </Tabs>
      <DialogContent>
        {tab === 0 && <ProfileTab userId={userId} onClose={onClose} />}
        {tab === 1 && <PasswordTab userId={userId} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
