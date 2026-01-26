'use client';

/**
 * Service Worker Registration Component
 * Registers the PWA service worker for offline support
 */

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Only register service worker in production or when explicitly enabled
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[Service Worker] Registered successfully:', registration.scope);

            // Check for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New version available
                    console.log('[Service Worker] New version available');
                    // You could show a toast notification here
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.error('[Service Worker] Registration failed:', error);
          });
      });
    }
  }, []);

  return null;
}
