import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { useT } from '@shared/theme';

/**
 * Tail of an infinitely scrolled list: hosts the sentinel and shows loading,
 * load-more retry, or end-of-results state.
 */
export default function InfiniteListFooter({
  sentinelRef, isFetchingNextPage, hasNextPage, isNextPageError, onRetry, loaded, total,
}) {
  const T = useT();

  return (
    <Box ref={sentinelRef} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, py: 1.5, minHeight: 40 }}>
      {isFetchingNextPage && <CircularProgress size={20} sx={{ color: T.teal }} />}
      {!isFetchingNextPage && isNextPageError && (
        <>
          <Typography sx={{ fontSize: 12, color: T.error }}>Couldn&apos;t load more results.</Typography>
          <Button size="small" onClick={() => onRetry?.()} sx={{ textTransform: 'none', color: T.teal }}>Retry</Button>
        </>
      )}
      {!isFetchingNextPage && !isNextPageError && !hasNextPage && loaded > 0 && (
        <Typography sx={{ fontSize: 11.5, color: T.textFaint }}>
          {total > loaded ? `Showing ${loaded} of ${total}` : `All ${loaded} result${loaded === 1 ? '' : 's'} shown`}
        </Typography>
      )}
    </Box>
  );
}
