import { api } from '../api.js';
import { renderLoading } from '../components/loading.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { hasPermission } from '../permissions.js';

export async function render(root) {
  if (!hasPermission('medicamentos', 'visualizar')) {
    root.innerHTML = '<div class="alert error">Você não tem permissão para visualizar medicamentos.</div>';
    return;
  }

  root.innerHTML = renderLoading('Carregando medicamentos...');

  try {
    const [medicamentos, administracoes, pets] = await Promise.all([
      api.get('/api/medicamentos'),
      api.get('/api/administracoes-medicamentos'),
      api.get('/api/pets')
    ]);

    const medList = medicamentos.medicamentos || medicamentos || [];
    const adminList = administracoes.administracoes || administracoes || [];

    root.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1>Medicamentos</h1>
            <div class="page-subtitle">Controle de prescrições e administração</div>
          </div>
          <div class="page-actions">
            <button class="btn" type="button" data-new-med>Novo medicamento</button>
            <button class="btn secondary" type="button" data-new-admin>Administrar</button>
          </div>
        </div>

        <div class="panel">
          <h3>Medicamentos cadastrados</h3>
          <div class="table-wrap">
            <table class="table-area">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Fabricante</th>
                  <th>Dosagem</th>
                  <th>Tipo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${medList.length ? medList.map((item) => `
                  <tr>
                    <td data-label="Nome">${item.nome}</td>
                    <td data-label="Fabricante">${item.fabricante || '—'}</td>
                    <td data-label="Dosagem">${item.dosagem || '—'}</td>
                    <td data-label="Tipo">${item.tipo || '—'}</td>
                    <td data-label="Ações"><button class="btn secondary" type="button" data-edit-med="${item.id}">Editar</button></td>
                  </tr>
                `).join('') : `<tr><td colspan="5"><div class="empty-state">Nenhum medicamento cadastrado.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel">
          <h3>Administrações</h3>
          <div class="table-wrap">
            <table class="table-area">
              <thead>
                <tr>
                  <th>Pet</th>
                  <th>Medicamento</th>
                  <th>Data</th>
                  <th>Dosagem</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                ${adminList.length ? adminList.map((item) => `
                  <tr>
                    <td data-label="Pet">${item.pet || '—'}</td>
                    <td data-label="Medicamento">${item.medicamento || '—'}</td>
                    <td data-label="Data">${item.data_administracao || '—'}</td>
                    <td data-label="Dosagem">${item.dosagem || '—'}</td>
                    <td data-label="Observações">${item.observacoes || '—'}</td>
                  </tr>
                `).join('') : `<tr><td colspan="5"><div class="empty-state">Nenhuma administração registrada.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    root.querySelector('[data-new-med]')?.addEventListener('click', () => openMedicamentoModal());
    root.querySelector('[data-new-admin]')?.addEventListener('click', () => openAdministracaoModal({ pets, medicamentos: medList }));
    root.querySelectorAll('[data-edit-med]').forEach((button) => {
      const item = medList.find((med) => Number(med.id) === Number(button.dataset.editMed));
      if (item) button.addEventListener('click', () => openMedicamentoModal(item));
    });
  } catch (error) {
    root.innerHTML = `<div class="alert error">Erro ao carregar medicamentos. ${error.message || ''}</div>`;
  }
}

function openMedicamentoModal(medicamento = null) {
  const body = `
    <form id="medicamento-form" class="form-grid">
      <div class="field-group">
        <label>Nome</label>
        <input name="nome" value="${medicamento?.nome || ''}" required />
      </div>
      <div class="field-group">
        <label>Fabricante</label>
        <input name="fabricante" value="${medicamento?.fabricante || ''}" />
      </div>
      <div class="field-group">
        <label>Dosagem</label>
        <input name="dosagem" value="${medicamento?.dosagem || ''}" />
      </div>
      <div class="field-group">
        <label>Tipo</label>
        <input name="tipo" value="${medicamento?.tipo || ''}" />
      </div>
      <div class="field-group" style="grid-column: 1 / -1;">
        <label>Descrição</label>
        <textarea name="descricao">${medicamento?.descricao || ''}</textarea>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn ghost" data-close-modal>Cancelar</button>
    <button type="submit" form="medicamento-form" class="btn">Salvar</button>
  `;

  openModal(medicamento ? 'Editar medicamento' : 'Novo medicamento', body, footer, { confirmOnClose: !medicamento });

  const form = document.getElementById('medicamento-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      if (medicamento) {
        await api.patch(`/api/medicamentos/${medicamento.id}`, payload);
        showToast('Medicamento atualizado com sucesso.', 'success');
      } else {
        await api.post('/api/medicamentos', payload);
        showToast('Medicamento cadastrado com sucesso.', 'success');
      }
      closeModal();
      render(document.getElementById('content-area'));
    } catch (error) {
      showToast(error.message || 'Erro ao salvar medicamento.', 'error');
    }
  });
}

function openAdministracaoModal({ pets = [], medicamentos = [] } = {}) {
  const body = `
    <form id="admin-form" class="form-grid">
      <div class="field-group">
        <label>Pet</label>
        <select name="pet_id" required>
          <option value="">Selecione</option>
          ${pets.map((pet) => `<option value="${pet.id}">${pet.nome}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Medicamento</label>
        <select name="medicamento_id" required>
          <option value="">Selecione</option>
          ${medicamentos.map((med) => `<option value="${med.id}">${med.nome}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Data da administração</label>
        <input type="date" name="data_administracao" required />
      </div>
      <div class="field-group">
        <label>Dosagem</label>
        <input name="dosagem" />
      </div>
      <div class="field-group" style="grid-column: 1 / -1;">
        <label>Observações</label>
        <textarea name="observacoes"></textarea>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn ghost" data-close-modal>Cancelar</button>
    <button type="submit" form="admin-form" class="btn">Salvar</button>
  `;

  openModal('Registrar administração', body, footer, { confirmOnClose: true });

  const form = document.getElementById('admin-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.pet_id = Number(payload.pet_id);
    payload.medicamento_id = Number(payload.medicamento_id);

    try {
      await api.post('/api/administracoes-medicamentos', payload);
      showToast('Administração registrada com sucesso.', 'success');
      closeModal();
      render(document.getElementById('content-area'));
    } catch (error) {
      showToast(error.message || 'Erro ao registrar administração.', 'error');
    }
  });
}
