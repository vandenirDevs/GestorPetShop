import { api } from '../api.js';
import { formatCurrency, formatDate, safeText } from '../utils.js';
import { renderLoading } from '../components/loading.js';

export async function render(root) {
  const container = root;
  container.innerHTML = renderLoading('Carregando dashboard...');

  try {
    const data = await api.get('/api/dashboard');
    const dashboard = data?.dashboard || {};
    const cadastros = dashboard.cadastros || {};
    const agenda = dashboard.agenda || {};
    const estoque = dashboard.estoque || {};
    const vendas = dashboard.vendas || {};

    const metrics = [
      { label: 'Vendas', value: safeText(vendas.vendas_hoje ?? 0), trend: 'Hoje' },
      { label: 'Clientes', value: safeText(cadastros.clientes_ativos ?? 0), trend: 'Ativos' },
      { label: 'Pets', value: safeText(cadastros.pets_ativos ?? 0), trend: 'Cadastrados' },
      { label: 'Produtos', value: safeText(estoque.produtos_ativos ?? 0), trend: 'Catalogo' },
      { label: 'Estoque', value: safeText((estoque.estoque_baixo ?? 0) + (estoque.estoque_zerado ?? 0)), trend: 'Alertas' },
      { label: 'Agendamentos', value: safeText(agenda.agendamentos_hoje ?? 0), trend: 'Próximos' }
    ];

    const alerts = [];

    if ((estoque.estoque_baixo ?? 0) > 0) {
      alerts.push({
        prioridade: 'MEDIA',
        tipo: 'Estoque baixo',
        mensagem: `${estoque.estoque_baixo} produto(s) com estoque baixo.`
      });
    }

    if ((estoque.estoque_zerado ?? 0) > 0) {
      alerts.push({
        prioridade: 'ALTA',
        tipo: 'Estoque zerado',
        mensagem: `${estoque.estoque_zerado} produto(s) sem estoque.`
      });
    }

    if ((agenda.agendamentos_pendentes ?? 0) > 0) {
      alerts.push({
        prioridade: 'MEDIA',
        tipo: 'Agendamentos pendentes',
        mensagem: `${agenda.agendamentos_pendentes} agendamento(s) pendente(s).`
      });
    }

    if ((agenda.consultas_pendentes ?? 0) > 0) {
      alerts.push({
        prioridade: 'MEDIA',
        tipo: 'Consultas pendentes',
        mensagem: `${agenda.consultas_pendentes} consulta(s) pendente(s).`
      });
    }

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
              <span>${formatCurrency(vendas.faturamento_hoje ?? 0)}</span>
            </div>
            <div class="info-box">
              <strong>Vendas finalizadas</strong>
              <span>${safeText(vendas.vendas_hoje ?? 0)}</span>
            </div>
            <div class="info-box">
              <strong>Última atualização</strong>
              <span>${formatDate(new Date())}</span>
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
