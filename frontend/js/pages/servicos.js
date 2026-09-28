import { api } from '../api.js';
import { renderLoading } from '../components/loading.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { hasPermission } from '../permissions.js';

function formatarMoeda(valor) {
  const numero = Number(valor);

  if (valor === null || valor === undefined || valor === '' || Number.isNaN(numero)) {
    return null;
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numero);
}

function formatarPrecos(servico) {
  const precos = [
    ['P', servico?.preco_pequeno],
    ['M', servico?.preco_medio],
    ['G', servico?.preco_grande]
  ];

  const precosConfigurados = precos
    .filter(([, valor]) => valor !== null && valor !== undefined && valor !== '')
    .map(([label, valor]) => `${label}: ${formatarMoeda(valor)}`);

  if (precosConfigurados.length > 0) {
    const linhas = precos.map(([label, valor]) => {
      if (valor === null || valor === undefined || valor === '') {
        return `${label}: não configurado`;
      }

      return `${label}: ${formatarMoeda(valor)}`;
    });

    return linhas.join('<br>');
  }

  const precoLegacy = servico?.preco;

  if (precoLegacy !== null && precoLegacy !== undefined && precoLegacy !== '') {
    return `Preço: ${formatarMoeda(precoLegacy)}<br>P: não configurado<br>M: não configurado<br>G: não configurado`;
  }

  return 'P: não configurado<br>M: não configurado<br>G: não configurado';
}

function normalizarNumeroFormulario(valor) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }

  const texto = String(valor).trim();

  if (texto === '') {
    return null;
  }

  const numero = Number(texto);

  return Number.isNaN(numero) ? null : numero;
}

export async function render(root) {
  if (!hasPermission('servicos', 'visualizar')) {
    root.innerHTML = '<div class="alert error">Você não tem permissão para visualizar serviços.</div>';
    return;
  }

  root.innerHTML = renderLoading('Carregando serviços...');

  try {
    const servicos = await api.get('/api/servicos');
    const canCreate = hasPermission('servicos', 'criar');
    const canEdit = hasPermission('servicos', 'editar');
    const canDelete = hasPermission('servicos', 'excluir');

    root.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1>Serviços</h1>
            <div class="page-subtitle">Catálogo de serviços e preços</div>
          </div>
          <div class="page-actions">
            ${canCreate ? '<button class="btn" type="button" data-new-servico>Novo serviço</button>' : ''}
          </div>
        </div>

        <div class="panel">
          <div class="table-wrap">
            <table class="table-area">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Descrição</th>
                  <th>Preços</th>
                  <th>Duração</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${servicos.length ? servicos.map((servico) => `
                  <tr>
                    <td data-label="Nome">${servico.nome}</td>
                    <td data-label="Descrição">${servico.descricao || '—'}</td>
                    <td data-label="Preços">${formatarPrecos(servico)}</td>
                    <td data-label="Duração">${servico.duracao_minutos || '—'} min</td>
                    <td data-label="Status"><span class="status-badge ${servico.ativo ? 'success' : 'neutral'}">${servico.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td data-label="Ações">
                      <div class="inline-actions">
                        ${canEdit ? `<button class="btn secondary" type="button" data-edit-servico="${servico.id}">Editar</button>` : ''}
                        ${canDelete ? `<button class="btn danger" type="button" data-delete-servico="${servico.id}">Desativar</button>` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('') : `<tr><td colspan="6"><div class="empty-state">Nenhum serviço encontrado.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    root.querySelector('[data-new-servico]')?.addEventListener('click', () => openServicoModal());
    root.querySelectorAll('[data-edit-servico]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = servicos.find((servico) => Number(servico.id) === Number(button.dataset.editServico));
        if (item) openServicoModal(item);
      });
    });

    root.querySelectorAll('[data-delete-servico]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await api.delete(`/api/servicos/${button.dataset.deleteServico}`);
          showToast('Serviço desativado com sucesso.', 'success');
          render(root);
        } catch (error) {
          showToast(error.message || 'Erro ao desativar serviço.', 'error');
        }
      });
    });
  } catch (error) {
    root.innerHTML = `<div class="alert error">Erro ao carregar serviços. ${error.message || ''}</div>`;
  }
}

function openServicoModal(servico = null) {
  const body = `
    <form id="servico-form" class="form-grid">
      <div class="field-group">
        <label>Nome</label>
        <input name="nome" value="${servico?.nome || ''}" required />
      </div>
      <div class="field-group">
        <label>Preço porte pequeno (P)</label>
        <input name="preco_pequeno" type="number" step="0.01" min="0" value="${servico?.preco_pequeno ?? ''}" />
      </div>
      <div class="field-group">
        <label>Preço porte médio (M)</label>
        <input name="preco_medio" type="number" step="0.01" min="0" value="${servico?.preco_medio ?? ''}" />
      </div>
      <div class="field-group">
        <label>Preço porte grande (G)</label>
        <input name="preco_grande" type="number" step="0.01" min="0" value="${servico?.preco_grande ?? ''}" />
      </div>
      <div class="field-group">
        <label>Duração (minutos)</label>
        <input name="duracao_minutos" type="number" value="${servico?.duracao_minutos ?? ''}" />
      </div>
      <div class="field-group" style="grid-column: 1 / -1;">
        <label>Descrição</label>
        <textarea name="descricao">${servico?.descricao || ''}</textarea>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn ghost" data-close-modal>Cancelar</button>
    <button type="submit" form="servico-form" class="btn">Salvar</button>
  `;

  openModal(servico ? 'Editar serviço' : 'Novo serviço', body, footer, { confirmOnClose: !servico });

  const form = document.getElementById('servico-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(form).entries());
    const payload = {
      nome: raw.nome?.trim(),
      descricao: raw.descricao?.trim() || null,
      preco_pequeno: normalizarNumeroFormulario(raw.preco_pequeno),
      preco_medio: normalizarNumeroFormulario(raw.preco_medio),
      preco_grande: normalizarNumeroFormulario(raw.preco_grande),
      duracao_minutos: normalizarNumeroFormulario(raw.duracao_minutos)
    };

    if (servico && servico.preco !== null && servico.preco !== undefined && servico.preco !== '') {
      payload.preco = Number(servico.preco);
    }

    try {
      if (servico) {
        await api.put(`/api/servicos/${servico.id}`, payload);
        showToast('Serviço atualizado com sucesso.', 'success');
      } else {
        await api.post('/api/servicos', payload);
        showToast('Serviço cadastrado com sucesso.', 'success');
      }
      closeModal();
      render(document.getElementById('content-area'));
    } catch (error) {
      showToast(error.message || 'Erro ao salvar serviço.', 'error');
    }
  });
}
