import { isAuthenticated, getCurrentUser } from './auth.js';
import { loadPermissions, clearPermissions, canAccessMenu } from './permissions.js';
import { notify } from './utils.js';

import * as loginPage from './pages/login.js';
import * as dashboardPage from './pages/dashboard.js';
import * as usuariosPage from './pages/usuarios.js';
import * as clientesPage from './pages/clientes.js';
import * as petsPage from './pages/pets.js';
import * as servicosPage from './pages/servicos.js';
import * as agendamentosPage from './pages/agendamentos.js';
import * as produtosPage from './pages/produtos.js';
import * as estoquePage from './pages/estoque.js';
import * as vendasPage from './pages/vendas.js';
import * as vacinasPage from './pages/vacinas.js';
import * as consultasPage from './pages/consultas.js';
import * as medicamentosPage from './pages/medicamentos.js';
import * as examesPage from './pages/exames.js';
import * as prontuarioPage from './pages/prontuario.js';
import * as relatoriosPage from './pages/relatorios.js';
import * as notificacoesPage from './pages/notificacoes.js';

export const routes = {
  '/login': loginPage,
  '/dashboard': dashboardPage,
  '/usuarios': usuariosPage,
  '/clientes': clientesPage,
  '/pets': petsPage,
  '/servicos': servicosPage,
  '/agendamentos': agendamentosPage,
  '/produtos': produtosPage,
  '/estoque': estoquePage,
  '/vendas': vendasPage,
  '/vacinas': vacinasPage,
  '/consultas': consultasPage,
  '/medicamentos': medicamentosPage,
  '/exames': examesPage,
  '/prontuario': prontuarioPage,
  '/relatorios': relatoriosPage,
  '/notificacoes': notificacoesPage
};

export function normalizeRoute(hash = window.location.hash) {
  const safe = hash.startsWith('#') ? hash.slice(1) : hash;
  const route = safe || '/dashboard';
  return route.startsWith('/') ? route : `/${route}`;
}

export function navigate(path) {
  window.location.hash = path.startsWith('/') ? path : `/${path}`;
}

export async function renderCurrentRoute(appRoot) {
  const route = normalizeRoute();
  const isLogged = isAuthenticated();

  const appShell = document.querySelector('.app-shell');
  if (appShell) {
    appShell.classList.toggle('login-mode', route === '/login');
    const sidebar = document.getElementById('sidebar');
    const header = document.getElementById('app-header');
    if (sidebar) sidebar.style.display = route === '/login' ? 'none' : '';
    if (header) header.style.display = route === '/login' ? 'none' : '';
  }

  if (!isLogged && route !== '/login') {
    window.location.hash = '#/login';
    return;
  }

  if (isLogged && route === '/login') {
    window.location.hash = '#/dashboard';
    return;
  }

  if (isLogged && !window.__permissionsLoaded) {
    try {
      await loadPermissions();
      window.__permissionsLoaded = true;
    } catch (error) {
      clearPermissions();
      notify('error', 'Não foi possível carregar as permissões do usuário.');
      return;
    }
  }

  const pageModule = routes[route] || dashboardPage;
  const page = await pageModule.render(appRoot, { route });

  const user = getCurrentUser();
  const hasAccess = isLogged ? route === '/dashboard' || canAccessMenu(route.replace('/', '')) : true;

  if (isLogged && route !== '/login' && !hasAccess && user) {
    notify('warning', 'Você não tem acesso a este módulo.');
    window.location.hash = '#/dashboard';
    return;
  }

  return page;
}

export function initRouter(appRoot) {
  if (window.__routerInitialized) {
    return;
  }

  const onHashChange = () => renderCurrentRoute(appRoot);
  window.addEventListener('hashchange', onHashChange);
  window.__routerInitialized = true;

  if (!window.location.hash) {
    window.location.hash = '#/login';
    return;
  }

  onHashChange();
}
