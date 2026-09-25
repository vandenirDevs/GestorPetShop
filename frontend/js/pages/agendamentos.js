import { api } from '../api.js';
import { renderLoading } from '../components/loading.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { hasPermission } from '../permissions.js';

export async function render(root) {
  if (!hasPermission('agendamentos', 'visualizar')) {
    root.innerHTML = '<div class="alert error">Você não tem permissão para visualizar agendamentos.</div>';
    return;
  }

  root.innerHTML = renderLoading('Carregando agendamentos...');

  try {
    const [agendamentos, pets, servicos, usuarios] = await Promise.all([
      api.get('/api/agendamentos'),
      api.get('/api/pets'),
      api.get('/api/servicos'),
      api.get('/api/usuarios')
    ]);

    const canCreate = hasPermission('agendamentos', 'criar');
    const canEdit = hasPermission('agendamentos', 'editar');
    const canDelete = hasPermission('agendamentos', 'excluir');

    root.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1>Agendamentos</h1>
            <div class="page-subtitle">Agenda de compromissos e atendimentos</div>
          </div>
          <div class="page-actions">
            ${canCreate ? '<button class="btn" type="button" data-new-agendamento>Novo agendamento</button>' : ''}
          </div>
        </div>

        <div class="panel">
          <div class="table-wrap">
            <table class="table-area">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Hora</th>
                  <th>Cliente</th>
                  <th>Pet</th>
                  <th>Serviço</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${agendamentos.length ? agendamentos.map((agendamento) => `
                  <tr>
                    <td data-label="Data">${agendamento.data}</td>
                    <td data-label="Hora">${agendamento.horario || '—'}</td>
                    <td data-label="Cliente">${agendamento.cliente || '—'}</td>
                    <td data-label="Pet">${agendamento.pet || '—'}</td>
                    <td data-label="Serviço">${agendamento.servico || '—'}</td>
                    <td data-label="Status"><span class="status-badge ${agendamento.status === 'CANCELADO' ? 'danger' : agendamento.status === 'CONCLUIDO' ? 'success' : 'warning'}">${agendamento.status || 'AGENDADO'}</span></td>
                    <td data-label="Ações">
                      <div class="inline-actions">
                        ${canEdit ? `<button class="btn secondary" type="button" data-edit-agendamento="${agendamento.id}">Editar</button>` : ''}
                        ${canDelete ? `<button class="btn danger" type="button" data-delete-agendamento="${agendamento.id}">Cancelar</button>` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('') : `<tr><td colspan="7"><div class="empty-state">Nenhum agendamento encontrado.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    root.querySelector('[data-new-agendamento]')?.addEventListener('click', () => openAgendamentoModal({ pets, servicos, usuarios }));
    root.querySelectorAll('[data-edit-agendamento]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = agendamentos.find((agendamento) => Number(agendamento.id) === Number(button.dataset.editAgendamento));
        if (item) openAgendamentoModal({ agendamento: item, pets, servicos, usuarios });
      });
    });

    root.querySelectorAll('[data-delete-agendamento]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await api.patch(`/api/agendamentos/${button.dataset.deleteAgendamento}/cancelar`);
          showToast('Agendamento cancelado com sucesso.', 'success');
          render(root);
        } catch (error) {
          showToast(error.message || 'Erro ao cancelar agendamento.', 'error');
        }
      });
    });
  } catch (error) {
    root.innerHTML = `<div class="alert error">Erro ao carregar agendamentos. ${error.message || ''}</div>`;
  }
}

function openAgendamentoModal({ agendamento = null, pets = [], servicos = [], usuarios = [] } = {}) {
  const body = `
    <form id="agendamento-form" class="form-grid">
      <div class="field-group">
        <label>Pet</label>
        <select name="pet_id" required>
          <option value="">Selecione</option>
          ${pets.map((pet) => `<option value="${pet.id}" ${agendamento?.pet_id === pet.id ? 'selected' : ''}>${pet.nome}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Serviço</label>
        <select name="servico_id" required>
          <option value="">Selecione</option>
          ${servicos.map((servico) => `<option value="${servico.id}" ${agendamento?.servico_id === servico.id ? 'selected' : ''}>${servico.nome}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Responsável</label>
        <select name="usuario_id">
          <option value="">Selecione</option>
          ${usuarios.map((usuario) => `<option value="${usuario.id}" ${agendamento?.usuario_id === usuario.id ? 'selected' : ''}>${usuario.nome}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Data</label>
        <input type="date" name="data" value="${agendamento?.data || ''}" required />
      </div>
      <div class="field-group">
        <label>Horário</label>
        <input type="time" name="horario" value="${agendamento?.horario || ''}" required />
      </div>
      <div class="field-group">
        <label>Status</label>
        <select name="status">
          ${['AGENDADO', 'CONFIRMADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO', 'NAO_COMPARECEU'].map((status) => `<option value="${status}" ${agendamento?.status === status ? 'selected' : ''}>${status}</option>`).join('')}
        </select>
      </div>
      <div class="field-group" style="grid-column: 1 / -1;">
        <label>Observações</label>
        <textarea name="observacoes">${agendamento?.observacoes || ''}</textarea>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn ghost" data-close-modal>Cancelar</button>
    <button type="submit" form="agendamento-form" class="btn">Salvar</button>
  `;

  openModal(agendamento ? 'Editar agendamento' : 'Novo agendamento', body, footer, { confirmOnClose: !agendamento });

  const form = document.getElementById('agendamento-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.pet_id = Number(payload.pet_id);
    payload.servico_id = Number(payload.servico_id);
    payload.usuario_id = payload.usuario_id ? Number(payload.usuario_id) : null;

    try {
      if (agendamento) {
        await api.put(`/api/agendamentos/${agendamento.id}`, payload);
        showToast('Agendamento atualizado com sucesso.', 'success');
      } else {
        await api.post('/api/agendamentos', payload);
        showToast('Agendamento cadastrado com sucesso.', 'success');
      }
      closeModal();
      render(document.getElementById('content-area'));
    } catch (error) {
      showToast(error.message || 'Erro ao salvar agendamento.', 'error');
    }
  });
}
