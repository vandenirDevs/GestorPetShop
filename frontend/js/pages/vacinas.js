import { api } from '../api.js';
import { renderLoading } from '../components/loading.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { hasPermission } from '../permissions.js';

export async function render(root) {
  if (!hasPermission('vacinas', 'visualizar')) {
    root.innerHTML = '<div class="alert error">Você não tem permissão para visualizar vacinas.</div>';
    return;
  }

  root.innerHTML = renderLoading('Carregando vacinas...');

  try {
    const [vacinas, aplicacoes, pets] = await Promise.all([
      api.get('/api/vacinas'),
      api.get('/api/aplicacoes-vacinas'),
      api.get('/api/pets')
    ]);

    const items = vacinas.vacinas || vacinas || [];
    const aplicacoesList = aplicacoes.aplicacoes || aplicacoes || [];

    root.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1>Vacinas</h1>
            <div class="page-subtitle">Controle de vacinas e aplicações</div>
          </div>
          <div class="page-actions">
            <button class="btn" type="button" data-new-vacina>Nova vacina</button>
            <button class="btn secondary" type="button" data-new-aplicacao>Aplicar vacina</button>
          </div>
        </div>

        <div class="panel">
          <h3>Vacinas cadastradas</h3>
          <div class="table-wrap">
            <table class="table-area">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Fabricante</th>
                  <th>Intervalo</th>
                  <th>Descrição</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${items.length ? items.map((vacina) => `
                  <tr>
                    <td data-label="Nome">${vacina.nome}</td>
                    <td data-label="Fabricante">${vacina.fabricante || '—'}</td>
                    <td data-label="Intervalo">${vacina.intervalo_dias ? `${vacina.intervalo_dias} dias` : '—'}</td>
                    <td data-label="Descrição">${vacina.descricao || '—'}</td>
                    <td data-label="Ações"><button class="btn secondary" type="button" data-edit-vacina="${vacina.id}">Editar</button></td>
                  </tr>
                `).join('') : `<tr><td colspan="5"><div class="empty-state">Nenhuma vacina cadastrada.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel">
          <h3>Aplicações</h3>
          <div class="table-wrap">
            <table class="table-area">
              <thead>
                <tr>
                  <th>Pet</th>
                  <th>Vacina</th>
                  <th>Data</th>
                  <th>Próxima dose</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                ${aplicacoesList.length ? aplicacoesList.map((aplicacao) => `
                  <tr>
                    <td data-label="Pet">${aplicacao.pet || '—'}</td>
                    <td data-label="Vacina">${aplicacao.vacina || '—'}</td>
                    <td data-label="Data">${aplicacao.data_aplicacao || '—'}</td>
                    <td data-label="Próxima dose">${aplicacao.proxima_dose || '—'}</td>
                    <td data-label="Observações">${aplicacao.observacoes || '—'}</td>
                  </tr>
                `).join('') : `<tr><td colspan="5"><div class="empty-state">Nenhuma aplicação registrada.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    root.querySelector('[data-new-vacina]')?.addEventListener('click', () => openVacinaModal());
    root.querySelector('[data-new-aplicacao]')?.addEventListener('click', () => openAplicacaoModal({ pets, vacinas: items }));
    root.querySelectorAll('[data-edit-vacina]').forEach((button) => {
      const item = items.find((vacina) => Number(vacina.id) === Number(button.dataset.editVacina));
      if (item) button.addEventListener('click', () => openVacinaModal(item));
    });
  } catch (error) {
    root.innerHTML = `<div class="alert error">Erro ao carregar vacinas. ${error.message || ''}</div>`;
  }
}

function openVacinaModal(vacina = null) {
  const body = `
    <form id="vacina-form" class="form-grid">
      <div class="field-group">
        <label>Nome</label>
        <input name="nome" value="${vacina?.nome || ''}" required />
      </div>
      <div class="field-group">
        <label>Fabricante</label>
        <input name="fabricante" value="${vacina?.fabricante || ''}" />
      </div>
      <div class="field-group">
        <label>Intervalo em dias</label>
        <input name="intervalo_dias" type="number" min="1" value="${vacina?.intervalo_dias || ''}" />
      </div>
      <div class="field-group" style="grid-column: 1 / -1;">
        <label>Descrição</label>
        <textarea name="descricao">${vacina?.descricao || ''}</textarea>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn ghost" data-close-modal>Cancelar</button>
    <button type="submit" form="vacina-form" class="btn">Salvar</button>
  `;

  openModal(vacina ? 'Editar vacina' : 'Nova vacina', body, footer, { confirmOnClose: !vacina });

  const form = document.getElementById('vacina-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      if (vacina) {
        await api.patch(`/api/vacinas/${vacina.id}`, payload);
        showToast('Vacina atualizada com sucesso.', 'success');
      } else {
        await api.post('/api/vacinas', payload);
        showToast('Vacina cadastrada com sucesso.', 'success');
      }
      closeModal();
      render(document.getElementById('content-area'));
    } catch (error) {
      showToast(error.message || 'Erro ao salvar vacina.', 'error');
    }
  });
}

function openAplicacaoModal({ pets = [], vacinas = [] } = {}) {
  const body = `
    <form id="aplicacao-form" class="form-grid">
      <div class="field-group">
        <label>Pet</label>
        <select name="pet_id" required>
          <option value="">Selecione</option>
          ${pets.map((pet) => `<option value="${pet.id}">${pet.nome}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Vacina</label>
        <select name="vacina_id" required>
          <option value="">Selecione</option>
          ${vacinas.map((vacina) => `<option value="${vacina.id}">${vacina.nome}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Data da aplicação</label>
        <input type="date" name="data_aplicacao" required />
      </div>
      <div class="field-group">
        <label>Próxima dose</label>
        <input type="date" name="proxima_dose" />
      </div>
      <div class="field-group">
        <label>Lote</label>
        <input name="lote" />
      </div>
      <div class="field-group">
        <label>Fabricante</label>
        <input name="fabricante" />
      </div>
      <div class="field-group" style="grid-column: 1 / -1;">
        <label>Observações</label>
        <textarea name="observacoes"></textarea>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn ghost" data-close-modal>Cancelar</button>
    <button type="submit" form="aplicacao-form" class="btn">Salvar</button>
  `;

  openModal('Registrar aplicação', body, footer, { confirmOnClose: true });

  const form = document.getElementById('aplicacao-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.pet_id = Number(payload.pet_id);
    payload.vacina_id = Number(payload.vacina_id);

    try {
      await api.post('/api/aplicacoes-vacinas', payload);
      showToast('Aplicação registrada com sucesso.', 'success');
      closeModal();
      render(document.getElementById('content-area'));
    } catch (error) {
      showToast(error.message || 'Erro ao registrar aplicação.', 'error');
    }
  });
}
