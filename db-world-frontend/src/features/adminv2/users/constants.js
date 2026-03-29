export const ROLE_COLORS = { OWNER:'#f59e0b', ADMIN:'#0d9488', VIEWER:'#10b981' };

export const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(0,0,0,0.03)',
    color: '#0f172a',
    '& fieldset': { borderColor: 'rgba(0,0,0,0.12)' },
    '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.25)' },
    '&.Mui-focused fieldset': { borderColor: '#0d9488' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(15,23,42,0.55)' },
  '& .MuiFormHelperText-root': { color: '#ef4444' },
  '& .MuiSelect-icon': { color: 'rgba(15,23,42,0.4)' },
};

export const dialogSx = {
  PaperProps: {
    sx: {
      bgcolor: '#ffffff',
      border: '1px solid rgba(0,0,0,0.1)',
      color: '#0f172a',
      width: '100%',
    },
  },
};

export const tabSx = {
  color: 'rgba(15,23,42,0.5)',
  '&.Mui-selected': { color: '#0d9488' },
};
