import { useEffect, useRef, useState } from 'react';

/**
 * useServiceWorker
 * ─────────────────────────────────────────────────────────────────────────────
 * Registers /sw.js and listens for updates. When a new SW version is waiting,
 * sets `updateAvailable = true` and exposes `applyUpdate()` to trigger the
 * controlled refresh (SKIP_WAITING → reload).
 *
 * Returns: { updateAvailable: boolean, applyUpdate: () => void }
 *
 * Usage in App:
 *   const { updateAvailable, applyUpdate } = useServiceWorker();
 *   // Show a non-blocking toast when updateAvailable is true
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function useServiceWorker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const waitingWorkerRef = useRef(null);

  useEffect(() => {
    // Service workers are only supported in production-like environments
    if (!('serviceWorker' in navigator)) return;

    let registration = null;

    const onUpdateFound = () => {
      const newWorker = registration?.installing;
      if (!newWorker) return;

      const onStateChange = () => {
        if (
          newWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          // A new SW is installed and waiting — there's an existing controller,
          // meaning the user already has a version running.
          console.log('[SW] New version installed and waiting to activate.');
          waitingWorkerRef.current = newWorker;
          setUpdateAvailable(true);
        }
      };

      newWorker.addEventListener('statechange', onStateChange);
    };

    const registerSW = async () => {
      try {
        registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          // updateViaCache: 'none' ensures the SW file itself is never served
          // from the browser's HTTP cache (critical for cache busting).
          updateViaCache: 'none',
        });

        console.log('[SW] Registered. Scope:', registration.scope);

        // Already have a waiting worker from a previous install? Surface it.
        if (registration.waiting && navigator.serviceWorker.controller) {
          waitingWorkerRef.current = registration.waiting;
          setUpdateAvailable(true);
        }

        registration.addEventListener('updatefound', onUpdateFound);

        // Periodically check for updates (every 60 s on mobile to catch deploys)
        const intervalId = setInterval(() => {
          registration.update().catch(() => {
            // Silently ignore update check failures (offline, etc.)
          });
        }, 60_000);

        return () => {
          clearInterval(intervalId);
          registration.removeEventListener('updatefound', onUpdateFound);
        };
      } catch (err) {
        console.warn('[SW] Registration failed:', err);
      }
    };

    // Handle the case where a new SW activates and controller changes
    const onControllerChange = () => {
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    registerSW();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  /**
   * applyUpdate — tell the waiting SW to skip waiting and take control.
   * The `controllerchange` listener above will reload the page automatically.
   */
  const applyUpdate = () => {
    if (waitingWorkerRef.current) {
      waitingWorkerRef.current.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  return { updateAvailable, applyUpdate };
}
