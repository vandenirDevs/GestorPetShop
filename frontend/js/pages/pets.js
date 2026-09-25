import { api } from '../api.js';
import { renderLoading } from '../components/loading.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { hasPermission } from '../permissions.js';

export async function render(root) {
  if (!hasPermission('pets', 'visualizar')) {
    root.innerHTML = '<div class="alert error">Você não tem permissão para visualizar pets.</div>';
    return;
  }

  root.innerHTML = renderLoading('Carregando pets...');

  try {
    const [pets, clientes] = await Promise.all([
      api.get('/api/pets'),
      api.get('/api/clientes')
    ]);

    const canCreate = hasPermission('pets', 'criar');
    const canEdit = hasPermission('pets', 'editar');
    const canDelete = hasPermission('pets', 'excluir');

    root.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1>Pets</h1>
            <div class="page-subtitle">Cadastro de animais e vínculo com clientes</div>
          </div>
          <div class="page-actions">
            ${canCreate ? '<button class="btn" type="button" data-new-pet>Novo pet</button>' : ''}
          </div>
        </div>

        <div class="panel">
          <div class="table-wrap">
            <table class="table-area">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Nome</th>
                  <th>Espécie</th>
                  <th>Raça</th>
                  <th>Sexo</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${pets.length ? pets.map((pet) => {
                  const sexoExibicao =
                    pet.sexo === 'M' ? 'Macho' :
                    pet.sexo === 'F' ? 'Fêmea' :
                    pet.sexo || '-';

                  return `
                    <tr>
                      <td data-label="Cliente">${pet.cliente_nome || '—'}</td>
                      <td data-label="Nome">${pet.nome}</td>
                      <td data-label="Espécie">${pet.especie || '—'}</td>
                      <td data-label="Raça">${pet.raca || '—'}</td>
                      <td data-label="Sexo">${sexoExibicao}</td>
                      <td data-label="Status"><span class="status-badge ${pet.ativo ? 'success' : 'neutral'}">${pet.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td data-label="Ações">
                        <div class="inline-actions">
                          ${canEdit ? `<button class="btn secondary" type="button" data-edit-pet="${pet.id}">Editar</button>` : ''}
                          ${canDelete ? `<button class="btn danger" type="button" data-delete-pet="${pet.id}">Desativar</button>` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('') : `<tr><td colspan="7"><div class="empty-state">Nenhum pet encontrado.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    root.querySelector('[data-new-pet]')?.addEventListener('click', () => openPetModal({ clientes }));
    root.querySelectorAll('[data-edit-pet]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = pets.find((pet) => Number(pet.id) === Number(button.dataset.editPet));
        if (item) openPetModal({ pet: item, clientes });
      });
    });

    root.querySelectorAll('[data-delete-pet]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await api.delete(`/api/pets/${button.dataset.deletePet}`);
          showToast('Pet desativado com sucesso.', 'success');
          render(root);
        } catch (error) {
          showToast(error.message || 'Erro ao desativar pet.', 'error');
        }
      });
    });
  } catch (error) {
    root.innerHTML = `<div class="alert error">Erro ao carregar pets. ${error.message || ''}</div>`;
  }
}

function normalizeOptionalNumeric(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();
  if (trimmed === '') {
    return null;
  }

  const numericValue = Number(trimmed);
  return Number.isNaN(numericValue) ? value : numericValue;
}

function openPetModal({ pet = null, clientes = [] } = {}) {
  const body = `
    <form id="pet-form" class="form-grid">
      <div class="field-group">
        <label>Cliente</label>
        <select name="cliente_id" required>
          <option value="">Selecione</option>
          ${clientes.map((cliente) => `<option value="${cliente.id}" ${pet?.cliente_id === cliente.id ? 'selected' : ''}>${cliente.nome}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Nome</label>
        <input name="nome" value="${pet?.nome || ''}" required />
      </div>
      <div class="field-group">
        <label>Espécie</label>
        <input name="especie" value="${pet?.especie || ''}" required />
      </div>
      <div class="field-group">
        <label>Raça</label>
        <input name="raca" value="${pet?.raca || ''}" />
      </div>
      <div class="field-group">
        <label>Sexo</label>
        <select name="sexo">
          <option value="M" ${pet?.sexo === 'M' ? 'selected' : ''}>Macho</option>
          <option value="F" ${pet?.sexo === 'F' ? 'selected' : ''}>Fêmea</option>
        </select>
      </div>
      <div class="field-group">
        <label>Data de nascimento</label>
        <input type="date" name="data_nascimento" value="${pet?.data_nascimento || ''}" />
      </div>
      <div class="field-group">
        <label>Peso</label>
        <input name="peso" value="${pet?.peso || ''}" />
      </div>
      <div class="field-group">
        <label>Cor</label>
        <input name="cor" value="${pet?.cor || ''}" />
      </div>
      <div class="field-group">
        <label>Microchip</label>
        <input name="microchip" value="${pet?.microchip || ''}" />
      </div>
      <div class="field-group" style="grid-column: 1 / -1;">
        <label>Observações</label>
        <textarea name="observacoes">${pet?.observacoes || ''}</textarea>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn ghost" data-close-modal>Cancelar</button>
    <button type="submit" form="pet-form" class="btn">Salvar</button>
  `;

  openModal(pet ? 'Editar pet' : 'Novo pet', body, footer, { confirmOnClose: !pet });

  const form = document.getElementById('pet-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.cliente_id = Number(payload.cliente_id);

    if (payload.data_nascimento === '') {
      payload.data_nascimento = null;
    }

    const optionalNumericFields = ['peso'];
    optionalNumericFields.forEach((field) => {
      payload[field] = normalizeOptionalNumeric(payload[field]);
    });

    try {
      if (pet) {
        await api.put(`/api/pets/${pet.id}`, payload);
        showToast('Pet atualizado com sucesso.', 'success');
      } else {
        await api.post('/api/pets', payload);
        showToast('Pet cadastrado com sucesso.', 'success');
      }
      closeModal();
      render(document.getElementById('content-area'));
    } catch (error) {
      showToast(error.message || 'Erro ao salvar pet.', 'error');
    }
  });
}
