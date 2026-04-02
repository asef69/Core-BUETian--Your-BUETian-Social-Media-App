import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing lists with loading, empty, and error states
 * Used for fetching and managing list data (posts, comments, etc.)
 */
export const useList = (fetchFunction, options = {}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const { autoFetch = true, page_size = 20 } = options;

  const fetchItems = useCallback(
    async (pageNum = 1) => {
      try {
        setLoading(true);
        setError(null);

        const result = await fetchFunction(pageNum);
        
        if (pageNum === 1) {
          setItems(result.data || result || []);
        } else {
          setItems(prev => [...prev, ...(result.data || result || [])]);
        }

        // Check if there are more pages
        setHasMore(result.length === page_size);
        setPage(pageNum);
      } catch (err) {
        setError({
          message: err.displayMessage || 'Failed to load items',
          details: err,
        });
        console.error('Error fetching items:', err);
      } finally {
        setLoading(false);
      }
    },
    [fetchFunction, page_size]
  );

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchItems(page + 1);
    }
  }, [loading, hasMore, page, fetchItems]);

  const refresh = useCallback(() => {
    fetchItems(1);
  }, [fetchItems]);

  const addItem = useCallback((item) => {
    setItems(prev => [item, ...prev]);
  }, []);

  const removeItem = useCallback((itemId) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const updateItem = useCallback((itemId, updates) => {
    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      )
    );
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchItems(1);
    }
  }, [autoFetch, fetchItems]);

  return {
    items,
    loading,
    error,
    hasMore,
    page,
    fetchItems,
    loadMore,
    refresh,
    addItem,
    removeItem,
    updateItem,
    isEmpty: items.length === 0 && !loading,
  };
};

export default useList;
