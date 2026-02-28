import { useState, useCallback, useMemo } from 'react';

export interface SavedView {
  id: string;
  name: string;
  filters: Record<string, string>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  createdAt: string;
}

interface UseSavedViewsOptions {
  pageKey: string;
}

function getStorageKey(pageKey: string): string {
  return `tmprm_saved_views_${pageKey}`;
}

export function useSavedViews({ pageKey }: UseSavedViewsOptions) {
  const storageKey = getStorageKey(pageKey);

  const [views, setViews] = useState<SavedView[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const persist = useCallback(
    (updatedViews: SavedView[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedViews));
      } catch {
        // localStorage full
      }
      setViews(updatedViews);
    },
    [storageKey],
  );

  const saveView = useCallback(
    (name: string, filters: Record<string, string>, sortBy?: string, sortOrder?: 'asc' | 'desc') => {
      const newView: SavedView = {
        id: `view_${Date.now()}`,
        name,
        filters,
        sortBy,
        sortOrder,
        createdAt: new Date().toISOString(),
      };
      const updated = [...views, newView];
      persist(updated);
      setActiveViewId(newView.id);
      return newView;
    },
    [views, persist],
  );

  const deleteView = useCallback(
    (viewId: string) => {
      const updated = views.filter((v) => v.id !== viewId);
      persist(updated);
      if (activeViewId === viewId) {
        setActiveViewId(null);
      }
    },
    [views, persist, activeViewId],
  );

  const applyView = useCallback(
    (viewId: string): SavedView | null => {
      const view = views.find((v) => v.id === viewId);
      if (view) {
        setActiveViewId(viewId);
        return view;
      }
      return null;
    },
    [views],
  );

  const clearActiveView = useCallback(() => {
    setActiveViewId(null);
  }, []);

  const activeView = useMemo(() => views.find((v) => v.id === activeViewId) || null, [views, activeViewId]);

  return {
    views,
    activeView,
    activeViewId,
    saveView,
    deleteView,
    applyView,
    clearActiveView,
  };
}
