import { Box, Typography } from '@mui/material';
import { useT } from '@shared/theme';

/** Shared glass-card section shell used across the detail page (timeline, issue details,
 * about, allotment...) and the on-demand FinancialsTable, so they read as one system. */
export default function SectionCard({ title, icon, children }) {
  const T = useT();
  return (
    <Box sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 3, p: { xs: 1.5, sm: 2 }, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
        {icon}
        <Typography sx={{ fontSize: 11, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
          {title}
        </Typography>
      </Box>
      {children}
    </Box>
  );
}
