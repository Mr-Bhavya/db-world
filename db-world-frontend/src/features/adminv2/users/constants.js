export const ROLE_COLORS = { OWNER:'#f59e0b', ADMIN:'#6366f1', VIEWER:'#10b981' };

export const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(255,255,255,0.04)',
    color: '#fff',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
    '&.Mui-focused fieldset': { borderColor: '#6366f1' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
  '& .MuiFormHelperText-root': { color: '#ef4444' },
  '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.4)' },
};

export const dialogSx = {
  PaperProps: {
    sx: {
      bgcolor: '#0d0d18',
      border: '1px solid rgba(255,255,255,0.08)',
      color: '#fff',
      width: '100%',
    },
  },
};

export const tabSx = {
  color: 'rgba(255,255,255,0.5)',
  '&.Mui-selected': { color: '#6366f1' },
};
