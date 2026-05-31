import { useQuery } from '@tanstack/react-query';
import {
  fetchAdminMediaRequestsPendingCount,
  fetchAdminCatalogRequestsPendingCount,
} from '@features/cinema/api/cinemaApi';

const ONE_MINUTE = 60_000;

/**
 * Shared hook for the admin sidebar / dashboard pending-request badge.
 * Polls the cheap /pending-count endpoint for both media and catalog requests
 * and sums them. Refetches every minute so the badge stays roughly live without
 * hammering the server.
 *
 * Keys are intentionally distinct from the list-query keys (`admin-media-requests`
 * etc.) — the badge must keep ticking even when no list view is mounted.
 */
export default function usePendingRequestCounts() {
  const media = useQuery({
    queryKey: ['admin-requests-pending-count', 'media'],
    queryFn: fetchAdminMediaRequestsPendingCount,
    staleTime: 30_000,
    refetchInterval: ONE_MINUTE,
    refetchOnWindowFocus: true,
  });
  const catalog = useQuery({
    queryKey: ['admin-requests-pending-count', 'catalog'],
    queryFn: fetchAdminCatalogRequestsPendingCount,
    staleTime: 30_000,
    refetchInterval: ONE_MINUTE,
    refetchOnWindowFocus: true,
  });

  const mediaCount   = Number(media.data?.count   ?? 0);
  const catalogCount = Number(catalog.data?.count ?? 0);

  return {
    media:    mediaCount,
    catalog:  catalogCount,
    total:    mediaCount + catalogCount,
    isLoading: media.isLoading || catalog.isLoading,
    isError:  media.isError || catalog.isError,
  };
}
