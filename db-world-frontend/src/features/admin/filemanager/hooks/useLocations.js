import { useQuery } from '@tanstack/react-query';
import { listLocations } from '../api/fileManagerApi';

/** All configured file-manager locations (roots), enabled or not. */
export function useLocations() {
  return useQuery({
    queryKey: ['file-manager', 'locations'],
    queryFn: listLocations,
  });
}
