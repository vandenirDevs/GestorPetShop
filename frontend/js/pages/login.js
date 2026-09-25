import { login } from '../auth.js';
import { loadPermissions } from '../permissions.js';
import { notify } from '../utils.js';

export async function render(root) {
  root.innerHTML = `
    <div class="login-screen">
      <div class="login-panel">
        <div class="login-visual">
          <div class="visual-badge">🐾</div>
          <div class="visual-copy">
            <span class="eyebrow">Pet Shop</span>
            <h1>Pet Shop</h1>
            <p>Sistema de Gestão</p>
          </div>
          <div class="visual-features">
            <div>
              <strong>Agenda</strong>
              <span>Atendimentos e consultas</span>
            </div>
            <div>
              <strong>Financeiro</strong>
              <span>Vendas e controle</span>
            </div>
            <div>
              <strong>Clínica</strong>
              <span>Vacinas, exames e prontuários</span>
            </div>
          </div>
        </div>

        <div class="login-card">
          <div class="login-brand">
            <div class="login-brand-mark">🐶</div>
            <div>
              <h2>Pet Shop</h2>
              <p>Sistema de Gestão</p>
            </div>
          </div>

          <form id="login-form" class="login-form" novalidate>
            <div class="field-group">
              <label for="email">E-mail</label>
              <input id="email" name="email" type="email" placeholder="seu@email.com" autocomplete="username" required />
            </div>

            <div class="field-group">
              <label for="senha">Senha</label>
              <div class="password-field">
                <input id="senha" name="senha" type="password" placeholder="••••••••" autocomplete="current-password" required />
                <button type="button" class="password-toggle" data-toggle-password aria-label="Mostrar senha">Mostrar</button>
              </div>
            </div>

            <div id="login-error" class="login-error" aria-live="polite"></div>

            <button class="btn login-submit" type="submit" id="login-submit">
              <span>Entrar</span>
            </button>
          </form>

          <div class="login-footer">Acesso seguro via API do Pet Shop</div>
        </div>
      </div>
    </div>
  `;

  const form = root.querySelector('#login-form');
  const emailInput = form.querySelector('#email');
  const senhaInput = form.querySelector('#senha');
  const submitButton = form.querySelector('#login-submit');
  const errorBox = form.querySelector('#login-error');
  const toggleButton = form.querySelector('[data-toggle-password]');

  const setError = (message) => {
    errorBox.textContent = message || '';
    errorBox.hidden = !message;
  };

  const setLoading = (isLoading) => {
    submitButton.disabled = isLoading;
    submitButton.classList.toggle('is-loading', isLoading);
    submitButton.querySelector('span').textContent = isLoading ? 'Entrando...' : 'Entrar';
  };

  toggleButton.addEventListener('click', () => {
    const isPassword = senhaInput.type === 'password';
    senhaInput.type = isPassword ? 'text' : 'password';
    toggleButton.textContent = isPassword ? 'Ocultar' : 'Mostrar';
    toggleButton.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const senha = senhaInput.value.trim();

    if (!email || !senha) {
      setError('Informe seu e-mail e sua senha.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await login(email, senha);
      await loadPermissions();
      window.__permissionsLoaded = true;
      notify('success', 'Login realizado com sucesso.');
      window.location.hash = '#/dashboard';
    } catch (error) {
      setError(error.message || 'Erro ao autenticar.');
      notify('error', error.message || 'Erro ao autenticar.');
    } finally {
      setLoading(false);
    }
  });
}
