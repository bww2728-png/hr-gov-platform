import { useEffect, useState } from 'react';
import client from '../api/client';

/**
 * Loads a list of lookups by category, with optional parent filter.
 * Caches per category for the session.
 */
const cache = new Map();

export function useLookups(category, parent) {
  const [data, setData] = useState(cache.get(`${category}|${parent || ''}`) || []);
  const [loading, setLoading] = useState(!cache.has(`${category}|${parent || ''}`));

  useEffect(() => {
    let cancelled = false;
    const key = `${category}|${parent || ''}`;
    if (cache.has(key)) { setData(cache.get(key)); setLoading(false); return; }
    (async () => {
      try {
        const params = {};
        if (category) params.category = category;
        if (parent) { params.category = category; params.parent = parent; }
        const { data } = await client.get('/lookups', { params });
        if (cancelled) return;
        cache.set(key, data.lookups);
        setData(data.lookups);
      } finally { setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [category, parent]);

  return { lookups: data, loading };
}

export function clearLookupCache() { cache.clear(); }