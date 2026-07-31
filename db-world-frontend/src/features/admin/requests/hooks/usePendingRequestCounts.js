import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminMediaRequestsPendingCount,
  fetchAdminCatalogRequestsPendingCount,
} from '@features/cinema/api/cinemaApi';

const PENDING_KEY = 'admin-requests-pending-count';
const REQUESTS_CHANGED_EVENT = 'admin:requests-changed';

/**
 * Fire this whenever the pending-request set may have changed, so the sidebar
 * badge refreshes WITHOUT polling. Call it from:
 *   • the push-notification handler when a "new request" push arrives, and
 *   • request approve/reject mutations (onSuccess).
 */
export const notifyRequestsChanged = () =>
  window.dispatchEvent(new Event(REQUESTS_CHANGED_EVENT));

/**
 * Pending-request counts for the admin sidebar / dashboard badge.
 *
 * Previously this POLLED both endpoints every 60s from the always-mounted admin
 * layout — constant background load. Now it's event-driven: fetch once, refresh
 * on window focus, and refresh when `notifyRequestsChanged()` fires (push
 * notification or a request action). No interval → no idle API load.
 */
export default function usePendingRequestCounts() {
  const qc = useQueryClient();

  const media = useQuery({
    queryKey: [PENDING_KEY, 'media'],
    queryFn: fetchAdminMediaRequestsPendingCount,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
  const catalog = useQuery({
    queryKey: [PENDING_KEY, 'catalog'],
    queryFn: fetchAdminCatalogRequestsPendingCount,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const handler = () => qc.invalidateQueries({ queryKey: [PENDING_KEY] });
    window.addEventListener(REQUESTS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(REQUESTS_CHANGED_EVENT, handler);
  }, [qc]);

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
