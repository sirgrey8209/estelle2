import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'estelle:favoriteWorkspaces';

/**
 * 즐겨찾기 워크스페이스 관리 훅
 * - workspaceId 기반으로 즐겨찾기 상태 관리
 * - localStorage에 영구 저장
 */
export function useFavoriteWorkspaces() {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // localStorage에 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
    } catch {
      // 무시
    }
  }, [favorites]);

  const isFavorite = useCallback(
    (workspaceId: string) => favorites.has(workspaceId),
    [favorites]
  );

  const toggleFavorite = useCallback((workspaceId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(workspaceId)) {
        next.delete(workspaceId);
      } else {
        next.add(workspaceId);
      }
      return next;
    });
  }, []);

  const addFavorite = useCallback((workspaceId: string) => {
    setFavorites((prev) => new Set([...prev, workspaceId]));
  }, []);

  const removeFavorite = useCallback((workspaceId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      next.delete(workspaceId);
      return next;
    });
  }, []);

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
  };
}
