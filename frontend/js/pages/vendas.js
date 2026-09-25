import { api } from '../api.js';
import { renderLoading } from '../components/loading.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { hasPermission } from '../permissions.js';

export async function render(root) {
  if (!hasPermission('vendas', 'visualizar')) {
    root.innerHTML = '<div class="alert error">Você não tem permissão para visualizar vendas.</div>';
    return;
  }

  root.innerHTML = renderLoading('Carregando vendas...');

  try {
    const [vendas, produtos, clientes] = await Promise.all([
      api.get('/api/vendas'),
      api.get('/api/produtos'),
      api.get('/api/clientes')
    ]);

    const list = vendas.vendas || vendas || [];

    root.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1>Vendas</h1>
            <div class="page-subtitle">Registro e acompanhamento de vendas</div>
          </div>
          <div class="page-actions">
            <button class="btn" type="button" data-new-sale>Nova venda</button>
          </div>
        </div>

        <div class="panel">
          <div class="table-wrap">
            <table class="table-area">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Data</th>
                  <th>Valor</th>
                  <th>Forma</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${list.length ? list.map((venda) => `
                  <tr>
                    <td data-label="Cliente">${venda.cliente || '—'}</td>
                    <td data-label="Data">${venda.data_venda || '—'}</td>
                    <td data-label="Valor">R$ ${Number(venda.total || 0).toFixed(2).replace('.', ',')}</td>
                    <td data-label="Forma">${venda.forma_pagamento || '—'}</td>
                    <td data-label="Status"><span class="status-badge ${venda.status === 'PAGA' ? 'success' : venda.status === 'CANCELADA' ? 'danger' : 'warning'}">${venda.status || 'PENDENTE'}</span></td>
                    <td data-label="Ações"><button class="btn secondary" type="button" data-view-sale="${venda.id}">Detalhes</button></td>
                  </tr>
                `).join('') : `<tr><td colspan="6"><div class="empty-state">Nenhuma venda encontrada.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    root.querySelector('[data-new-sale]')?.addEventListener('click', () => openSaleModal({ produtos, clientes }));
    root.querySelectorAll('[data-view-sale]').forEach((button) => {
      const item = list.find((venda) => Number(venda.id) === Number(button.dataset.viewSale));
      if (item) button.addEventListener('click', () => openSaleDetails(item));
    });
  } catch (error) {
    root.innerHTML = `<div class="alert error">Erro ao carregar vendas. ${error.message || ''}</div>`;
  }
}

function openSaleDetails(venda) {
  const body = `
    <div class="detail-list">
      <div><strong>Cliente:</strong> ${venda.cliente || '—'}</div>
      <div><strong>Data:</strong> ${venda.data_venda || '—'}</div>
      <div><strong>Valor total:</strong> R$ ${Number(venda.total || 0).toFixed(2).replace('.', ',')}</div>
      <div><strong>Forma de pagamento:</strong> ${venda.forma_pagamento || '—'}</div>
      <div><strong>Status:</strong> ${venda.status || 'PENDENTE'}</div>
      <div><strong>Observações:</strong> ${venda.observacoes || '—'}</div>
    </div>
  `;

  openModal('Detalhes da venda', body, '<button type="button" class="btn" data-close-modal>Fechar</button>');
}

function openSaleModal({ produtos = [], clientes = [] } = {}) {
  const body = `
    <form id="sale-form" class="form-grid">
      <div class="field-group">
        <label>Cliente</label>
        <select name="cliente_id" required>
          <option value="">Selecione</option>
          ${clientes.map((cliente) => `<option value="${cliente.id}">${cliente.nome}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Produto</label>
        <select name="produto_id" required>
          <option value="">Selecione</option>
          ${produtos.map((produto) => `<option value="${produto.id}">${produto.nome} - R$ ${Number(produto.preco_venda || 0).toFixed(2).replace('.', ',')}</option>`).join('')}
        </select>
      </div>
      <div class="field-group">
        <label>Quantidade</label>
        <input name="quantidade" type="number" min="1" value="1" required />
      </div>
      <div class="field-group">
        <label>Forma de pagamento</label>
        <select name="forma_pagamento">
          <option value="DINHEIRO">DINHEIRO</option>
          <option value="CARTAO">CARTÃO</option>
          <option value="PIX">PIX</option>
          <option value="CREDITO">CRÉDITO</option>
          <option value="DEBITO">DÉBITO</option>
        </select>
      </div>
      <div class="field-group" style="grid-column: 1 / -1;">
        <label>Observações</label>
        <textarea name="observacoes"></textarea>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn ghost" data-close-modal>Cancelar</button>
    <button type="submit" form="sale-form" class="btn">Salvar</button>
  `;

  openModal('Nova venda', body, footer, { confirmOnClose: true });

  const form = document.getElementById('sale-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.cliente_id = Number(payload.cliente_id);
    payload.produto_id = Number(payload.produto_id);
    payload.quantidade = Number(payload.quantidade);

    try {
      await api.post('/api/vendas', payload);
      showToast('Venda registrada com sucesso.', 'success');
      closeModal();
      render(document.getElementById('content-area'));
    } catch (error) {
      showToast(error.message || 'Erro ao registrar venda.', 'error');
    }
  });
}
