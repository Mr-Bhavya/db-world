import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, Box, Button, Grid, TextField, MenuItem, IconButton, CircularProgress, Tabs, Tab } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { updateUserSchema, changePasswordSchema } from '../schemas/userSchemas';
import { updateUser, changePassword, getUserById } from '../api/adminApi';
import { inputSx, dialogSx, tabSx } from './constants';

function ProfileTab({ userId, onClose }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { data: user } = useQuery({ queryKey:['user', userId], queryFn:() => getUserById(userId), enabled:!!userId });

  const { control, handleSubmit, reset, formState:{ errors } } = useForm({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { firstName:'', lastName:'', dob:'', gender:'', mobileNo:'', password:'' },
  });

  useEffect(() => {
    if (user) reset({ firstName:user.firstName??'', lastName:user.lastName??'', dob:user.dob??'', gender:user.gender??'', mobileNo:user.mobileNo??'', password:'' });
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
        <Grid item xs={6}><F name="password" label="New Password" type="password" /></Grid>
      </Grid>
      <Box sx={{ display:'flex', justifyContent:'flex-end', mt:2, gap:1 }}>
        <Button onClick={onClose} sx={{ color:'rgba(255,255,255,0.5)' }}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={isPending} sx={{ bgcolor:'#6366f1','&:hover':{ bgcolor:'#5254cc' } }}>
          {isPending ? <CircularProgress size={18} color="inherit" /> : 'Save Changes'}
        </Button>
      </Box>
    </form>
  );
}

function PasswordTab({ onClose }) {
  const { enqueueSnackbar } = useSnackbar();
  const { control, handleSubmit, formState:{ errors } } = useForm({ resolver: zodResolver(changePasswordSchema) });

  const { mutate, isPending } = useMutation({
    mutationFn: changePassword,
    onSuccess: () => { enqueueSnackbar('Password changed', { variant:'success' }); onClose(); },
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
        <F name="currentPassword" label="Current Password" />
        <F name="newPassword"     label="New Password" />
        <F name="confirmPassword" label="Confirm Password" />
        <Box sx={{ display:'flex', justifyContent:'flex-end', gap:1 }}>
          <Button onClick={onClose} sx={{ color:'rgba(255,255,255,0.5)' }}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isPending} sx={{ bgcolor:'#6366f1','&:hover':{ bgcolor:'#5254cc' } }}>
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
        <IconButton onClick={onClose} sx={{ color:'rgba(255,255,255,0.5)' }}><CloseIcon /></IconButton>
      </DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px:2, borderBottom:'1px solid rgba(255,255,255,0.06)', '& .MuiTabs-indicator':{ bgcolor:'#6366f1' } }}>
        <Tab label="Profile" sx={tabSx} />
        <Tab label="Password" sx={tabSx} />
      </Tabs>
      <DialogContent>
        {tab === 0 && <ProfileTab userId={userId} onClose={onClose} />}
        {tab === 1 && <PasswordTab onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
