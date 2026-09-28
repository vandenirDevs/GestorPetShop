import { api } from '../api.js';
import { renderLoading } from '../components/loading.js';
import { showToast } from '../components/toast.js';
import { hasPermission } from '../permissions.js';

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatCurrency = (value) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return 'R$ 0,00';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numeric);
};

const safeNumber = (value) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const renderEmptyState = (message) => `
  <div class="panel">
    <div class="empty-state">${message}</div>
  </div>
`;

async function carregarRelatorios(dataInicio, dataFim) {
  const [vendasResponse, estoqueResponse, clientesResponse, agendaResponse] = await Promise.all([
    api.get('/api/relatorios/vendas', {
      query: {
        data_inicio: dataInicio,
        data_fim: dataFim
      }
    }),
    api.get('/api/relatorios/estoque'),
    api.get('/api/relatorios/clientes'),
    api.get('/api/relatorios/agenda', {
      query: {
        data_inicio: dataInicio,
        data_fim: dataFim
      }
    })
  ]);

  return {
    vendas: vendasResponse?.relatorio || {},
    estoque: estoqueResponse?.resumo || {},
    clientes: clientesResponse?.resumo || {},
    agenda: agendaResponse?.resumo || {},
    produtos: Array.isArray(estoqueResponse?.produtos)
      ? estoqueResponse.produtos
      : [],
    clientesLista: Array.isArray(clientesResponse?.clientes)
      ? clientesResponse.clientes
      : [],
    eventos: Array.isArray(agendaResponse?.eventos)
      ? agendaResponse.eventos
      : []
  };
}

function renderProdutosTable(produtos = []) {
  if (!produtos.length) {
    return renderEmptyState('Nenhum registro encontrado para o período selecionado.');
  }

  const linhas = produtos.map((produto) => `
    <tr>
      <td>${produto.nome || '—'}</td>
      <td>${produto.codigo_barras || '—'}</td>
      <td>${produto.categoria || '—'}</td>
      <td>${produto.marca || '—'}</td>
      <td>${safeNumber(produto.estoque_atual)}</td>
      <td>${safeNumber(produto.estoque_minimo)}</td>
      <td>${formatCurrency(produto.preco_custo)}</td>
      <td>${formatCurrency(produto.preco_venda)}</td>
      <td>${produto.situacao_estoque || '—'}</td>
    </tr>
  `).join('');

  return `
    <div class="table-wrap">
      <table class="table-area">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Código</th>
            <th>Categoria</th>
            <th>Marca</th>
            <th>Estoque</th>
            <th>Estoque mínimo</th>
            <th>Preço custo</th>
            <th>Preço venda</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
  `;
}

function renderClientesTable(clientes = []) {
  if (!clientes.length) {
    return renderEmptyState('Nenhum registro encontrado para o período selecionado.');
  }

  const linhas = clientes.map((cliente) => `
    <tr>
      <td>${cliente.nome || '—'}</td>
      <td>${cliente.cpf_cnpj || '—'}</td>
      <td>${cliente.telefone || '—'}</td>
      <td>${cliente.whatsapp || '—'}</td>
      <td>${cliente.email || '—'}</td>
      <td>${[cliente.cidade, cliente.estado].filter(Boolean).join('/') || '—'}</td>
      <td>${safeNumber(cliente.total_pets)}</td>
    </tr>
  `).join('');

  return `
    <div class="table-wrap">
      <table class="table-area">
        <thead>
          <tr>
            <th>Nome</th>
            <th>CPF/CNPJ</th>
            <th>Telefone</th>
            <th>WhatsApp</th>
            <th>E-mail</th>
            <th>Cidade/Estado</th>
            <th>Total de pets</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
  `;
}

