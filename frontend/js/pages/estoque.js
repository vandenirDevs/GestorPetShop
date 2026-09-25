import { api } from '../api.js';
import { renderLoading } from '../components/loading.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { hasPermission } from '../permissions.js';

export async function render(root) {
  if (!hasPermission('estoque', 'visualizar')) {
    root.innerHTML = '<div class="alert error">Você não tem permissão para visualizar estoque.</div>';
    return;
  }

  root.innerHTML = renderLoading('Carregando movimentações de estoque...');

  try {
    const [movimentacoes, produtos] = await Promise.all([
      api.get('/api/estoque/movimentacoes'),
      api.get('/api/produtos')
    ]);

    const items = movimentacoes.movimentacoes || movimentacoes || [];
    const canCreate = hasPermission('estoque', 'criar');

    root.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1>Estoque</h1>
            <div class="page-subtitle">Movimentações e controle do inventário</div>
          </div>
          <div class="page-actions">
            ${canCreate ? '<button class="btn" type="button" data-new-movement>Registrar movimento</button>' : ''}
          </div>
        </div>

        <div class="panel">
          <div class="table-wrap">
            <table class="table-area">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Tipo</th>
                  <th>Quantidade</th>
                  <th>Estoque anterior</th>
                  <th>Estoque posterior</th>
                  <th>Usuário</th>
                  <th>Motivo</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                ${items.length ? items.map((item) => `
                  <tr>
                    <td data-label="Produto">${item.produto || '—'}</td>
                    <td data-label="Tipo"><span class="status-badge ${item.tipo === 'SAIDA' ? 'warning' : item.tipo === 'AJUSTE' ? 'neutral' : 'success'}">${item.tipo}</span></td>
                    <td data-label="Quantidade">${item.quantidade}</td>
                    <td data-label="Anterior">${item.estoque_anterior}</td>
                    <td data-label="Posterior">${item.estoque_posterior}</td>
                    <td data-label="Usuário">${item.usuario || '—'}</td>
                    <td data-label="Motivo">${item.motivo || '—'}</td>
                    <td data-label="Data">${new Date(item.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                `).join('') : `<tr><td colspan="8"><div class="empty-state">Nenhuma movimentação encontrada.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    root.querySelector('[data-new-movement]')?.addEventListener('click', () => openMovementModal({ produtos }));
  } catch (error) {
    root.innerHTML = `<div class="alert error">Erro ao carregar estoque. ${error.message || ''}</div>`;
  }
}

function openMovementModal({ produtos = [] } = {}) {
  const body = `
    <form id="movimento-form" class="form-grid">
      <div class="field-group">
        <label>Produto</label>
        <select name="produto_id" required>
          <option value="">Selecione</option>
          ${produtos.map((produto) => `<option value="${produto.id}">${produto.nome}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Tipo</label>
        <select name="tipo" required>
          <option value="ENTRADA">ENTRADA</option>
          <option value="SAIDA">SAIDA</option>
          <option value="AJUSTE">AJUSTE</option>
        </select>
      </div>
      <div class="field-group">
        <label>Quantidade</label>
        <input name="quantidade" type="number" min="1" value="1" required />
      </div>
      <div class="field-group">
        <label>Estoque novo (apenas ajuste)</label>
        <input name="estoque_novo" type="number" min="0" value="0" />
      </div>
      <div class="field-group" style="grid-column: 1 / -1;">
        <label>Motivo</label>
        <textarea name="motivo">Compra de material</textarea>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn ghost" data-close-modal>Cancelar</button>
    <button type="submit" form="movimento-form" class="btn">Salvar</button>
  `;

  openModal('Registrar movimentação', body, footer, { confirmOnClose: true });

  const form = document.getElementById('movimento-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    const tipo = payload.tipo;
    const produtoId = Number(payload.produto_id);

    try {
      if (tipo === 'AJUSTE') {
        await api.post('/api/estoque/ajuste', {
          produto_id: produtoId,
          estoque_novo: Number(payload.estoque_novo),
          motivo: payload.motivo
        });
      } else if (tipo === 'ENTRADA') {
        await api.post('/api/estoque/entrada', {
          produto_id: produtoId,
          quantidade: Number(payload.quantidade),
          motivo: payload.motivo
        });
      } else {
        await api.post('/api/estoque/saida', {
          produto_id: produtoId,
          quantidade: Number(payload.quantidade),
          motivo: payload.motivo
        });
      }

      showToast('Movimentação registrada com sucesso.', 'success');
      closeModal();
      render(document.getElementById('content-area'));
    } catch (error) {
      showToast(error.message || 'Erro ao registrar movimentação.', 'error');
    }
  });
}
