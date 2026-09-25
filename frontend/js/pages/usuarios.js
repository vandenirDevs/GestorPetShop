import { api } from '../api.js';
import { renderLoading } from '../components/loading.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { hasPermission } from '../permissions.js';

export async function render(root) {
  if (!hasPermission('usuarios', 'visualizar')) {
    root.innerHTML = '<div class="alert error">Você não tem permissão para visualizar usuários.</div>';
    return;
  }

  root.innerHTML = renderLoading('Carregando usuários...');

  try {
    const response = await api.get('/api/usuarios');
    const usuarios = Array.isArray(response) ? response : (response.usuarios || []);

    const canCreate = hasPermission('usuarios', 'criar');
    const canEdit = hasPermission('usuarios', 'editar');
    const canDelete = hasPermission('usuarios', 'excluir');

    root.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1>Usuários</h1>
            <div class="page-subtitle">Controle de acesso e pessoal administrativo</div>
          </div>
          <div class="page-actions">
            ${canCreate ? '<button class="btn" type="button" data-new-user>Novo usuário</button>' : ''}
          </div>
        </div>

        <div class="panel">
          <div class="search-box">
            <div class="input-wrap">
              <input type="search" id="usuario-search" placeholder="Pesquisar usuário..." />
            </div>
          </div>

          <div class="table-wrap">
            <table class="table-area">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${usuarios.length ? usuarios.map((usuario) => `
                  <tr>
                    <td data-label="Nome">${usuario.nome}</td>
                    <td data-label="E-mail">${usuario.email}</td>
                    <td data-label="Perfil"><span class="badge-pill">${usuario.perfil}</span></td>
                    <td data-label="Status"><span class="status-badge ${usuario.ativo ? 'success' : 'neutral'}">${usuario.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td data-label="Ações">
                      <div class="inline-actions">
                        ${canEdit ? `<button class="btn secondary" type="button" data-edit-user="${usuario.id}">Editar</button>` : ''}
                        ${canDelete ? `<button class="btn danger" type="button" data-delete-user="${usuario.id}">Desativar</button>` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('') : `<tr><td colspan="5"><div class="empty-state">Nenhum usuário encontrado.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const searchInput = root.querySelector('#usuario-search');
    searchInput?.addEventListener('input', (event) => {
      const term = event.target.value.toLowerCase();
      root.querySelectorAll('tbody tr').forEach((row) => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    });

    root.querySelector('[data-new-user]')?.addEventListener('click', () => openUserModal());
    root.querySelectorAll('[data-edit-user]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.editUser);
        const user = usuarios.find((item) => Number(item.id) === id);
        if (user) openUserModal(user);
      });
    });

    root.querySelectorAll('[data-delete-user]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.deleteUser);
        try {
          await api.delete(`/api/usuarios/${id}`);
          showToast('Usuário desativado com sucesso.', 'success');
          render(root);
        } catch (error) {
          showToast(error.message || 'Erro ao desativar usuário.', 'error');
        }
      });
    });

  } catch (error) {
    root.innerHTML = `<div class="alert error">Erro ao carregar usuários. ${error.message || ''}</div>`;
  }
}

async function openUserModal(user = null) {
  const title = user ? 'Editar usuário' : 'Novo usuário';
  const body = `
    <form id="usuario-form" class="form-grid">
      <div class="field-group">
        <label>Nome</label>
        <input name="nome" value="${user?.nome || ''}" required />
      </div>
      <div class="field-group">
        <label>E-mail</label>
        <input name="email" type="email" value="${user?.email || ''}" required />
      </div>
      <div class="field-group">
        <label>Senha ${user ? '(opcional)' : ''}</label>
        <input name="senha" type="password" ${user ? '' : 'required'} />
      </div>
      <div class="field-group">
        <label>Perfil</label>
        <select name="perfil">
          <option value="ADMIN" ${user?.perfil === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
          <option value="GERENTE" ${user?.perfil === 'GERENTE' ? 'selected' : ''}>GERENTE</option>
          <option value="ATENDENTE" ${user?.perfil === 'ATENDENTE' ? 'selected' : ''}>ATENDENTE</option>
        </select>
      </div>
      <div class="field-group">
        <label>Ativo</label>
        <select name="ativo">
          <option value="true" ${user?.ativo !== false ? 'selected' : ''}>Ativo</option>
          <option value="false" ${user?.ativo === false ? 'selected' : ''}>Inativo</option>
        </select>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn ghost" data-close-modal>Cancelar</button>
    <button type="submit" form="usuario-form" class="btn">Salvar</button>
  `;

  openModal(title, body, footer, { confirmOnClose: !user });

  const form = document.getElementById('usuario-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.ativo = payload.ativo === 'true';

    if (!user) {
      payload.senha = payload.senha || '';
    } else if (!payload.senha) {
      delete payload.senha;
    }

    try {
      if (user) {
        await api.put(`/api/usuarios/${user.id}`, payload);
        showToast('Usuário atualizado com sucesso.', 'success');
      } else {
        await api.post('/api/usuarios', payload);
        showToast('Usuário cadastrado com sucesso.', 'success');
      }
      closeModal();
      const root = document.getElementById('content-area');
      render(root);
    } catch (error) {
      showToast(error.message || 'Erro ao salvar usuário.', 'error');
    }
  });
}
