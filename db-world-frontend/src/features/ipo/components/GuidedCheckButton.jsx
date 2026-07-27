import { Box, Button, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import { useT } from '@shared/theme';

export const FALLBACK_ALLOTMENT_URL = 'https://www.bseindia.com/investors/appli_check.aspx';

/**
 * "Check allotment status" — the ONE guided-check action shared by the Allotment tab and the
 * My IPOs list. A fully-automatic PAN check isn't possible: registrar/BSE allotment pages
 * require a CAPTCHA, so this never submits anything on the user's behalf — it just opens the
 * right page in a new tab and tells them, in one line, what to do once they're there.
 */
export default function GuidedCheckButton({ registrarUrl, emphasize, fullWidth, size = 'medium' }) {
  const T = useT();
  const href = registrarUrl || FALLBACK_ALLOTMENT_URL;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
      <Button
        variant="contained"
        size={size}
        fullWidth={fullWidth}
        endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
        component="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        sx={{
          bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, whiteSpace: 'nowrap', flexShrink: 0,
          ...(emphasize && { boxShadow: `0 0 0 3px ${T.tealBg}` }),
        }}
      >
        Check allotment status
      </Button>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.4 }}>
        <HelpOutlineRoundedIcon sx={{ fontSize: 13, color: T.textFaint, mt: 0.2, flexShrink: 0 }} />
        <Typography sx={{ fontSize: 11, color: T.textFaint, lineHeight: 1.4 }}>
          Opens your registrar&rsquo;s page — enter your PAN &amp; the captcha there.
        </Typography>
      </Box>
    </Box>
  );
}
