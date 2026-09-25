import { api } from '../api.js';
import { renderLoading } from '../components/loading.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { hasPermission } from '../permissions.js';

export async function render(root) {
  if (!hasPermission('consultas', 'visualizar')) {
    root.innerHTML = '<div class="alert error">Você não tem permissão para visualizar consultas.</div>';
    return;
  }

  root.innerHTML = renderLoading('Carregando consultas...');

  try {
    const [consultas, pets] = await Promise.all([
      api.get('/api/consultas'),
      api.get('/api/pets')
    ]);

    const list = consultas.consultas || consultas || [];
    const canCreate = hasPermission('consultas', 'criar');
    const canEdit = hasPermission('consultas', 'editar');

    root.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1>Consultas</h1>
            <div class="page-subtitle">Atendimentos veterinários</div>
          </div>
          <div class="page-actions">
            ${canCreate ? '<button class="btn" type="button" data-new-consulta>Nova consulta</button>' : ''}
          </div>
        </div>

        <div class="panel">
          <div class="table-wrap">
            <table class="table-area">
              <thead>
                <tr>
                  <th>Pet</th>
                  <th>Data</th>
                  <th>Motivo</th>
                  <th>Diagnóstico</th>
                  <th>Veterinário</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${list.length ? list.map((item) => `
                  <tr>
                    <td data-label="Pet">${item.pet || '—'}</td>
                    <td data-label="Data">${item.data_consulta || '—'}</td>
                    <td data-label="Motivo">${item.motivo || '—'}</td>
                    <td data-label="Diagnóstico">${item.diagnostico || '—'}</td>
                    <td data-label="Veterinário">${item.veterinario || '—'}</td>
                    <td data-label="Status"><span class="status-badge ${item.status === 'FINALIZADA' ? 'success' : item.status === 'CANCELADA' ? 'danger' : 'warning'}">${item.status || 'ABERTA'}</span></td>
                    <td data-label="Ações">
                      <div class="inline-actions">
                        ${canEdit ? `<button class="btn secondary" type="button" data-edit-consulta="${item.id}">Editar</button>` : ''}
                        <button class="btn danger" type="button" data-cancel-consulta="${item.id}">Cancelar</button>
                      </div>
                    </td>
                  </tr>
                `).join('') : `<tr><td colspan="7"><div class="empty-state">Nenhuma consulta encontrada.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    root.querySelector('[data-new-consulta]')?.addEventListener('click', () => openConsultaModal({ pets }));
    root.querySelectorAll('[data-edit-consulta]').forEach((button) => {
      const item = list.find((consulta) => Number(consulta.id) === Number(button.dataset.editConsulta));
      if (item) button.addEventListener('click', () => openConsultaModal({ pets, consulta: item }));
    });
    root.querySelectorAll('[data-cancel-consulta]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await api.patch(`/api/consultas/${button.dataset.cancelConsulta}/cancelar`);
          showToast('Consulta cancelada com sucesso.', 'success');
          render(root);
        } catch (error) {
          showToast(error.message || 'Erro ao cancelar consulta.', 'error');
        }
      });
    });
  } catch (error) {
    root.innerHTML = `<div class="alert error">Erro ao carregar consultas. ${error.message || ''}</div>`;
  }
}

function openConsultaModal({ pets = [], consulta = null } = {}) {
  const body = `
    <form id="consulta-form" class="form-grid">
      <div class="field-group">
        <label>Pet</label>
        <select name="pet_id" required>
          <option value="">Selecione</option>
          ${pets.map((pet) => `<option value="${pet.id}" ${consulta?.pet_id === pet.id ? 'selected' : ''}>${pet.nome}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Data</label>
        <input type="date" name="data_consulta" value="${consulta?.data_consulta || ''}" required />
      </div>
      <div class="field-group">
        <label>Motivo</label>
        <input name="motivo" value="${consulta?.motivo || ''}" required />
      </div>
      <div class="field-group">
        <label>Veterinário</label>
        <input name="veterinario" value="${consulta?.veterinario || ''}" />
      </div>
      <div class="field-group">
        <label>Status</label>
        <select name="status">
          <option value="ABERTA" ${consulta?.status === 'ABERTA' ? 'selected' : ''}>ABERTA</option>
          <option value="FINALIZADA" ${consulta?.status === 'FINALIZADA' ? 'selected' : ''}>FINALIZADA</option>
          <option value="CANCELADA" ${consulta?.status === 'CANCELADA' ? 'selected' : ''}>CANCELADA</option>
        </select>
      </div>
      <div class="field-group" style="grid-column: 1 / -1;">
        <label>Diagnóstico</label>
        <textarea name="diagnostico">${consulta?.diagnostico || ''}</textarea>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn ghost" data-close-modal>Cancelar</button>
    <button type="submit" form="consulta-form" class="btn">Salvar</button>
  `;

  openModal(consulta ? 'Editar consulta' : 'Nova consulta', body, footer, { confirmOnClose: !consulta });

  const form = document.getElementById('consulta-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.pet_id = Number(payload.pet_id);

    try {
      if (consulta) {
        await api.put(`/api/consultas/${consulta.id}`, payload);
        showToast('Consulta atualizada com sucesso.', 'success');
      } else {
        await api.post('/api/consultas', payload);
        showToast('Consulta cadastrada com sucesso.', 'success');
      }
      closeModal();
      render(document.getElementById('content-area'));
    } catch (error) {
      showToast(error.message || 'Erro ao salvar consulta.', 'error');
    }
  });
}
