export const ROLE_COLORS = { OWNER: '#f59e0b', ADMIN: '#0d9488', VIEWER: '#10b981' };

export const getInputSx = (T) => ({
  '& .MuiOutlinedInput-root': {
    bgcolor: T.glass,
    color: T.textPrimary,
    '& fieldset':             { borderColor: T.glassBorder },
    '&:hover fieldset':       { borderColor: T.teal },
    '&.Mui-focused fieldset': { borderColor: T.teal },
  },
  '& .MuiInputLabel-root':             { color: T.textMuted },
  '& .MuiInputLabel-root.Mui-focused': { color: T.teal },
  '& .MuiFormHelperText-root':         { color: T.textMuted },
  '& .MuiFormHelperText-root.Mui-error': { color: T.error },
  '& .MuiSelect-icon':                 { color: T.textMuted },
  '& input':                           { color: T.textPrimary },
});

export const getDialogSx = (T) => ({
  PaperProps: {
    sx: {
      bgcolor: T.sidebar,
      border: `1px solid ${T.glassBorder}`,
      color: T.textPrimary,
      width: '100%',
    },
  },
});

export const getTabSx = (T) => ({
  color: T.textMuted,
  '&.Mui-selected': { color: T.teal },
});
