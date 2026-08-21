import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTagDefinitions } from '../api/adminApi';
import { tagColorFor, humanizeTagType } from './tagConstants';

/**
 * The single source of truth for tag metadata in the admin UI.
 *
 * Everything comes from `GET /tags/definitions`, which the backend reconciles against the
 * registered TagStrategy beans on boot. In particular `automatic` is authoritative: it means
 * "code exists to recompute this tag", so anything the scheduler would overwrite is never
 * offered for manual editing. Adding a tag on the backend needs no change here.
 */
export function useTagDefs() {
  const { data: defs = [], isLoading } = useQuery({
    queryKey:  ['tagDefinitions'],
    queryFn:   getTagDefinitions,
    staleTime: 60_000,
  });

  // Tags the scheduler recomputes — manual edits to these would be silently wiped, so callers
  // use this to hide add/remove controls.
  const autoTagTypes = useMemo(
    () => new Set(defs.filter(d => d.automatic).map(d => d.tagType)),
    [defs],
  );

  // Tags an admin may curate by hand: no strategy, and not deactivated.
  const manualTagDefs = useMemo(
    () => defs.filter(d => !d.automatic && d.active !== false),
    [defs],
  );

  /** All known tag types, in the order the backend returned them. */
  const allTagTypes = useMemo(() => defs.map(d => d.tagType), [defs]);

  // Memoised so callers can list these in a useCallback/useEffect dependency array without
  // the identity churning on every render.
  const tagColor = useCallback((tagType) => tagColorFor(tagType), []);

  const tagLabel = useCallback((tagType) => {
    const def = defs.find(d => d.tagType === tagType);
    return def?.displayName ?? humanizeTagType(tagType);
  }, [defs]);

  return { defs, allTagTypes, autoTagTypes, manualTagDefs, tagColor, tagLabel, isLoading };
}
