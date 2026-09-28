import { api } from '../api.js';
import { renderLoading } from '../components/loading.js';
import { showToast } from '../components/toast.js';
import { hasPermission } from '../permissions.js';

export async function render(root) {
    if (!hasPermission('vendas', 'visualizar')) {
        root.innerHTML = `
            <div class="alert error">
                Você não tem permissão para acessar o PDV.
            </div>
        `;
        return;
    }

    root.innerHTML = renderLoading('Carregando PDV...');

    try {
        const [
    produtosResponse,
    clientesResponse,
    petsResponse,
    agendamentosResponse,
    servicosResponse
] = await Promise.all([
    api.get('/api/produtos'),
    api.get('/api/clientes'),
    api.get('/api/pets'),
    api.get('/api/agendamentos'),
    api.get('/api/servicos')
]);

        const produtos =
            produtosResponse.produtos || produtosResponse || [];

        const clientes =
            clientesResponse.clientes || clientesResponse || [];

        const pets =
            petsResponse.pets || petsResponse || [];

        const agendamentos =
            agendamentosResponse.agendamentos ||
            agendamentosResponse ||
            [];

            const servicos =
    servicosResponse.servicos ||
    servicosResponse ||
    [];

            

        const hoje = new Date();
        const dataHoje =
            `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

        const agendamentosHoje = agendamentos
            .filter((agendamento) => {
                return String(agendamento.data || '').slice(0, 10) === dataHoje;
            })
            .sort((a, b) => {
                return String(a.horario || '')
                    .localeCompare(String(b.horario || ''));
            });

        root.innerHTML = `
            <div class="page pdv-page">

                <div class="page-header">
                    <div>
                        <h1>PDV</h1>
                        <div class="page-subtitle">
                            Frente de caixa e atendimento
                        </div>
                    </div>

                    <div class="page-actions">
                        <span class="status-badge success">
                            Caixa aberto
                        </span>
                    </div>
                </div>

                <div class="pdv-layout">

                    <div class="panel">

                        <div class="panel-header">
                            <div>
                                <h2>Nova venda</h2>

                                <div class="page-subtitle">
                                    Adicione produtos ou serviços ao atendimento
                                </div>
                            </div>
                        </div>

                        <div class="form-grid">

                            <div class="field-group">
                                <label for="pdv-cliente">
                                    Cliente
                                </label>

                                <select id="pdv-cliente">
                                    <option value="">
                                        Consumidor não identificado
                                    </option>

                                    ${clientes.map(cliente => `
                                        <option value="${cliente.id}">
                                            ${cliente.nome}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>

                            <div class="field-group">
                                <label for="pdv-pet">
                                    Pet
                                </label>

                                <select id="pdv-pet">
                                    <option value="">
                                        Selecione o pet
                                    </option>

                                    ${pets.map(pet => `
                                        <option value="${pet.id}">
                                            ${pet.nome}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>

                            <div
    class="field-group"
    style="grid-column: 1 / -1;"
>
    <label for="pdv-item">
        Produto ou Serviço
    </label>

    <div class="pdv-product-row">

        <select id="pdv-item">
            <option value="">
                Selecione um produto ou serviço
            </option>

            <optgroup label="Produtos">

                ${produtos.map(produto => `
                    <option
                        value="produto-${produto.id}"
                    >
                        ${produto.nome}
                        —
                        R$ ${formatMoney(produto.preco_venda)}
                    </option>
                `).join('')}

            </optgroup>

            <optgroup label="Serviços">

                ${servicos.map(servico => `
                    <option
                        value="servico-${servico.id}"
                    >
                        ${servico.nome}
                        —
                        R$ ${formatMoney(
                            servico.preco_medio ||
                            servico.preco ||
                            servico.valor ||
                            0
                        )}
                    </option>
                `).join('')}

            </optgroup>

        </select>

        <input
            id="pdv-quantidade"
            type="number"
            min="1"
            value="1"
            aria-label="Quantidade"
        />

        <button
            type="button"
            class="btn"
            id="pdv-adicionar">
            Adicionar
        </button>

    </div>
</div>

                        <div
    class="table-wrap pdv-cart-table"
    style="margin-top: 24px;"
>
    <table class="table-area">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Quantidade</th>
                                        <th>Valor unitário</th>
                                        <th>Total</th>
                                        <th>Ação</th>
                                    </tr>
                                </thead>

                                <tbody id="pdv-itens">
                                    <tr>
                                        <td colspan="5">
                                            <div class="empty-state">
                                                Nenhum item adicionado.
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                    </div>

                    <div class="panel pdv-resumo">

                        <h2>Resumo</h2>

                        <div class="detail-list">

                            <div>
                                <strong>Subtotal:</strong>
                                <span id="pdv-subtotal">
                                    R$ 0,00
                                </span>
                            </div>

                            <div>
                                <strong>Desconto:</strong>

                                <input
                                    id="pdv-desconto"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value="0"
                                />
                            </div>

                            <div class="pdv-total">
                                <strong>Total:</strong>

                                <strong id="pdv-total">
                                    R$ 0,00
                                </strong>
                            </div>

                        </div>

                        <div
                            class="field-group"
                            style="margin-top: 20px;"
                        >
                            <label for="pdv-pagamento">
                                Forma de pagamento
                            </label>

                            <select id="pdv-pagamento">
                                <option value="DINHEIRO">
                                    Dinheiro
                                </option>

                                <option value="PIX">
                                    PIX
                                </option>

                                <option value="DEBITO">
                                    Débito
                                </option>

                                <option value="CREDITO">
                                    Crédito
                                </option>
                            </select>
                        </div>

                        <button
                            type="button"
                            class="btn"
                            id="pdv-finalizar"
                            style="width: 100%; margin-top: 20px;"
                        >
                            Finalizar venda
                        </button>

                        <button
                            type="button"
                            class="btn ghost"
                            id="pdv-limpar"
                            style="width: 100%; margin-top: 10px;"
                        >
                            Limpar atendimento
                        </button>

                    </div>

                </div>

                <div class="panel" style="margin-top: 24px;">

                    <div class="panel-header">
                        <div>
                            <h2>Atendimentos de hoje</h2>

                            <div class="page-subtitle">
                                Agendamentos programados para hoje
                            </div>
                        </div>
                    </div>

                    <div class="table-wrap">

                        <table class="table-area">

                            <thead>
                                <tr>
                                    <th>Hora</th>
                                    <th>Cliente</th>
                                    <th>Pet</th>
                                    <th>Serviço</th>
                                    <th>Status</th>
                                    <th>Ação</th>
                                </tr>
                            </thead>

                            <tbody id="pdv-agendamentos">

                                ${
                                    agendamentosHoje.length
                                    ? agendamentosHoje.map((agendamento) => `
                                        <tr>

                                            <td data-label="Hora">
                                                ${agendamento.horario || '—'}
                                            </td>

                                            <td data-label="Cliente">
                                                ${agendamento.cliente || '—'}
                                            </td>

                                            <td data-label="Pet">
                                                ${agendamento.pet || '—'}
                                            </td>

                                            <td data-label="Serviço">
                                                ${agendamento.servico || '—'}
                                            </td>

                                            <td data-label="Status">
    <select
        class="pdv-status-select"
        data-status-agendamento="${agendamento.id}"
    >
        ${[
            'AGENDADO',
            'CONFIRMADO',
            'AGUARDANDO',
            'EM_BUSCA',
            'EM_ATENDIMENTO',
            'PRONTO',
            'CONCLUIDO',
            'CANCELADO',
            'NAO_COMPARECEU'
        ].map(status => `
            <option
                value="${status}"
                ${agendamento.status === status ? 'selected' : ''}
            >
                ${status.replaceAll('_', ' ')}
            </option>
        `).join('')}
    </select>
<td data-label="Ação">

    <div class="inline-actions">

        <button
            type="button"
            class="btn secondary"
            data-selecionar-agendamento="${agendamento.id}">
            Selecionar
        </button>

        ${
            agendamento.status === 'AGENDADO'
                ? `
                    <button
                        type="button"
                        class="btn"
                        data-avancar-status="${agendamento.id}"
                        data-proximo-status="CONFIRMADO">
                        Confirmar chegada
                    </button>
                `
                : agendamento.status === 'CONFIRMADO'
                    ? `
                        <button
                            type="button"
                            class="btn"
                            data-avancar-status="${agendamento.id}"
                            data-proximo-status="AGUARDANDO">
                            Colocar em espera
                        </button>
                    `
                    : agendamento.status === 'AGUARDANDO'
                        ? `
                            <button
                                type="button"
                                class="btn"
                                data-avancar-status="${agendamento.id}"
                                data-proximo-status="EM_ATENDIMENTO">
                                Iniciar atendimento
                            </button>
                        `
                        : agendamento.status === 'EM_ATENDIMENTO'
                            ? `
                                <button
                                    type="button"
                                    class="btn"
                                    data-avancar-status="${agendamento.id}"
                                    data-proximo-status="PRONTO">
                                    Marcar como pronto
                                </button>
                            `
                            : agendamento.status === 'PRONTO'
                                ? `
                                    <button
                                        type="button"
                                        class="btn"
                                        data-avancar-status="${agendamento.id}"
                                        data-proximo-status="CONCLUIDO">
                                        Finalizar atendimento
                                    </button>
                                `
                                : ''
        }

    </div>

</td>

                                        </tr>
                                    `).join('')
                                    : `
                                        <tr>
                                            <td colspan="6">
                                                <div class="empty-state">
                                                    Nenhum atendimento agendado para hoje.
                                                </div>
                                            </td>
                                        </tr>
                                    `
                                }

                            </tbody>

                        </table>

                    </div>

                </div>

            </div>
        `;

        const itens = [];

        const itemSelect =
    root.querySelector('#pdv-item');

        const quantidadeInput =
            root.querySelector('#pdv-quantidade');

        const itensBody =
            root.querySelector('#pdv-itens');

        const descontoInput =
            root.querySelector('#pdv-desconto');

        const subtotalElement =
            root.querySelector('#pdv-subtotal');

        const totalElement =
            root.querySelector('#pdv-total');

        function atualizarResumo() {

            const subtotal = itens.reduce(
                (total, item) => total + item.total,
                0
            );

            const desconto = Math.max(
                0,
                Number(descontoInput.value) || 0
            );

            const total = Math.max(
                0,
                subtotal - desconto
            );

            subtotalElement.textContent =
                `R$ ${formatMoney(subtotal)}`;

            totalElement.textContent =
                `R$ ${formatMoney(total)}`;
        }

        function renderItens() {

            if (!itens.length) {

                itensBody.innerHTML = `
                    <tr>
                        <td colspan="5">
                            <div class="empty-state">
                                Nenhum item adicionado.
                            </div>
                        </td>
                    </tr>
                `;

                atualizarResumo();
                return;
            }

            itensBody.innerHTML = itens.map((item, index) => `
                <tr>

                    <td data-label="Item">
                        ${item.nome}
                    </td>

                    <td data-label="Quantidade">
                        ${item.quantidade}
                    </td>

                    <td data-label="Valor unitário">
                        R$ ${formatMoney(item.preco)}
                    </td>

                    <td data-label="Total">
                        R$ ${formatMoney(item.total)}
                    </td>

                    <td data-label="Ação">

                        <button
                            type="button"
                            class="btn danger"
                            data-remover-item="${index}">
                            Remover
                        </button>

                    </td>

                </tr>
            `).join('');

            root.querySelectorAll('[data-remover-item]')
                .forEach(button => {

                    button.addEventListener('click', () => {

                        const index =
                            Number(button.dataset.removerItem);

                        itens.splice(index, 1);

                        renderItens();
                    });

                });

            atualizarResumo();
        }

        root.querySelector('#pdv-adicionar')
    .addEventListener('click', () => {

        const valorSelecionado =
            itemSelect.value;

        const quantidade =
            Number(quantidadeInput.value);

        if (!valorSelecionado) {

            showToast(
                'Selecione um produto ou serviço.',
                'warning'
            );

            return;
        }

        if (!quantidade || quantidade < 1) {

            showToast(
                'Informe uma quantidade válida.',
                'warning'
            );

            return;
        }

        const [tipo, id] =
            valorSelecionado.split('-');

        const itemId =
            Number(id);

        let item;

        if (tipo === 'produto') {

            const produto =
                produtos.find(
                    item =>
                        Number(item.id) === itemId
                );

            if (!produto) {

                showToast(
                    'Produto não encontrado.',
                    'error'
                );

                return;
            }

            item = {
                tipo: 'PRODUTO',
                produto_id: itemId,
                servico_id: null,
                nome: produto.nome,
                preco: Number(
                    produto.preco_venda || 0
                ),
                quantidade
            };

        } else if (tipo === 'servico') {

            const servico =
                servicos.find(
                    item =>
                        Number(item.id) === itemId
                );

            if (!servico) {

                showToast(
                    'Serviço não encontrado.',
                    'error'
                );

                return;
            }

            item = {
                tipo: 'SERVICO',
                produto_id: null,
                servico_id: itemId,
                nome: servico.nome,
                preco: Number(
                    servico.preco_medio ||
                    servico.preco ||
                    servico.valor ||
                    0
                ),
                quantidade
            };

        }

        item.total =
            item.preco *
            item.quantidade;

        const itemExistente =
            itens.find(
                existente =>
                    existente.tipo === item.tipo &&
                    (
                        item.tipo === 'PRODUTO'
                            ? Number(existente.produto_id) === itemId
                            : Number(existente.servico_id) === itemId
                    )
            );

        if (itemExistente) {

            itemExistente.quantidade +=
                quantidade;

            itemExistente.total =
                itemExistente.quantidade *
                itemExistente.preco;

        } else {

            itens.push(item);

        }

        itemSelect.value = '';

        quantidadeInput.value = '1';

        renderItens();
    });

       root.querySelectorAll('[data-selecionar-agendamento]').forEach((button) => {
    button.addEventListener('click', () => {

        const agendamento = agendamentosHoje.find(
            (item) =>
                String(item.id) ===
                String(button.dataset.selecionarAgendamento)
        );

        if (!agendamento) {
            showToast('Agendamento não encontrado.', 'error');
            return;
        }

        const clienteSelect =
            root.querySelector('#pdv-cliente');

        const petSelect =
            root.querySelector('#pdv-pet');

        if (clienteSelect && agendamento.cliente_id != null) {
            clienteSelect.value =
                String(agendamento.cliente_id);

            clienteSelect.dispatchEvent(
                new Event('change', { bubbles: true })
            );
        }

        if (petSelect && agendamento.pet_id != null) {
            petSelect.value =
                String(agendamento.pet_id);

            petSelect.dispatchEvent(
                new Event('change', { bubbles: true })
            );
        }

        showToast(
            `Agendamento selecionado: ${agendamento.pet || 'Pet'}${agendamento.cliente ? ` - ${agendamento.cliente}` : ''}`,
            'success'
        );
    });
});

root.querySelectorAll('[data-avancar-status]').forEach((button) => {

    button.addEventListener('click', async () => {

        const agendamentoId =
            button.dataset.avancarStatus;

        const proximoStatus =
            button.dataset.proximoStatus;

        try {

            await api.patch(
                `/api/agendamentos/${agendamentoId}/status`,
                {
                    status: proximoStatus
                }
            );

            showToast(
                `Atendimento alterado para ${proximoStatus.replaceAll('_', ' ')}.`,
                'success'
            );

            await render(root);
            console.log('PDV recarregado após alteração de status');

        } catch (error) {

            showToast(
                error.message ||
                'Erro ao atualizar o atendimento.',
                'error'
            );

        }

    });

});

root.querySelectorAll('[data-status-agendamento]').forEach((select) => {
    select.addEventListener('change', async () => {

        const agendamentoId =
            select.dataset.statusAgendamento;

        const novoStatus =
            select.value;

        try {
            await api.patch(
                `/api/agendamentos/${agendamentoId}/status`,
                {
                    status: novoStatus
                }
            );

            showToast(
                `Status alterado para ${novoStatus.replaceAll('_', ' ')}.`,
                'success'
            );

            await render(root);

        } catch (error) {

            showToast(
                error.message ||
                'Erro ao atualizar status do agendamento.',
                'error'
            );

            render(root);
        }
    });
});

    } catch (error) {

        console.error(
            'Erro ao carregar PDV:',
            error
        );

        root.innerHTML = `
            <div class="alert error">
                Erro ao carregar o PDV.
                ${error.message || ''}
            </div>
        `;
    }
}

function formatMoney(value) {

    return Number(value || 0)
        .toFixed(2)
        .replace('.', ',');
}

