import { Box, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useT } from '@shared/theme';

/**
 * Contractual attribution for the free IPO Guru GMP feed. Must stay clearly visible
 * next to the GMP data it credits — do not tuck this into a footer or a tooltip.
 */
export default function IpoGuruAttribution() {
  const T = useT();
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
      px: 1.5, py: 1, borderRadius: 2, mb: 1.5,
      bgcolor: T.tealBg, border: `1px solid ${T.teal}33`,
    }}>
      <InfoOutlinedIcon sx={{ fontSize: 16, color: T.teal, flexShrink: 0 }} />
      <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>
        GMP data sourced from{' '}
        <Box
          component="a"
          href="https://www.ipoguru.in"
          target="_blank"
          rel="noopener noreferrer"
          sx={{ color: T.teal, fontWeight: 800, textDecoration: 'underline', '&:hover': { color: T.tealHover } }}
        >
          IPO Guru
        </Box>
      </Typography>
    </Box>
  );
}
