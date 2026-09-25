import { isAuthenticated, getCurrentUser } from './auth.js';
import { renderCurrentRoute, initRouter } from './router.js';
import { showSidebar } from './components/sidebar.js';
import { renderHeader } from './components/header.js';
import { showToast } from './components/toast.js';

function buildShell() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="app-shell">
      <aside id="sidebar" class="sidebar"></aside>
      <div class="content-shell">
        <header id="app-header" class="app-header"></header>
        <main id="content-area" class="content-area"></main>
      </div>
    </div>
    <div id="toast-container" class="toast-container"></div>
    <div id="modal-root"></div>
  `;

  const sidebar = document.getElementById('sidebar');
  const header = document.getElementById('app-header');

  const routeObserver = () => {
    const currentHash = window.location.hash || '#/dashboard';
    if (sidebar) {
      showSidebar(sidebar, { currentRoute: currentHash });
      if (currentHash === '#/login') {
        sidebar.style.display = 'none';
      } else {
        sidebar.style.display = '';
      }
    }

    if (header) {
      renderHeader(header, { user: getCurrentUser() });
      if (currentHash === '#/login') {
        header.style.display = 'none';
      } else {
        header.style.display = '';
      }
    }
  };

  window.addEventListener('hashchange', routeObserver);
  routeObserver();

  return { sidebar, header };
}

async function bootstrap() {
  buildShell();
  initRouter(document.getElementById('content-area'));
}

window.addEventListener('DOMContentLoaded', bootstrap);
window.showToast = showToast;
