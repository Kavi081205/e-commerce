import { lazy } from 'react';

export const lazyWithRetry = (importFn) => {
  return lazy(() => {
    return new Promise((resolve, reject) => {
      const key = `lazy-import-failed-${importFn.toString().replace(/\s+/g, '')}`;
      const hasFailed = sessionStorage.getItem(key);
      
      importFn()
        .then((module) => {
          sessionStorage.removeItem(key);
          resolve(module);
        })
        .catch((error) => {
          console.warn(`Dynamic import failed: ${error.message}. Retrying...`);
          if (!hasFailed) {
            sessionStorage.setItem(key, 'true');
            setTimeout(() => {
              importFn()
                .then((module) => {
                  sessionStorage.removeItem(key);
                  resolve(module);
                })
                .catch((retryError) => {
                  reject(retryError);
                  showRefreshConfirm();
                });
            }, 1500);
          } else {
            reject(error);
            showRefreshConfirm();
          }
        });
    });
  });
};

function showRefreshConfirm() {
  // Use a throttle check to prevent showing multiple confirms simultaneously if multiple dynamic imports fail together
  if (window.__isShowingRefreshConfirm) return;
  window.__isShowingRefreshConfirm = true;
  
  setTimeout(() => {
    if (window.confirm("A new version of the website is available. Click OK to refresh and apply updates.")) {
      window.location.reload();
    }
    window.__isShowingRefreshConfirm = false;
  }, 500);
}
