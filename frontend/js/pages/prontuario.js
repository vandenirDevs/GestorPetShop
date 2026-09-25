import { api } from '../api.js';
import { renderLoading } from '../components/loading.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { hasPermission } from '../permissions.js';

export async function render(root) {
  if (!hasPermission('prontuario', 'visualizar')) {
    root.innerHTML = '<div class="alert error">Você não tem permissão para visualizar prontuários.</div>';
    return;
  }

  root.innerHTML = renderLoading('Carregando prontuários...');

  try {
    const [prontuarios, pets] = await Promise.all([
      api.get('/api/prontuarios'),
      api.get('/api/pets')
    ]);

    const list = prontuarios.prontuarios || prontuarios || [];

    root.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1>Prontuários</h1>
            <div class="page-subtitle">Histórico clínico e acompanhamento do animal</div>
          </div>
          <div class="page-actions">
            <button class="btn" type="button" data-new-prontuario>Novo prontuário</button>
          </div>
        </div>

        <div class="panel">
          <div class="table-wrap">
            <table class="table-area">
              <thead>
                <tr>
                  <th>Pet</th>
                  <th>Última atualização</th>
                  <th>Resumo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${list.length ? list.map((item) => `
                  <tr>
                    <td data-label="Pet">${item.pet || '—'}</td>
                    <td data-label="Última atualização">${item.updated_at ? new Date(item.updated_at).toLocaleDateString('pt-BR') : '—'}</td>
                    <td data-label="Resumo">${item.resumo || '—'}</td>
                    <td data-label="Ações"><button class="btn secondary" type="button" data-view-prontuario="${item.id}">Abrir</button></td>
                  </tr>
                `).join('') : `<tr><td colspan="4"><div class="empty-state">Nenhum prontuário encontrado.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    root.querySelector('[data-new-prontuario]')?.addEventListener('click', () => openProntuarioModal({ pets }));
    root.querySelectorAll('[data-view-prontuario]').forEach((button) => {
      const item = list.find((prontuario) => Number(prontuario.id) === Number(button.dataset.viewProntuario));
      if (item) button.addEventListener('click', () => openProntuarioModal({ pets, prontuario: item }));
    });
  } catch (error) {
    root.innerHTML = `<div class="alert error">Erro ao carregar prontuários. ${error.message || ''}</div>`;
  }
}

function openProntuarioModal({ pets = [], prontuario = null } = {}) {
  const body = `
    <form id="prontuario-form" class="form-grid">
      <div class="field-group">
        <label>Pet</label>
        <select name="pet_id" required>
          <option value="">Selecione</option>
          ${pets.map((pet) => `<option value="${pet.id}" ${prontuario?.pet_id === pet.id ? 'selected' : ''}>${pet.nome}</option>`).join('')}
        </select>
      </div>
      <div class="field-group" style="grid-column: 1 / -1;">
        <label>Resumo</label>
        <textarea name="resumo" required>${prontuario?.resumo || ''}</textarea>
      </div>
      <div class="field-group" style="grid-column: 1 / -1;">
        <label>Observações</label>
        <textarea name="observacoes">${prontuario?.observacoes || ''}</textarea>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn ghost" data-close-modal>Cancelar</button>
    <button type="submit" form="prontuario-form" class="btn">Salvar</button>
  `;

  openModal(prontuario ? 'Editar prontuário' : 'Novo prontuário', body, footer, { confirmOnClose: !prontuario });

  const form = document.getElementById('prontuario-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.pet_id = Number(payload.pet_id);

    try {
      if (prontuario) {
        await api.put(`/api/prontuarios/${prontuario.id}`, payload);
        showToast('Prontuário atualizado com sucesso.', 'success');
      } else {
        await api.post('/api/prontuarios', payload);
        showToast('Prontuário cadastrado com sucesso.', 'success');
      }
      closeModal();
      render(document.getElementById('content-area'));
    } catch (error) {
      showToast(error.message || 'Erro ao salvar prontuário.', 'error');
    }
  });
}
