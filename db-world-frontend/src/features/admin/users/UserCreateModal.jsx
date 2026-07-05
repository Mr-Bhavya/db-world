import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, MenuItem, IconButton, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { createUserSchema } from '../schemas/userSchemas';
import { createUser } from '../api/adminApi';
import { getDialogSx } from './constants';
import { TextInput, SelectInput, GENDER_OPTIONS, ROLE_OPTIONS } from './formFields';

export default function UserCreateModal({ open, onClose }) {
  const T  = useT();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(createUserSchema),
    defaultValues: { firstName: '', lastName: '', dob: '', gender: '', mobileNo: '', email: '', password: '', roleId: '' },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      enqueueSnackbar('User created successfully', { variant: 'success' });
      reset(); onClose();
    },
    onError: (err) => enqueueSnackbar(err?.response?.data?.message ?? 'Failed to create user', { variant: 'error' }),
  });

  const fp = { control, errors, T };

  return (
    <Dialog open={open} onClose={onClose} {...getDialogSx(T)} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, color: T.textPrimary }}>
        Add User
        <IconButton onClick={onClose} sx={{ color: T.textMuted }}><CloseIcon /></IconButton>
      </DialogTitle>
      <form onSubmit={handleSubmit(d => mutate(d))}>
        <DialogContent sx={{ pt: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}><TextInput {...fp} name="firstName" label="First Name" /></Grid>
            <Grid item xs={12} sm={6}><TextInput {...fp} name="lastName"  label="Last Name" /></Grid>
            <Grid item xs={12}><TextInput {...fp} name="email" label="Email" type="email" /></Grid>
            <Grid item xs={12} sm={6}><TextInput {...fp} name="password" label="Password" type="password" /></Grid>
            <Grid item xs={12} sm={6}><TextInput {...fp} name="mobileNo" label="Mobile No" type="number" /></Grid>
            <Grid item xs={12} sm={6}><TextInput {...fp} name="dob" label="Date of Birth" type="date" InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12} sm={6}>
              <SelectInput {...fp} name="gender" label="Gender" options={GENDER_OPTIONS} />
            </Grid>
            <Grid item xs={12}>
              <SelectInput {...fp} name="roleId" label="Role (optional)">
                <MenuItem value="" sx={{ color: T.textMuted }}><em>Default (Viewer)</em></MenuItem>
                {ROLE_OPTIONS.map(r => <MenuItem key={r.value} value={r.value} sx={{ color: T.textPrimary }}>{r.label}</MenuItem>)}
              </SelectInput>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isPending}
            sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600 }}>
            {isPending ? <CircularProgress size={18} color="inherit" /> : 'Create User'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
