import { api } from '../api.js';
import { renderLoading } from '../components/loading.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { hasPermission } from '../permissions.js';

export async function render(root) {
    if (!hasPermission('prontuario', 'visualizar')) {
        root.innerHTML = '<div class="alert error">Você não tem permissão para visualizar prontuários.</div>';
        return;
    }

    root.innerHTML = renderLoading('Carregando prontuários...');

    try {
        const [prontuariosResponse, petsResponse] = await Promise.all([
            api.get('/api/prontuarios'),
            api.get('/api/pets')
        ]);

        const list = prontuariosResponse.prontuarios || [];
        const pets = petsResponse.pets || petsResponse || [];

        const podeCriar = hasPermission('prontuario', 'criar');
        const podeEditar = hasPermission('prontuario', 'editar');
        const podeExcluir = hasPermission('prontuario', 'excluir');

        root.innerHTML = `
            <div class="page">

                <div class="page-header">
                    <div>
                        <h1>Prontuários</h1>
                        <div class="page-subtitle">
                            Histórico clínico e acompanhamento do animal
                        </div>
                    </div>

                    <div class="page-actions">
                        ${podeCriar ? `
                            <button class="btn" type="button" data-new-prontuario>
                                Novo prontuário
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="panel">
                    <div class="table-wrap">
                        <table class="table-area">
                            <thead>
                                <tr>
                                    <th>Pet</th>
                                    <th>Data</th>
                                    <th>Tipo</th>
                                    <th>Título</th>
                                    <th>Diagnóstico</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>

                            <tbody>
                                ${list.length ? list.map((item) => `
                                    <tr>
                                        <td data-label="Pet">
                                            ${item.pet || '—'}
                                        </td>

                                        <td data-label="Data">
                                            ${formatDate(item.data_registro)}
                                        </td>

                                        <td data-label="Tipo">
                                            ${item.tipo_registro || '—'}
                                        </td>

                                        <td data-label="Título">
                                            ${item.titulo || '—'}
                                        </td>

                                        <td data-label="Diagnóstico">
                                            ${item.diagnostico || '—'}
                                        </td>

                                        <td data-label="Ações">
                                            <div class="table-actions">

                                                ${podeEditar ? `
                                                    <button
                                                        class="btn secondary"
                                                        type="button"
                                                        data-edit-prontuario="${item.id}">
                                                        Editar
                                                    </button>
                                                ` : ''}

                                                ${podeExcluir ? `
                                                    <button
                                                        class="btn danger"
                                                        type="button"
                                                        data-delete-prontuario="${item.id}">
                                                        Excluir
                                                    </button>
                                                ` : ''}

                                            </div>
                                        </td>
                                    </tr>
                                `).join('') : `
                                    <tr>
                                        <td colspan="6">
                                            <div class="empty-state">
                                                Nenhum prontuário encontrado.
                                            </div>
                                        </td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        `;

        if (podeCriar) {
            root.querySelector('[data-new-prontuario]')
                ?.addEventListener('click', () => {
                    openProntuarioModal({ pets });
                });
        }

        root.querySelectorAll('[data-edit-prontuario]').forEach((button) => {
            const item = list.find(
                (prontuario) =>
                    Number(prontuario.id) === Number(button.dataset.editProntuario)
            );

            if (item) {
                button.addEventListener('click', () => {
                    openProntuarioModal({
                        pets,
                        prontuario: item
                    });
                });
            }
        });

        root.querySelectorAll('[data-delete-prontuario]').forEach((button) => {
            button.addEventListener('click', async () => {
                const id = button.dataset.deleteProntuario;

                const confirmar = window.confirm(
                    'Deseja realmente excluir este prontuário?'
                );

                if (!confirmar) {
                    return;
                }

                try {
                    await api.delete(`/api/prontuarios/${id}`);

                    showToast(
                        'Prontuário excluído com sucesso.',
                        'success'
                    );

                    render(root);
                } catch (error) {
                    showToast(
                        error.message || 'Erro ao excluir prontuário.',
                        'error'
                    );
                }
            });
        });

    } catch (error) {
        console.error('Erro ao carregar prontuários:', error);

        root.innerHTML = `
            <div class="alert error">
                Erro ao carregar prontuários.
                ${error.message || ''}
            </div>
        `;
    }
}

function openProntuarioModal({
    pets = [],
    prontuario = null
} = {}) {

    const body = `
        <form id="prontuario-form" class="form-grid">

            <div class="field-group">
                <label for="prontuario-pet">Pet</label>

                <select
                    id="prontuario-pet"
                    name="pet_id"
                    required>

                    <option value="">Selecione</option>

                    ${pets.map((pet) => `
                        <option
                            value="${pet.id}"
                            ${Number(prontuario?.pet_id) === Number(pet.id) ? 'selected' : ''}>
                            ${pet.nome}
                        </option>
                    `).join('')}

                </select>
            </div>

            <div class="field-group">
                <label for="prontuario-data">
                    Data do registro
                </label>

                <input
                    id="prontuario-data"
                    type="date"
                    name="data_registro"
                    value="${prontuario?.data_registro
                        ? String(prontuario.data_registro).slice(0, 10)
                        : new Date().toISOString().slice(0, 10)}"
                    required>
            </div>

            <div class="field-group">
                <label for="prontuario-tipo">
                    Tipo de registro
                </label>

                <select
                    id="prontuario-tipo"
                    name="tipo_registro"
                    required>

                    <option value="">Selecione</option>

                    <option value="CONSULTA"
                        ${prontuario?.tipo_registro === 'CONSULTA' ? 'selected' : ''}>
                        Consulta
                    </option>

                    <option value="VACINA"
                        ${prontuario?.tipo_registro === 'VACINA' ? 'selected' : ''}>
                        Vacina
                    </option>

                    <option value="MEDICAMENTO"
                        ${prontuario?.tipo_registro === 'MEDICAMENTO' ? 'selected' : ''}>
                        Medicamento
                    </option>

                    <option value="EXAME"
                        ${prontuario?.tipo_registro === 'EXAME' ? 'selected' : ''}>
                        Exame
                    </option>

                    <option value="PROCEDIMENTO"
                        ${prontuario?.tipo_registro === 'PROCEDIMENTO' ? 'selected' : ''}>
                        Procedimento
                    </option>

                    <option value="OBSERVACAO"
                        ${prontuario?.tipo_registro === 'OBSERVACAO' ? 'selected' : ''}>
                        Observação
                    </option>

                    <option value="OUTRO"
                        ${prontuario?.tipo_registro === 'OUTRO' ? 'selected' : ''}>
                        Outro
                    </option>

                </select>
            </div>

            <div class="field-group">
                <label for="prontuario-titulo">
                    Título
                </label>

                <input
                    id="prontuario-titulo"
                    type="text"
                    name="titulo"
                    maxlength="150"
                    value="${escapeHtml(prontuario?.titulo || '')}">
            </div>

            <div class="field-group" style="grid-column: 1 / -1;">
                <label for="prontuario-diagnostico">
                    Diagnóstico
                </label>

                <textarea
                    id="prontuario-diagnostico"
                    name="diagnostico"
                    rows="3">${escapeHtml(prontuario?.diagnostico || '')}</textarea>
            </div>

            <div class="field-group" style="grid-column: 1 / -1;">
                <label for="prontuario-sintomas">
                    Sintomas
                </label>

                <textarea
                    id="prontuario-sintomas"
                    name="sintomas"
                    rows="3">${escapeHtml(prontuario?.sintomas || '')}</textarea>
            </div>

            <div class="field-group" style="grid-column: 1 / -1;">
                <label for="prontuario-tratamento">
                    Tratamento
                </label>

                <textarea
                    id="prontuario-tratamento"
                    name="tratamento"
                    rows="3">${escapeHtml(prontuario?.tratamento || '')}</textarea>
            </div>

            <div class="field-group" style="grid-column: 1 / -1;">
                <label for="prontuario-observacoes">
                    Observações
                </label>

                <textarea
                    id="prontuario-observacoes"
                    name="observacoes"
                    rows="3">${escapeHtml(prontuario?.observacoes || '')}</textarea>
            </div>

        </form>
    `;

    const footer = `
        <button
            type="button"
            class="btn ghost"
            data-close-modal>
            Cancelar
        </button>

        <button
            type="submit"
            form="prontuario-form"
            class="btn">
            Salvar
        </button>
    `;

    openModal(
        prontuario ? 'Editar prontuário' : 'Novo prontuário',
        body,
        footer,
        {
            confirmOnClose: !prontuario
        }
    );

    const form = document.getElementById('prontuario-form');

    if (!form) {
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const payload = Object.fromEntries(
            new FormData(form).entries()
        );

        payload.pet_id = Number(payload.pet_id);

        try {
            if (prontuario) {
                await api.put(
                    `/api/prontuarios/${prontuario.id}`,
                    payload
                );

                showToast(
                    'Prontuário atualizado com sucesso.',
                    'success'
                );
            } else {
                await api.post(
                    '/api/prontuarios',
                    payload
                );

                showToast(
                    'Prontuário cadastrado com sucesso.',
                    'success'
                );
            }

            closeModal();

            render(document.getElementById('content-area'));

        } catch (error) {
            showToast(
                error.message || 'Erro ao salvar prontuário.',
                'error'
            );
        }
    });
}

function formatDate(value) {
    if (!value) {
        return '—';
    }

    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleDateString('pt-BR');
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}