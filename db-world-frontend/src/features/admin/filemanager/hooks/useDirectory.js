import { useQuery } from '@tanstack/react-query';
import { listDirectory } from '../api/fileManagerApi';

/** Directory listing for a location + path, sorted server-side. */
export function useDirectory(locationId, path, sortBy, sortOrder) {
  return useQuery({
    queryKey: ['file-manager', locationId, path, sortBy, sortOrder],
    queryFn: () => listDirectory({ locationId, path, sortBy, order: sortOrder }),
    enabled: !!locationId,
    staleTime: 30_000,
  });
}
