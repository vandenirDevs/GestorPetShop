import { api } from '../api.js';
import { renderLoading } from '../components/loading.js';
import { showToast } from '../components/toast.js';
import { hasPermission } from '../permissions.js';

export async function render(root) {
  if (!hasPermission('relatorios', 'visualizar')) {
    root.innerHTML = '<div class="alert error">Você não tem permissão para visualizar relatórios.</div>';
    return;
  }

  root.innerHTML = renderLoading('Carregando relatórios...');

  try {
    const [resumo, estoque, vendas] = await Promise.all([
      api.get('/api/dashboard'),
      api.get('/api/estoque/movimentacoes'),
      api.get('/api/vendas')
    ]);

    const resumoData = resumo || {};
    const stockData = estoque.movimentacoes || estoque || [];
    const salesData = vendas.vendas || vendas || [];
    const totalVendas = salesData.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const totalMov = stockData.length;

    root.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1>Relatórios</h1>
            <div class="page-subtitle">Resumo geral do PetShop</div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Clientes</div>
            <div class="stat-value">${resumoData.total_clientes || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Pets</div>
            <div class="stat-value">${resumoData.total_pets || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Vendas</div>
            <div class="stat-value">R$ ${Number(totalVendas || 0).toFixed(2).replace('.', ',')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Movimentações</div>
            <div class="stat-value">${totalMov}</div>
          </div>
        </div>

        <div class="panel">
          <h3>Resumo financeiro</h3>
          <div class="table-wrap">
            <table class="table-area">
              <thead>
                <tr>
                  <th>Indicador</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Receita total</td><td>R$ ${Number(totalVendas || 0).toFixed(2).replace('.', ',')}</td></tr>
                <tr><td>Quantidade de vendas</td><td>${salesData.length}</td></tr>
                <tr><td>Movimentações de estoque</td><td>${totalMov}</td></tr>
                <tr><td>Atendimentos agendados</td><td>${resumoData.total_agendamentos || 0}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    root.innerHTML = `<div class="alert error">Erro ao carregar relatórios. ${error.message || ''}</div>`;
  }
}