function renderAgendaTable(eventos = []) {
  if (!eventos.length) {
    return renderEmptyState('Nenhum registro encontrado para o período selecionado.');
  }

  const linhas = [...eventos].sort((a, b) => {
    const dataA = a.data || '0000-00-00';
    const dataB = b.data || '0000-00-00';
    const horarioA = a.horario || '00:00:00';
    const horarioB = b.horario || '00:00:00';

    if (dataA !== dataB) {
      return dataA.localeCompare(dataB);
    }

    return horarioA.localeCompare(horarioB);
  }).map((evento) => `
    <tr>
      <td>${evento.data || '—'}</td>
      <td>${evento.horario || '—'}</td>
      <td>${evento.tipo || '—'}</td>
      <td>${evento.cliente_nome || evento.cliente || '—'}</td>
      <td>${evento.pet_nome || evento.pet || '—'}</td>
      <td>${evento.servico_nome || evento.servico || '—'}</td>
      <td>${evento.status || '—'}</td>
      <td>${evento.observacoes || evento.motivo || '—'}</td>
    </tr>
  `).join('');

  return `
    <div class="table-wrap">
      <table class="table-area">
        <thead>
          <tr>
            <th>Data</th>
            <th>Horário</th>
            <th>Tipo</th>
            <th>Cliente</th>
            <th>Pet</th>
            <th>Serviço</th>
            <th>Status</th>
            <th>Observações</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
  `;
}

function renderRelatorioMarkup(relatorios, dataInicio, dataFim) {
  const vendas = relatorios.vendas || {};
  const estoque = relatorios.estoque || {};
  const clientes = relatorios.clientes || {};
  const agenda = relatorios.agenda || {};
  const eventos = Array.isArray(relatorios.eventos) ? relatorios.eventos : [];
  const produtos = Array.isArray(relatorios.produtos) ? relatorios.produtos : [];
  const clientesLista = Array.isArray(relatorios.clientesLista) ? relatorios.clientesLista : [];

  return `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Relatórios</h1>
          <div class="page-subtitle">Período: ${dataInicio} a ${dataFim}</div>
        </div>
      </div>

      <div class="panel" style="margin-bottom: 1.5rem;">
        <form id="relatorios-form" class="filter-form" style="display:flex; flex-wrap:wrap; gap: 1rem; align-items:end;">
          <div>
            <label for="data-inicio">Data inicial</label>
            <input id="data-inicio" type="date" value="${dataInicio}" />
          </div>
          <div>
            <label for="data-fim">Data final</label>
            <input id="data-fim" type="date" value="${dataFim}" />
          </div>
          <div>
            <button type="submit" class="btn btn-primary" id="btn-gerar-relatorio">Gerar relatório</button>
          </div>
        </form>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Vendas finalizadas</div>
          <div class="stat-value">${safeNumber(vendas.vendas_finalizadas)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Vendas canceladas</div>
          <div class="stat-value">${safeNumber(vendas.vendas_canceladas)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Vendas abertas</div>
          <div class="stat-value">${safeNumber(vendas.vendas_abertas)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total vendido</div>
          <div class="stat-value">${formatCurrency(vendas.total_vendido)}</div>
        </div>
      </div>

      <div class="panel">
        <h3>Resumo de vendas</h3>
        <div class="table-wrap">
          <table class="table-area">
            <thead>
              <tr>
                <th>Indicador</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Vendas finalizadas</td><td>${safeNumber(vendas.vendas_finalizadas)}</td></tr>
              <tr><td>Vendas canceladas</td><td>${safeNumber(vendas.vendas_canceladas)}</td></tr>
              <tr><td>Vendas abertas</td><td>${safeNumber(vendas.vendas_abertas)}</td></tr>
              <tr><td>Total vendido</td><td>${formatCurrency(vendas.total_vendido)}</td></tr>
              <tr><td>Total de descontos</td><td>${formatCurrency(vendas.total_descontos)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <h3>Estoque</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total de produtos</div>
            <div class="stat-value">${safeNumber(estoque.total_produtos)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Estoque zerado</div>
            <div class="stat-value">${safeNumber(estoque.estoque_zerado)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Estoque baixo</div>
            <div class="stat-value">${safeNumber(estoque.estoque_baixo)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Estoque normal</div>
            <div class="stat-value">${safeNumber(estoque.estoque_normal)}</div>
          </div>
        </div>
        ${renderProdutosTable(produtos)}
      </div>

      <div class="panel">
        <h3>Clientes</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total de clientes</div>
            <div class="stat-value">${safeNumber(clientes.total_clientes)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total de pets</div>
            <div class="stat-value">${safeNumber(clientes.total_pets)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Clientes com pets</div>
            <div class="stat-value">${safeNumber(clientes.clientes_com_pets)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Clientes sem pets</div>
            <div class="stat-value">${safeNumber(clientes.clientes_sem_pets)}</div>
          </div>
        </div>
        ${renderClientesTable(clientesLista)}
      </div>

      <div class="panel">
        <h3>Agenda</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total de eventos</div>
            <div class="stat-value">${safeNumber(agenda.total_eventos)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total de agendamentos</div>
            <div class="stat-value">${safeNumber(agenda.total_agendamentos)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total de consultas</div>
            <div class="stat-value">${safeNumber(agenda.total_consultas)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Cancelados</div>
            <div class="stat-value">${safeNumber(agenda.agendamentos_cancelados) + safeNumber(agenda.consultas_canceladas)}</div>
          </div>
        </div>
        ${renderAgendaTable(eventos)}
      </div>
    </div>
  `;
}

