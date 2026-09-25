import { api } from '../api.js';
import { renderLoading } from '../components/loading.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { hasPermission } from '../permissions.js';

export async function render(root) {
  if (!hasPermission('clientes', 'visualizar')) {
    root.innerHTML = '<div class="alert error">Você não tem permissão para visualizar clientes.</div>';
    return;
  }

  root.innerHTML = renderLoading('Carregando clientes...');

  try {
    const clientes = await api.get('/api/clientes');
    const canCreate = hasPermission('clientes', 'criar');
    const canEdit = hasPermission('clientes', 'editar');
    const canDelete = hasPermission('clientes', 'excluir');

    root.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1>Clientes</h1>
            <div class="page-subtitle">Cadastro e acompanhamento dos clientes</div>
          </div>
          <div class="page-actions">
            ${canCreate ? '<button class="btn" type="button" data-new-client>Novo cliente</button>' : ''}
          </div>
        </div>

        <div class="panel">
          <div class="search-box">
            <div class="input-wrap">
              <input type="search" id="cliente-search" placeholder="Pesquisar cliente..." />
            </div>
          </div>

          <div class="table-wrap">
            <table class="table-area">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF/CNPJ</th>
                  <th>Telefone</th>
                  <th>Cidade</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${clientes.length ? clientes.map((cliente) => `
                  <tr>
                    <td data-label="Nome">${cliente.nome}</td>
                    <td data-label="CPF/CNPJ">${cliente.cpf_cnpj || '—'}</td>
                    <td data-label="Telefone">${cliente.telefone || '—'}</td>
                    <td data-label="Cidade">${cliente.cidade || '—'}</td>
                    <td data-label="Status"><span class="status-badge ${cliente.ativo ? 'success' : 'neutral'}">${cliente.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td data-label="Ações">
                      <div class="inline-actions">
                        ${canEdit ? `<button class="btn secondary" type="button" data-edit-client="${cliente.id}">Editar</button>` : ''}
                        ${canDelete ? `<button class="btn danger" type="button" data-delete-client="${cliente.id}">Desativar</button>` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('') : `<tr><td colspan="6"><div class="empty-state">Nenhum cliente encontrado.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    root.querySelector('#cliente-search')?.addEventListener('input', (event) => {
      const term = event.target.value.toLowerCase();
      root.querySelectorAll('tbody tr').forEach((row) => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    });

    root.querySelector('[data-new-client]')?.addEventListener('click', () => openClientModal());
    root.querySelectorAll('[data-edit-client]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = clientes.find((cliente) => Number(cliente.id) === Number(button.dataset.editClient));
        if (item) openClientModal(item);
      });
    });

    root.querySelectorAll('[data-delete-client]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await api.delete(`/api/clientes/${button.dataset.deleteClient}`);
          showToast('Cliente desativado com sucesso.', 'success');
          render(root);
        } catch (error) {
          showToast(error.message || 'Erro ao desativar cliente.', 'error');
        }
      });
    });
  } catch (error) {
    root.innerHTML = `<div class="alert error">Erro ao carregar clientes. ${error.message || ''}</div>`;
  }
}

function openClientModal(client = null) {
  const body = `
    <form id="cliente-form" class="form-grid">
      <div class="field-group">
        <label>Nome</label>
        <input name="nome" value="${client?.nome || ''}" required />
      </div>
      <div class="field-group">
        <label>CPF/CNPJ</label>
        <input name="cpf_cnpj" value="${client?.cpf_cnpj || ''}" />
      </div>
      <div class="field-group">
        <label>Telefone</label>
        <input name="telefone" value="${client?.telefone || ''}" />
      </div>
      <div class="field-group">
        <label>WhatsApp</label>
        <input name="whatsapp" value="${client?.whatsapp || ''}" />
      </div>
      <div class="field-group">
        <label>E-mail</label>
        <input name="email" type="email" value="${client?.email || ''}" />
      </div>
      <div class="field-group">
        <label>CEP</label>
        <input name="cep" value="${client?.cep || ''}" />
      </div>
      <div class="field-group">
        <label>Endereço</label>
        <input name="endereco" value="${client?.endereco || ''}" />
      </div>
      <div class="field-group">
        <label>Número</label>
        <input name="numero" value="${client?.numero || ''}" />
      </div>
      <div class="field-group">
        <label>Complemento</label>
        <input name="complemento" value="${client?.complemento || ''}" />
      </div>
      <div class="field-group">
        <label>Bairro</label>
        <input name="bairro" value="${client?.bairro || ''}" />
      </div>
      <div class="field-group">
        <label>Cidade</label>
        <input name="cidade" value="${client?.cidade || ''}" />
      </div>
      <div class="field-group">
        <label>Estado</label>
        <input name="estado" value="${client?.estado || ''}" />
      </div>
      <div class="field-group" style="grid-column: 1 / -1;">
        <label>Observações</label>
        <textarea name="observacoes">${client?.observacoes || ''}</textarea>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn ghost" data-close-modal>Cancelar</button>
    <button type="submit" form="cliente-form" class="btn">Salvar</button>
  `;

  openModal(client ? 'Editar cliente' : 'Novo cliente', body, footer, { confirmOnClose: !client });

  const form = document.getElementById('cliente-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      if (client) {
        await api.put(`/api/clientes/${client.id}`, payload);
        showToast('Cliente atualizado com sucesso.', 'success');
      } else {
        await api.post('/api/clientes', payload);
        showToast('Cliente cadastrado com sucesso.', 'success');
      }
      closeModal();
      render(document.getElementById('content-area'));
    } catch (error) {
      showToast(error.message || 'Erro ao salvar cliente.', 'error');
    }
  });
}
