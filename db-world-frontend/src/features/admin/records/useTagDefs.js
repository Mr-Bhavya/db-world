import { useQuery } from '@tanstack/react-query';
import { getTagDefinitions } from '../api/adminApi';
import { TAG_COLORS, TAG_LABELS, AUTO_TAGS, ALL_TAGS } from './tagConstants';

const FALLBACK_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#ec4899', '#06b6d4', '#8b5cf6', '#f97316',
];

let colorIdx = 0;
const dynamicColors = {};

function resolveColor(tagType) {
  if (TAG_COLORS[tagType]) return TAG_COLORS[tagType];
  if (!dynamicColors[tagType]) {
    dynamicColors[tagType] = FALLBACK_COLORS[colorIdx % FALLBACK_COLORS.length];
    colorIdx++;
  }
  return dynamicColors[tagType];
}

const STATIC_DEFS = ALL_TAGS.map(tagType => ({
  tagType,
  displayName: TAG_LABELS[tagType] ?? tagType.replace(/_/g, ' '),
  automatic: AUTO_TAGS.has(tagType),
  active: true,
}));

export function useTagDefs() {
  const { data: fetched = [], isLoading } = useQuery({
    queryKey:  ['tagDefinitions'],
    queryFn:   getTagDefinitions,
    staleTime: 60_000,
  });

  // Fall back to static constants if API hasn't returned anything yet
  const defs = fetched.length > 0 ? fetched : STATIC_DEFS;

  const autoTagTypes  = new Set(defs.filter(d => d.automatic).map(d => d.tagType));
  const manualTagDefs = defs.filter(d => !d.automatic && d.active !== false);

  const tagColor = (tagType) => resolveColor(tagType);
  const tagLabel = (tagType) => {
    const def = defs.find(d => d.tagType === tagType);
    return def?.displayName ?? tagType.replace(/_/g, ' ');
  };

  return { defs, autoTagTypes, manualTagDefs, tagColor, tagLabel, isLoading };
}
