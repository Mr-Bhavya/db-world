import { Box, Typography, Button } from '@mui/material';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useT } from '@shared/theme';
import SectionCard from './SectionCard';

const FALLBACK_ALLOTMENT_URL = 'https://www.bseindia.com/investors/appli_check.aspx';

/**
 * Allotment tab — placeholder for now: just the existing status + registrar deep-link.
 * Group N will extend this with the "My IPOs" saved-application + guided allotment check;
 * keep those additions inside this component so IpoDetailPage itself doesn't need to
 * change again to accommodate them.
 */
export default function AllotmentTab({ ipo }) {
  const T = useT();
  const registrarHref = ipo.registrarUrl || FALLBACK_ALLOTMENT_URL;
  return (
    <Box>
      <SectionCard title="Allotment status" icon={<FactCheckOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 12, color: T.textFaint }}>Status</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, mt: 0.25 }}>
              {ipo.allotmentStatus ?? 'Not available yet'}
            </Typography>
            {ipo.registrar && (
              <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.5 }}>
                Registrar: {ipo.registrar}
              </Typography>
            )}
          </Box>
          <Button
            variant="contained"
            endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
            component="a"
            href={registrarHref}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            Check allotment
          </Button>
        </Box>
      </SectionCard>
      {/* Seam for Group N: "My IPOs" saved-application + guided allotment check goes here. */}
    </Box>
  );
}
