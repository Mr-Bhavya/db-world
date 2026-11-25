import { useMemo, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useT } from '@shared/theme';

const PAGE_SIZE = 300;

export function useVisibleItems(items) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const visibleItems = useMemo(() => items.slice(0, limit), [items, limit]);
  return {
    visibleItems,
    showMore: () => setLimit((current) => current + PAGE_SIZE),
  };
}

export function ShowMoreItems({ visibleCount, total, onShowMore }) {
  const T = useT();
  if (visibleCount >= total) return null;
  return (
    <Box sx={{ px: 2, py: 1.5, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 12, color: T.textMuted }}>
        Showing {visibleCount} of {total}
      </Typography>
      <Button onClick={onShowMore} sx={{ color: T.teal }}>Show more</Button>
    </Box>
  );
}
