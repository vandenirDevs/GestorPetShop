import { getCurrentUser, logout } from '../auth.js';
import { api } from '../api.js';

function closeAllUserMenus() {
  document.querySelectorAll('.user-dropdown').forEach((menu) => menu.classList.add('hidden'));
  document.querySelectorAll('.user-menu-button').forEach((button) => button.setAttribute('aria-expanded', 'false'));
}

if (!window.__petshopUserMenuHandlers) {
  window.__petshopUserMenuHandlers = true;

  document.addEventListener('click', (event) => {
    const clickedButton = event.target.closest('.user-menu-button');
    const clickedMenu = event.target.closest('.user-dropdown');

    if (!clickedButton && !clickedMenu) {
      closeAllUserMenus();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAllUserMenus();
    }
  });
}

export async function renderHeader(root, { user } = {}) {
  const currentUser = user || getCurrentUser();
  let notificationsCount = 0;

  if (currentUser) {
    try {
      const data = await api.get('/api/notificacoes/minhas');
      notificationsCount = data?.nao_lidas || 0;
    } catch {
      notificationsCount = 0;
    }
  }

  const currentRoute = (window.location.hash || '#/dashboard').replace('#', '');
  const titleMap = {
    '/dashboard': 'Dashboard',
    '/usuarios': 'Usuários',
    '/clientes': 'Clientes',
    '/pets': 'Pets',
    '/servicos': 'Serviços',
    '/agendamentos': 'Agendamentos',
    '/produtos': 'Produtos',
    '/estoque': 'Estoque',
    '/vendas': 'Vendas',
    '/vacinas': 'Vacinas',
    '/consultas': 'Consultas',
    '/medicamentos': 'Medicamentos',
    '/exames': 'Exames',
    '/prontuario': 'Prontuário',
    '/relatorios': 'Relatórios',
    '/notificacoes': 'Notificações',
    '/login': 'Login'
  };

  const userMenuMarkup = currentUser ? `
    <div class="user-menu-wrap">
      <button
        type="button"
        class="user-menu-button"
        aria-expanded="false"
        aria-controls="user-dropdown-menu"
      >
        <div class="user-avatar" style="background: rgba(46,139,87,0.12); color: var(--primary);">${(currentUser?.nome || 'U').charAt(0).toUpperCase()}</div>
        <div class="user-meta">
          <div class="user-name" style="color: var(--text); font-size: 0.9rem;">${currentUser?.nome || 'Usuário'}</div>
          <div class="user-role" style="font-size: 0.72rem;">${currentUser?.perfil || 'Perfil'}</div>
        </div>
        <span class="user-menu-caret">▾</span>
      </button>
      <div id="user-dropdown-menu" class="user-dropdown hidden" role="menu" aria-label="Menu do usuário">
        <button type="button" class="user-dropdown-item danger" data-action="logout">
          🚪 Sair
        </button>
      </div>
    </div>
  ` : '';

  root.innerHTML = `
    <div>
      <h2>${titleMap[currentRoute] || 'Painel'}</h2>
    </div>
    <div class="header-actions">
      <div class="notification-pill" title="Notificações">
        🔔
        ${notificationsCount > 0 ? `<span class="notification-badge">${notificationsCount}</span>` : ''}
      </div>
      ${userMenuMarkup}
    </div>
  `;

  const userButton = root.querySelector('.user-menu-button');
  const userMenu = root.querySelector('.user-dropdown');

  if (userButton && userMenu) {
    userButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = userButton.getAttribute('aria-expanded') === 'true';

      closeAllUserMenus();

      if (!isOpen) {
        userMenu.classList.remove('hidden');
        userButton.setAttribute('aria-expanded', 'true');
      }
    });

    userMenu.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]');
      if (action?.dataset.action === 'logout') {
        logout();
      }
    });
  }
}
