import { api } from '../api.js';
import { renderLoading } from '../components/loading.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { hasPermission } from '../permissions.js';

export async function render(root) {
  if (!hasPermission('exames', 'visualizar')) {
    root.innerHTML = '<div class="alert error">Você não tem permissão para visualizar exames.</div>';
    return;
  }

  root.innerHTML = renderLoading('Carregando exames...');

  try {
    const [exames, realizacoes, pets] = await Promise.all([
      api.get('/api/exames'),
      api.get('/api/exames-realizados'),
      api.get('/api/pets')
    ]);

    const exameList = exames.exames || exames || [];
    const realizacoesList = realizacoes.realizacoes || realizacoes || [];

    root.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1>Exames</h1>
            <div class="page-subtitle">Controle de exames laboratoriais</div>
          </div>
          <div class="page-actions">
            <button class="btn" type="button" data-new-exame>Nova categoria</button>
            <button class="btn secondary" type="button" data-new-realizacao>Registrar exame</button>
          </div>
        </div>

        <div class="panel">
          <h3>Tipos de exames</h3>
          <div class="table-wrap">
            <table class="table-area">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Descrição</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${exameList.length ? exameList.map((item) => `
                  <tr>
                    <td data-label="Nome">${item.nome}</td>
                    <td data-label="Descrição">${item.descricao || '—'}</td>
                    <td data-label="Ações"><button class="btn secondary" type="button" data-edit-exame="${item.id}">Editar</button></td>
                  </tr>
                `).join('') : `<tr><td colspan="3"><div class="empty-state">Nenhum exame cadastrado.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel">
          <h3>Exames realizados</h3>
          <div class="table-wrap">
            <table class="table-area">
              <thead>
                <tr>
                  <th>Pet</th>
                  <th>Exame</th>
                  <th>Data</th>
                  <th>Resultado</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                ${realizacoesList.length ? realizacoesList.map((item) => `
                  <tr>
                    <td data-label="Pet">${item.pet || '—'}</td>
                    <td data-label="Exame">${item.exame || '—'}</td>
                    <td data-label="Data">${item.data_realizacao || '—'}</td>
                    <td data-label="Resultado">${item.resultado || '—'}</td>
                    <td data-label="Observações">${item.observacoes || '—'}</td>
                  </tr>
                `).join('') : `<tr><td colspan="5"><div class="empty-state">Nenhum exame realizado.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    root.querySelector('[data-new-exame]')?.addEventListener('click', () => openExameModal());
    root.querySelector('[data-new-realizacao]')?.addEventListener('click', () => openRealizacaoModal({ pets, exames: exameList }));
    root.querySelectorAll('[data-edit-exame]').forEach((button) => {
      const item = exameList.find((exame) => Number(exame.id) === Number(button.dataset.editExame));
      if (item) button.addEventListener('click', () => openExameModal(item));
    });
  } catch (error) {
    root.innerHTML = `<div class="alert error">Erro ao carregar exames. ${error.message || ''}</div>`;
  }
}

function openExameModal(exame = null) {
  const body = `
    <form id="exame-form" class="form-grid">
      <div class="field-group">
        <label>Nome</label>
        <input name="nome" value="${exame?.nome || ''}" required />
      </div>
      <div class="field-group" style="grid-column: 1 / -1;">
        <label>Descrição</label>
        <textarea name="descricao">${exame?.descricao || ''}</textarea>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn ghost" data-close-modal>Cancelar</button>
    <button type="submit" form="exame-form" class="btn">Salvar</button>
  `;

  openModal(exame ? 'Editar exame' : 'Novo exame', body, footer, { confirmOnClose: !exame });

  const form = document.getElementById('exame-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      if (exame) {
        await api.patch(`/api/exames/${exame.id}`, payload);
        showToast('Exame atualizado com sucesso.', 'success');
      } else {
        await api.post('/api/exames', payload);
        showToast('Exame cadastrado com sucesso.', 'success');
      }
      closeModal();
      render(document.getElementById('content-area'));
    } catch (error) {
      showToast(error.message || 'Erro ao salvar exame.', 'error');
    }
  });
}

function openRealizacaoModal({ pets = [], exames = [] } = {}) {
  const body = `
    <form id="realizacao-form" class="form-grid">
      <div class="field-group">
        <label>Pet</label>
        <select name="pet_id" required>
          <option value="">Selecione</option>
          ${pets.map((pet) => `<option value="${pet.id}">${pet.nome}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Exame</label>
        <select name="exame_id" required>
          <option value="">Selecione</option>
          ${exames.map((exame) => `<option value="${exame.id}">${exame.nome}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Data da realização</label>
        <input type="date" name="data_realizacao" required />
      </div>
      <div class="field-group">
        <label>Resultado</label>
        <input name="resultado" />
      </div>
      <div class="field-group" style="grid-column: 1 / -1;">
        <label>Observações</label>
        <textarea name="observacoes"></textarea>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn ghost" data-close-modal>Cancelar</button>
    <button type="submit" form="realizacao-form" class="btn">Salvar</button>
  `;

  openModal('Registrar exame', body, footer, { confirmOnClose: true });

  const form = document.getElementById('realizacao-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.pet_id = Number(payload.pet_id);
    payload.exame_id = Number(payload.exame_id);

    try {
      await api.post('/api/exames-realizados', payload);
      showToast('Exame registrado com sucesso.', 'success');
      closeModal();
      render(document.getElementById('content-area'));
    } catch (error) {
      showToast(error.message || 'Erro ao registrar exame.', 'error');
    }
  });
}
