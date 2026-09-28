import { api } from '../api.js';
import { renderLoading } from '../components/loading.js';
import { showToast } from '../components/toast.js';
import { hasPermission } from '../permissions.js';

const formatDate = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('pt-BR');
};

const prioridadeClass = (prioridade) => {
  switch (prioridade) {
    case 'ALTA':
      return 'danger';
    case 'MEDIA':
      return 'warning';
    case 'BAIXA':
      return 'neutral';
    default:
      return 'neutral';
  }
};

const prioridadeTexto = (prioridade) => {
  switch (prioridade) {
    case 'ALTA':
      return 'Alta';
    case 'MEDIA':
      return 'Média';
    case 'BAIXA':
      return 'Baixa';
    default:
      return prioridade || '—';
  }
};

const carregarNotificacoes = async () => {
  const data = await api.get('/api/notificacoes/minhas');

  return {
    notificacoes: Array.isArray(data?.notificacoes)
      ? data.notificacoes
      : [],
    naoLidas: Number(data?.nao_lidas || 0)
  };
};

const gerarNotificacoes = async () => {
  return api.post('/api/notificacoes/gerar', {});
};

function renderTabela(notificacoes) {
  if (!notificacoes.length) {
    return `
      <div class="empty-state">
        Nenhuma notificação encontrada.
      </div>
    `;
  }

  return `
    <div class="table-wrap">
      <table class="table-area">
        <thead>
          <tr>
            <th>Status</th>
            <th>Prioridade</th>
            <th>Título</th>
            <th>Mensagem</th>
            <th>Data</th>
            <th>Ações</th>
          </tr>
        </thead>

        <tbody>
          ${notificacoes.map((item) => `
            <tr>
              <td data-label="Status">
                <span class="status-badge ${item.lida ? 'neutral' : 'warning'}">
                  ${item.lida ? 'Lida' : 'Nova'}
                </span>
              </td>

              <td data-label="Prioridade">
                <span class="status-badge ${prioridadeClass(item.prioridade)}">
                  ${prioridadeTexto(item.prioridade)}
                </span>
              </td>

              <td data-label="Título">
                ${item.titulo || '—'}
              </td>

              <td data-label="Mensagem">
                ${item.mensagem || '—'}
              </td>

              <td data-label="Data">
                ${formatDate(item.created_at)}
              </td>

              <td data-label="Ações">
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">

                  ${
                    !item.lida && hasPermission('notificacoes', 'editar')
                      ? `
                        <button
                          type="button"
                          class="btn btn-secondary btn-marcar-lida"
                          data-id="${item.id}"
                        >
                          Marcar como lida
                        </button>
                      `
                      : ''
                  }

                  ${
                    hasPermission('notificacoes', 'excluir')
                      ? `
                        <button
                          type="button"
                          class="btn btn-danger btn-excluir-notificacao"
                          data-id="${item.id}"
                        >
                          Excluir
                        </button>
                      `
                      : ''
                  }

                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderPagina(notificacoes, naoLidas) {
  const podeEditar = hasPermission('notificacoes', 'editar');
  const podeExcluir = hasPermission('notificacoes', 'excluir');
  const podeCriar = hasPermission('notificacoes', 'criar');

  return `
    <div class="page">

      <div class="page-header">
        <div>
          <h1>Notificações</h1>
          <div class="page-subtitle">
            Alertas e mensagens do sistema
          </div>
        </div>

        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">

          ${
            podeCriar
              ? `
                <button
                  type="button"
                  class="btn btn-primary"
                  id="btn-gerar-notificacoes"
                >
                  Verificar notificações
                </button>
              `
              : ''
          }

          ${
            podeEditar && naoLidas > 0
              ? `
                <button
                  type="button"
                  class="btn btn-secondary"
                  id="btn-marcar-todas"
                >
                  Marcar todas como lidas
                </button>
              `
              : ''
          }

          ${
            podeExcluir
              ? `
                <button
                  type="button"
                  class="btn btn-danger"
                  id="btn-excluir-lidas"
                >
                  Excluir lidas
                </button>
              `
              : ''
          }

        </div>
      </div>

      <div class="stats-grid">

        <div class="stat-card">
          <div class="stat-label">Total</div>
          <div class="stat-value">${notificacoes.length}</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Não lidas</div>
          <div class="stat-value">${naoLidas}</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Lidas</div>
          <div class="stat-value">
            ${notificacoes.length - naoLidas}
          </div>
        </div>

      </div>

      <div class="panel">
        ${renderTabela(notificacoes)}
      </div>

    </div>
  `;
}

export async function render(root) {
  if (!hasPermission('notificacoes', 'visualizar')) {
    root.innerHTML =
      '<div class="alert error">Você não tem permissão para visualizar notificações.</div>';
    return;
  }

  root.innerHTML = renderLoading('Carregando notificações...');

  try {
    const dados = await carregarNotificacoes();

    root.innerHTML = renderPagina(
      dados.notificacoes,
      dados.naoLidas
    );

    configurarEventos(root);
  } catch (error) {
    console.error('Erro ao carregar notificações:', error);

    root.innerHTML = `
      <div class="alert error">
        Erro ao carregar notificações.
        ${error?.message || ''}
      </div>
    `;

    showToast(
      error?.message || 'Erro ao carregar notificações.',
      'error'
    );
  }
}

function configurarEventos(root) {
  const btnGerar = root.querySelector('#btn-gerar-notificacoes');

  if (btnGerar) {
    btnGerar.addEventListener('click', async () => {
      btnGerar.disabled = true;
      btnGerar.textContent = 'Verificando...';

      try {
        const resultado = await gerarNotificacoes();

        showToast(
          resultado?.mensagem ||
          'Notificações verificadas com sucesso.',
          'success'
        );

        const dados = await carregarNotificacoes();

        root.innerHTML = renderPagina(
          dados.notificacoes,
          dados.naoLidas
        );

        configurarEventos(root);
      } catch (error) {
        showToast(
          error?.message ||
          'Erro ao verificar notificações.',
          'error'
        );

        btnGerar.disabled = false;
        btnGerar.textContent = 'Verificar notificações';
      }
    });
  }

  const btnMarcarTodas = root.querySelector('#btn-marcar-todas');

  if (btnMarcarTodas) {
    btnMarcarTodas.addEventListener('click', async () => {
      btnMarcarTodas.disabled = true;
      btnMarcarTodas.textContent = 'Atualizando...';

      try {
        const resultado = await api.patch(
          '/api/notificacoes/marcar-todas-lidas',
          {}
        );

        showToast(
          resultado?.mensagem ||
          'Todas as notificações foram marcadas como lidas.',
          'success'
        );

        const dados = await carregarNotificacoes();

        root.innerHTML = renderPagina(
          dados.notificacoes,
          dados.naoLidas
        );

        configurarEventos(root);
      } catch (error) {
        showToast(
          error?.message ||
          'Erro ao marcar notificações como lidas.',
          'error'
        );

        btnMarcarTodas.disabled = false;
        btnMarcarTodas.textContent = 'Marcar todas como lidas';
      }
    });
  }

  const btnExcluirLidas = root.querySelector('#btn-excluir-lidas');

  if (btnExcluirLidas) {
    btnExcluirLidas.addEventListener('click', async () => {
      const confirmar = window.confirm(
        'Deseja realmente excluir todas as notificações lidas?'
      );

      if (!confirmar) {
        return;
      }

      btnExcluirLidas.disabled = true;
      btnExcluirLidas.textContent = 'Excluindo...';

      try {
        const resultado = await api.delete(
          '/api/notificacoes/lidas'
        );

        showToast(
          resultado?.mensagem ||
          'Notificações lidas excluídas.',
          'success'
        );

        const dados = await carregarNotificacoes();

        root.innerHTML = renderPagina(
          dados.notificacoes,
          dados.naoLidas
        );

        configurarEventos(root);
      } catch (error) {
        showToast(
          error?.message ||
          'Erro ao excluir notificações.',
          'error'
        );

        btnExcluirLidas.disabled = false;
        btnExcluirLidas.textContent = 'Excluir lidas';
      }
    });
  }

  root.querySelectorAll('.btn-marcar-lida').forEach((botao) => {
    botao.addEventListener('click', async () => {
      const id = botao.dataset.id;

      botao.disabled = true;
      botao.textContent = 'Atualizando...';

      try {
        await api.patch(
          `/api/notificacoes/${id}/lida`,
          {}
        );

        showToast(
          'Notificação marcada como lida.',
          'success'
        );

        const dados = await carregarNotificacoes();

        root.innerHTML = renderPagina(
          dados.notificacoes,
          dados.naoLidas
        );

        configurarEventos(root);
      } catch (error) {
        showToast(
          error?.message ||
          'Erro ao marcar notificação como lida.',
          'error'
        );

        botao.disabled = false;
        botao.textContent = 'Marcar como lida';
      }
    });
  });

  root.querySelectorAll('.btn-excluir-notificacao').forEach((botao) => {
    botao.addEventListener('click', async () => {
      const id = botao.dataset.id;

      const confirmar = window.confirm(
        'Deseja realmente excluir esta notificação?'
      );

      if (!confirmar) {
        return;
      }

      botao.disabled = true;
      botao.textContent = 'Excluindo...';

      try {
        await api.delete(
          `/api/notificacoes/${id}`
        );

        showToast(
          'Notificação excluída com sucesso.',
          'success'
        );

        const dados = await carregarNotificacoes();

        root.innerHTML = renderPagina(
          dados.notificacoes,
          dados.naoLidas
        );

        configurarEventos(root);
      } catch (error) {
        showToast(
          error?.message ||
          'Erro ao excluir notificação.',
          'error'
        );

        botao.disabled = false;
        botao.textContent = 'Excluir';
      }
    });
  });
}