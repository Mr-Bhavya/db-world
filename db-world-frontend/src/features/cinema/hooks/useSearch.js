import { useState, useEffect, useRef, useCallback } from 'react';
import { autocomplete, searchRecords } from '../api/cinemaApi';

const DEBOUNCE_MS = 300;

/**
 * Provides debounced search with:
 * - `suggestions` (autocomplete, fast)
 * - `results` (full search, paginated)
 */
export default function useSearch() {
  const [query,       setQuery]       = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [results,     setResults]     = useState(null);  // Page<RecordDto>
  const [loading,     setLoading]     = useState(false);

  const timer    = useRef(null);
  const abortRef = useRef(null);

  const clear = useCallback(() => {
    setQuery('');
    setSuggestions([]);
    setResults(null);
  }, []);

  // Autocomplete: fast suggestions as user types
  useEffect(() => {
    clearTimeout(timer.current);
    if (!query.trim()) { setSuggestions([]); return; }

    timer.current = setTimeout(async () => {
      try {
        const data = await autocomplete(query.trim());
        setSuggestions(data ?? []);
      } catch { /* silent */ }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer.current);
  }, [query]);

  // Full search: triggered on Enter / submit
  const search = useCallback(async (q = query, page = 0) => {
    if (!q.trim()) return;
    abortRef.current?.abort();
    setLoading(true);
    setResults(null);
    try {
      const data = await searchRecords(q.trim(), page);
      setResults(data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [query]);

  return { query, setQuery, suggestions, results, loading, search, clear };
}
