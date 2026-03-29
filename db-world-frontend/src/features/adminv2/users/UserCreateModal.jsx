import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, TextField, MenuItem, IconButton, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { createUserSchema } from '../schemas/userSchemas';
import { createUser } from '../api/adminApi';
import { inputSx, dialogSx } from './constants';

export default function UserCreateModal({ open, onClose }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { control, handleSubmit, reset, formState:{ errors } } = useForm({
    resolver: zodResolver(createUserSchema),
    defaultValues: { firstName:'', lastName:'', dob:'', gender:'', mobileNo:'', email:'', password:'', roleId:'' },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['users'] });
      enqueueSnackbar('User created successfully', { variant:'success' });
      reset(); onClose();
    },
    onError: (err) => enqueueSnackbar(err?.response?.data?.message ?? 'Failed to create user', { variant:'error' }),
  });

  const F = ({ name, label, type='text', ...props }) => (
    <Controller name={name} control={control} render={({ field }) => (
      <TextField {...field} label={label} type={type} size="small" fullWidth sx={inputSx} error={!!errors[name]} helperText={errors[name]?.message} {...props} />
    )} />
  );

  return (
    <Dialog open={open} onClose={onClose} sx={dialogSx} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', pb:1 }}>
        Add User
        <IconButton onClick={onClose} sx={{ color:'rgba(15,23,42,0.45)' }}><CloseIcon /></IconButton>
      </DialogTitle>
      <form onSubmit={handleSubmit(d => mutate(d))}>
        <DialogContent sx={{ pt:1 }}>
          <Grid container spacing={2}>
            <Grid item xs={6}><F name="firstName" label="First Name" /></Grid>
            <Grid item xs={6}><F name="lastName"  label="Last Name" /></Grid>
            <Grid item xs={12}><F name="email"    label="Email" type="email" /></Grid>
            <Grid item xs={6}><F name="password"  label="Password" type="password" /></Grid>
            <Grid item xs={6}><F name="mobileNo"  label="Mobile No" type="number" /></Grid>
            <Grid item xs={6}><F name="dob"       label="Date of Birth" type="date" InputLabelProps={{ shrink:true }} /></Grid>
            <Grid item xs={6}>
              <Controller name="gender" control={control} render={({ field }) => (
                <TextField {...field} select label="Gender" size="small" fullWidth sx={inputSx} error={!!errors.gender} helperText={errors.gender?.message}>
                  {['Male','Female','Other'].map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                </TextField>
              )} />
            </Grid>
            <Grid item xs={12}>
              <Controller name="roleId" control={control} render={({ field }) => (
                <TextField {...field} select label="Role (optional)" size="small" fullWidth sx={inputSx}>
                  <MenuItem value="">Default (Viewer)</MenuItem>
                  <MenuItem value={1}>Owner</MenuItem>
                  <MenuItem value={2}>Admin</MenuItem>
                  <MenuItem value={3}>Viewer</MenuItem>
                </TextField>
              )} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2 }}>
          <Button onClick={onClose} sx={{ color:'rgba(15,23,42,0.5)' }}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isPending} sx={{ bgcolor:'#0d9488','&:hover':{ bgcolor:'#0f766e' } }}>
            {isPending ? <CircularProgress size={18} color="inherit" /> : 'Create User'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