export async function render(root) {
  if (!hasPermission('relatorios', 'visualizar')) {
    root.innerHTML = '<div class="alert error">Você não tem permissão para visualizar relatórios.</div>';
    return;
  }

  const today = new Date();
  const dataInicio = formatDateInput(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const dataFim = formatDateInput(today);

  const configurarFormulario = () => {
    const formulario = root.querySelector('#relatorios-form');

    if (!formulario) {
      return;
    }

    formulario.addEventListener('submit', async (event) => {
      event.preventDefault();

      const inputInicio = root.querySelector('#data-inicio');
      const inputFim = root.querySelector('#data-fim');
      const botao = root.querySelector('#btn-gerar-relatorio');

      if (!inputInicio || !inputFim) {
        return;
      }

      const proximoInicio = inputInicio.value;
      const proximoFim = inputFim.value;

      if (!proximoInicio || !proximoFim) {
        showToast('Informe a data inicial e a data final.', 'error');
        return;
      }

      if (proximoInicio > proximoFim) {
        showToast('A data inicial não pode ser maior que a data final.', 'error');
        return;
      }

      if (botao) {
        botao.disabled = true;
        botao.textContent = 'Gerando...';
      }

      root.innerHTML = renderLoading('Gerando relatório...');

      try {
        const relatoriosAtualizados = await carregarRelatorios(
          proximoInicio,
          proximoFim
        );

        root.innerHTML = renderRelatorioMarkup(
          relatoriosAtualizados,
          proximoInicio,
          proximoFim
        );

        configurarFormulario();

        showToast('Relatório gerado com sucesso.', 'success');
      } catch (error) {
        console.error('Erro ao gerar relatório:', error);

        root.innerHTML = `
          <div class="alert error">
            Erro ao gerar relatórios.
            ${error?.message || ''}
          </div>
        `;

        showToast(
          error?.message || 'Erro ao gerar relatório.',
          'error'
        );
      }
    });
  };

  root.innerHTML = renderLoading('Carregando relatórios...');

  try {
    const relatorios = await carregarRelatorios(dataInicio, dataFim);

    root.innerHTML = renderRelatorioMarkup(
      relatorios,
      dataInicio,
      dataFim
    );

    configurarFormulario();
  } catch (error) {
    console.error('Erro ao carregar relatórios:', error);

    root.innerHTML = `
      <div class="alert error">
        Erro ao carregar relatórios.
        ${error?.message || ''}
      </div>
    `;

    showToast(
      error?.message || 'Erro ao carregar relatórios.',
      'error'
    );
  }
}