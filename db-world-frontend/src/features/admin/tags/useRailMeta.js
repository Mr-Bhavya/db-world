import { useQuery } from '@tanstack/react-query';
import { getRailMetadata } from '../api/adminApi';

/**
 * Rail editor dropdown options from the backend. Cached under one key with staleTime Infinity,
 * so every caller shares a single request.
 */
export function useRailMeta() {
  const { data: meta } = useQuery({
    queryKey:  ['railMetadata'],
    queryFn:   getRailMetadata,
    staleTime: Infinity,
  });
  return {
    meta,
    sortFields: meta?.sortFields ?? [],
    // [{ value, label, description }] straight from RailRuleTypes. Served rather than hardcoded
    // because the frontend's own list had drifted — it offered 8 of the 10 the resolver handles,
    // so `forYou` and `rewatchTrending` were working rails nobody could create.
    ruleTypes:  meta?.ruleTypes  ?? [],
    // Watch providers actually present in the catalogue ([{ id, name, logoPath }]), for the
    // "only on Netflix / Hotstar / Prime" tag rule. Empty until TMDB provider data is ingested.
    providers:     meta?.providers     ?? [],
    providerTypes: meta?.providerTypes ?? [],
    // Every field a tag rule can filter on, discovered by the backend from the JPA metamodel:
    // [{ value, label, type, operators:[{value,label}], options }]. A new column shows up here
    // automatically, which is why the condition builder needs no per-field code.
    filterFields:  meta?.filterFields  ?? [],
    genres:        meta?.genres        ?? [],
  };
}
