import { getCurrentUser, logout } from '../auth.js';
import { hasPermission } from '../permissions.js';

const navItems = [
  { group: 'Principal', label: 'Dashboard', path: '/dashboard', icon: '🏠', module: 'dashboard' },
  { group: 'Cadastros', label: 'Clientes', path: '/clientes', icon: '👥', module: 'clientes' },
  { group: 'Cadastros', label: 'Pets', path: '/pets', icon: '🐾', module: 'pets' },
  { group: 'Cadastros', label: 'Serviços', path: '/servicos', icon: '🧰', module: 'servicos' },
  { group: 'Cadastros', label: 'Produtos', path: '/produtos', icon: '📦', module: 'produtos' },
  { group: 'Cadastros', label: 'Usuários', path: '/usuarios', icon: '👤', module: 'usuarios' },
  { group: 'Agenda', label: 'Agendamentos', path: '/agendamentos', icon: '📅', module: 'agendamentos' },
  { group: 'Operações', label: 'Estoque', path: '/estoque', icon: '📊', module: 'estoque' },
  { group: 'Operações', label: 'Vendas', path: '/vendas', icon: '🧾', module: 'vendas' },
  { group: 'Saúde', label: 'Vacinas', path: '/vacinas', icon: '💉', module: 'vacinas' },
  { group: 'Saúde', label: 'Consultas', path: '/consultas', icon: '🩺', module: 'consultas' },
  { group: 'Saúde', label: 'Medicamentos', path: '/medicamentos', icon: '💊', module: 'medicamentos' },
  { group: 'Saúde', label: 'Exames', path: '/exames', icon: '🧪', module: 'exames' },
  { group: 'Saúde', label: 'Prontuário', path: '/prontuario', icon: '📋', module: 'prontuario' },
  { group: 'Relatórios', label: 'Relatórios', path: '/relatorios', icon: '📈', module: 'relatorios' },
  { group: 'Notificações', label: 'Notificações', path: '/notificacoes', icon: '🔔', module: 'notificacoes' }
];

export function showSidebar(root, { currentRoute = '#/dashboard' } = {}) {
  const user = getCurrentUser();
  const activePath = currentRoute.startsWith('#') ? currentRoute.slice(1) : currentRoute;
  const isCollapsed = root.dataset.collapsed === 'true';

  const visibleItems = navItems.filter((item) => {
    if (item.module === 'dashboard') return true;
    return hasPermission(item.module, 'visualizar');
  });

  const grouped = {};
  visibleItems.forEach((item) => {
    if (!grouped[item.group]) grouped[item.group] = [];
    grouped[item.group].push(item);
  });

  root.classList.toggle('collapsed', isCollapsed);
  root.dataset.collapsed = String(isCollapsed);

  const html = `
    <div class="sidebar-header">
      <div class="brand-block">
        <div class="brand-mark">🐶</div>
        <div class="brand-copy">PetShop</div>
      </div>
      <button
        class="sidebar-toggle"
        type="button"
        aria-label="${isCollapsed ? 'Expandir menu' : 'Recolher menu'}"
        title="${isCollapsed ? 'Expandir menu' : 'Recolher menu'}"
      >☰</button>
    </div>
    <nav class="sidebar-nav">
      ${Object.entries(grouped).map(([groupName, items]) => `
        <div class="nav-group">
          <div class="nav-group-title">${groupName}</div>
          ${items.map((item) => `
            <a class="nav-item ${activePath === item.path ? 'active' : ''}" href="#${item.path}">
              <span class="nav-icon">${item.icon}</span>
              <span class="nav-label">${item.label}</span>
            </a>
          `).join('')}
        </div>
      `).join('')}
    </nav>
    <div class="sidebar-footer">
      <div class="user-chip">
        <div class="user-avatar">${(user?.nome || 'U').charAt(0).toUpperCase()}</div>
        <div class="user-meta">
          <div class="user-name">${user?.nome || 'Usuário'}</div>
          <div class="user-role">${user?.perfil || 'Perfil'}</div>
        </div>
      </div>
      <button class="logout-btn" type="button" id="sidebar-logout-btn" aria-label="Sair">
        <span class="logout-label">Sair</span>
      </button>
    </div>
  `;

  root.innerHTML = html;

  document.getElementById('sidebar-logout-btn')?.addEventListener('click', () => {
    logout();
  });

  const toggleBtn = root.querySelector('.sidebar-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const nextCollapsed = !root.classList.contains('collapsed');
      root.classList.toggle('collapsed', nextCollapsed);
      root.dataset.collapsed = String(nextCollapsed);
      toggleBtn.setAttribute('aria-label', nextCollapsed ? 'Expandir menu' : 'Recolher menu');
      toggleBtn.setAttribute('title', nextCollapsed ? 'Expandir menu' : 'Recolher menu');
    });
  }
}
