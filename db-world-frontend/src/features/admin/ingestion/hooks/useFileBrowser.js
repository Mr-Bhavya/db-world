import { useQuery } from '@tanstack/react-query';
import { browseFiles } from '../services/ingestionApi';

export function useFileBrowser(root, subPath = '') {
  return useQuery({
    queryKey: ['file-browser', root, subPath],
    queryFn:  () => browseFiles(root, subPath).then((r) => r.data),
    enabled:  !!root,
    staleTime: 10 * 1000,
  });
}
