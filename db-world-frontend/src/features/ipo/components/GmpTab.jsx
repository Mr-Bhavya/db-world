import { Box } from '@mui/material';
import GmpChart from './GmpChart';
import IpoGuruAttribution from './IpoGuruAttribution';

/**
 * GMP tab — dual-axis (₹/%) chart with the (contractual) IPO Guru attribution kept
 * prominent right next to the data it credits.
 */
export default function GmpTab({ points, loading }) {
  return (
    <Box>
      <IpoGuruAttribution />
      <GmpChart points={points} loading={loading} />
    </Box>
  );
}
