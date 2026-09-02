import React from 'react';

/**
 * Enhanced React.lazy wrapper that automatically retries dynamic import failures
 * caused by temporary network disruptions, stale Vite dev server chunks, or deployment updates.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      console.warn('[lazyWithRetry] Dynamic import failed, retrying...', error);

      // Retry up to 2 times with exponential delay
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await new Promise((resolve) => setTimeout(resolve, attempt * 500));
          return await componentImport();
        } catch (retryError) {
          console.warn(`[lazyWithRetry] Retry attempt ${attempt} failed:`, retryError);
        }
      }

      // If retries failed, attempt a clean browser page reload once
      const reloadKey = 'boss_app_lazy_reload_attempted';
      const hasReloaded = sessionStorage.getItem(reloadKey);

      if (!hasReloaded) {
        sessionStorage.setItem(reloadKey, 'true');
        console.warn('[lazyWithRetry] Reloading page to clear stale module cache...');
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }

      // Reset reload flag for future navigations and propagate error
      sessionStorage.removeItem(reloadKey);
      throw error;
    }
  });
}
