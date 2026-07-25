import { Box } from '@mui/material';
import SubscriptionChart from './SubscriptionChart';

/** Subscription tab — multi-line QIB/NII/Retail/Total chart over time. */
export default function SubscriptionTab({ points, loading }) {
  return (
    <Box>
      <SubscriptionChart points={points} loading={loading} />
    </Box>
  );
}
