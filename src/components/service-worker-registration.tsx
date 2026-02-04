'use client';

/**
 * Service Worker Registration Component
 * Registers the PWA service worker for offline support
 */

import { useEffect, useRef } from 'react';
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export function ServiceWorkerRegistration() {
  const hasRefreshed = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }

    if (!('serviceWorker' in navigator)) {
      const onManualCheck = () => {
        toast({ title: 'Updates', description: 'Service workers are not supported on this device.' });
      };
      window.addEventListener('pwa:check-updates', onManualCheck as EventListener);
      return () => {
        window.removeEventListener('pwa:check-updates', onManualCheck as EventListener);
      };
    }

    const manualUpdateCheck = async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        toast({ title: 'Updates', description: 'Service worker not installed yet.' });
        return;
      }

      await reg.update();

      if (reg.waiting) {
        toast({
          title: "Update available",
          description: "A new version is ready. Refresh to update.",
          action: (
            <ToastAction
              altText="Refresh"
              onClick={() => {
                reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
              }}
            >
              Refresh
            </ToastAction>
          ),
        });
      } else {
        toast({ title: 'Up to date', description: 'You already have the latest version.' });
      }
    };

    const onManualCheck = () => {
      manualUpdateCheck().catch((error) => {
        console.error('[Service Worker] Manual update failed:', error);
        toast({ title: 'Update check failed', description: 'Please try again.' });
      });
    };

    window.addEventListener('pwa:check-updates', onManualCheck as EventListener);

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[Service Worker] Registered successfully:', registration.scope);

          if (registration.waiting && navigator.serviceWorker.controller) {
            toast({
              title: "Update available",
              description: "A new version is ready. Refresh to update.",
              action: (
                <ToastAction
                  altText="Refresh"
                  onClick={() => {
                    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
                  }}
                >
                  Refresh
                </ToastAction>
              ),
            });
          }

          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version available
                  console.log('[Service Worker] New version available');
                  toast({
                    title: "Update available",
                    description: "A new version is ready. Refresh to update.",
                    action: (
                      <ToastAction
                        altText="Refresh"
                        onClick={() => {
                          if (registration.waiting) {
                            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                          }
                        }}
                      >
                        Refresh
                      </ToastAction>
                    ),
                  });
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('[Service Worker] Registration failed:', error);
        });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
    }

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hasRefreshed.current) {
        return;
      }
      hasRefreshed.current = true;
      window.location.reload();
    });

    const updateOnFocus = () => {
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update());
    };

    window.addEventListener('focus', updateOnFocus);
    window.addEventListener('online', updateOnFocus);

    return () => {
      window.removeEventListener('focus', updateOnFocus);
      window.removeEventListener('online', updateOnFocus);
      window.removeEventListener('pwa:check-updates', onManualCheck as EventListener);
      window.removeEventListener('load', register);
    };
  }, []);

  return null;
}
