import { api } from '../api.js';
import { formatCurrency, formatDate, safeText } from '../utils.js';
import { renderLoading } from '../components/loading.js';

export async function render(root) {
  const container = root;
  container.innerHTML = renderLoading('Carregando dashboard...');

  try {
    const data = await api.get('/api/dashboard');
    const resumo = data?.resumo || {};
    const metrics = [
      { label: 'Vendas', value: safeText(resumo.total_vendas ?? resumo.vendas ?? 0), trend: 'Hoje' },
      { label: 'Clientes', value: safeText(resumo.total_clientes ?? 0), trend: 'Ativos' },
      { label: 'Pets', value: safeText(resumo.total_pets ?? 0), trend: 'Cadastrados' },
      { label: 'Produtos', value: safeText(resumo.total_produtos ?? 0), trend: 'Catalogo' },
      { label: 'Estoque', value: safeText(resumo.estoque_alertas ?? 0), trend: 'Alertas' },
      { label: 'Agendamentos', value: safeText(resumo.total_agendamentos ?? 0), trend: 'Próximos' }
    ];

    const alerts = data?.alertas || [];

    const html = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1>Dashboard</h1>
            <div class="page-subtitle">Visão geral do negócio em tempo real</div>
          </div>
        </div>

        <div class="card-grid">
          ${metrics.map((item) => `
            <div class="summary-card">
              <div class="label">${item.label}</div>
              <div class="value">
                <strong>${item.value}</strong>
                <span class="trend">${item.trend}</span>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="panel">
          <h3>Alertas</h3>
          ${alerts.length ? `
            <div class="notification-list">
              ${alerts.map((item) => `
                <div class="notification-item ${item.prioridade === 'ALTA' ? 'unread' : ''}">
                  <div class="notification-header">
                    <strong>${safeText(item.tipo || 'Alerta')}</strong>
                    <span class="badge-pill">${safeText(item.prioridade || 'MEDIA')}</span>
                  </div>
                  <div>${safeText(item.mensagem || 'Sem detalhe informado.')}</div>
                </div>
              `).join('')}
            </div>
          ` : '<div class="empty-state">Nenhum alerta no momento.</div>'}
        </div>

        <div class="panel">
          <h3>Resumo financeiro</h3>
          <div class="report-grid">
            <div class="info-box">
              <strong>Receita total</strong>
              <span>${formatCurrency(resumo.receita_total || 0)}</span>
            </div>
            <div class="info-box">
              <strong>Vendas finalizadas</strong>
              <span>${safeText(resumo.vendas_finalizadas || 0)}</span>
            </div>
            <div class="info-box">
              <strong>Última atualização</strong>
              <span>${formatDate(resumo.atualizado_em || new Date())}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = `<div class="alert error">Erro ao carregar dashboard.</div>`;
  }
}
