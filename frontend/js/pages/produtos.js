import { api } from '../api.js';
import { renderLoading } from '../components/loading.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { hasPermission } from '../permissions.js';

export async function render(root) {
  if (!hasPermission('produtos', 'visualizar')) {
    root.innerHTML = '<div class="alert error">Você não tem permissão para visualizar produtos.</div>';
    return;
  }

  root.innerHTML = renderLoading('Carregando produtos...');

  try {
    const response = await api.get('/api/produtos');
    const produtos = Array.isArray(response) ? response : (response.produtos || []);
    const canCreate = hasPermission('produtos', 'criar');
    const canEdit = hasPermission('produtos', 'editar');
    const canDelete = hasPermission('produtos', 'excluir');

    root.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1>Produtos</h1>
            <div class="page-subtitle">Controle de inventário e precificação</div>
          </div>
          <div class="page-actions">
            ${canCreate ? '<button class="btn" type="button" data-new-product>Novo produto</button>' : ''}
          </div>
        </div>

        <div class="panel">
          <div class="table-wrap">
            <table class="table-area">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Código</th>
                  <th>Categoria</th>
                  <th>Preço</th>
                  <th>Estoque</th>
                  <th>Mínimo</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${produtos.length ? produtos.map((produto) => `
                  <tr>
                    <td data-label="Produto">${produto.nome}</td>
                    <td data-label="Código">${produto.codigo_barras || '—'}</td>
                    <td data-label="Categoria">${produto.categoria || '—'}</td>
                    <td data-label="Preço">R$ ${Number(produto.preco_venda || 0).toFixed(2).replace('.', ',')}</td>
                    <td data-label="Estoque"><span class="mini-tag ${Number(produto.estoque_atual || 0) <= Number(produto.estoque_minimo || 0) ? 'warning' : 'primary'}">${produto.estoque_atual || 0}</span></td>
                    <td data-label="Mínimo">${produto.estoque_minimo || 0}</td>
                    <td data-label="Status"><span class="status-badge ${produto.ativo ? 'success' : 'neutral'}">${produto.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td data-label="Ações">
                      <div class="inline-actions">
                        ${canEdit ? `<button class="btn secondary" type="button" data-edit-product="${produto.id}">Editar</button>` : ''}
                        ${canDelete ? `<button class="btn danger" type="button" data-delete-product="${produto.id}">Desativar</button>` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('') : `<tr><td colspan="8"><div class="empty-state">Nenhum produto encontrado.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    root.querySelector('[data-new-product]')?.addEventListener('click', () => openProductModal());
    root.querySelectorAll('[data-edit-product]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = produtos.find((produto) => Number(produto.id) === Number(button.dataset.editProduct));
        if (item) openProductModal(item);
      });
    });

    root.querySelectorAll('[data-delete-product]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await api.delete(`/api/produtos/${button.dataset.deleteProduct}`);
          showToast('Produto desativado com sucesso.', 'success');
          render(root);
        } catch (error) {
          showToast(error.message || 'Erro ao desativar produto.', 'error');
        }
      });
    });
  } catch (error) {
    root.innerHTML = `<div class="alert error">Erro ao carregar produtos. ${error.message || ''}</div>`;
  }
}

function openProductModal(product = null) {
  const body = `
    <form id="produto-form" class="form-grid">
      <div class="field-group">
        <label>Nome</label>
        <input name="nome" value="${product?.nome || ''}" required />
      </div>
      <div class="field-group">
        <label>Código de barras</label>
        <input name="codigo_barras" value="${product?.codigo_barras || ''}" />
      </div>
      <div class="field-group">
        <label>Categoria</label>
        <input name="categoria" value="${product?.categoria || ''}" />
      </div>
      <div class="field-group">
        <label>Marca</label>
        <input name="marca" value="${product?.marca || ''}" />
      </div>
      <div class="field-group">
        <label>Preço de custo</label>
        <input name="preco_custo" type="number" step="0.01" value="${product?.preco_custo || ''}" />
      </div>
      <div class="field-group">
        <label>Preço de venda</label>
        <input name="preco_venda" type="number" step="0.01" value="${product?.preco_venda || ''}" />
      </div>
      <div class="field-group">
        <label>Estoque atual</label>
        <input name="estoque_atual" type="number" value="${product?.estoque_atual || ''}" />
      </div>
      <div class="field-group">
        <label>Estoque mínimo</label>
        <input name="estoque_minimo" type="number" value="${product?.estoque_minimo || ''}" />
      </div>
      <div class="field-group">
        <label>Unidade</label>
        <input name="unidade" value="${product?.unidade || ''}" />
      </div>
      <div class="field-group" style="grid-column: 1 / -1;">
        <label>Observações</label>
        <textarea name="observacoes">${product?.observacoes || ''}</textarea>
      </div>
    </form>
  `;

  const footer = `
    <button type="button" class="btn ghost" data-close-modal>Cancelar</button>
    <button type="submit" form="produto-form" class="btn">Salvar</button>
  `;

  openModal(product ? 'Editar produto' : 'Novo produto', body, footer, { confirmOnClose: !product });

  const form = document.getElementById('produto-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    Object.keys(payload).forEach((key) => {
      const value = payload[key];
      if (value === '') payload[key] = null;
    });

    try {
      if (product) {
        await api.put(`/api/produtos/${product.id}`, payload);
        showToast('Produto atualizado com sucesso.', 'success');
      } else {
        await api.post('/api/produtos', payload);
        showToast('Produto cadastrado com sucesso.', 'success');
      }
      closeModal();
      render(document.getElementById('content-area'));
    } catch (error) {
      showToast(error.message || 'Erro ao salvar produto.', 'error');
    }
  });
}
