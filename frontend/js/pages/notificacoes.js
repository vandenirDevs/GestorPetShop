import { api } from '../api.js';
import { renderLoading } from '../components/loading.js';
import { showToast } from '../components/toast.js';
import { hasPermission } from '../permissions.js';

export async function render(root) {
  if (!hasPermission('notificacoes', 'visualizar')) {
    root.innerHTML = '<div class="alert error">Você não tem permissão para visualizar notificações.</div>';
    return;
  }

  root.innerHTML = renderLoading('Carregando notificações...');

  try {
    const data = await api.get('/api/notificacoes');
    const list = data.notificacoes || data || [];

    root.innerHTML = `
      <div class="page">
        <div class="page-header">
          <div>
            <h1>Notificações</h1>
            <div class="page-subtitle">Mensagens e alertas do sistema</div>
          </div>
        </div>

        <div class="panel">
          <div class="table-wrap">
            <table class="table-area">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Mensagem</th>
                  <th>Data</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${list.length ? list.map((item) => `
                  <tr>
                    <td data-label="Título">${item.titulo || '—'}</td>
                    <td data-label="Mensagem">${item.mensagem || '—'}</td>
                    <td data-label="Data">${item.data ? new Date(item.data).toLocaleString('pt-BR') : '—'}</td>
                    <td data-label="Status"><span class="status-badge ${item.lida ? 'neutral' : 'warning'}">${item.lida ? 'Lida' : 'Nova'}</span></td>
                  </tr>
                `).join('') : `<tr><td colspan="4"><div class="empty-state">Nenhuma notificação encontrada.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    root.innerHTML = `<div class="alert error">Erro ao carregar notificações. ${error.message || ''}</div>`;
  }
}
