const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const pool = require('./config/database');


const app = express();

app.use(cors());
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        message: 'API do Pet Shop funcionando!'
    });
});

const autenticarToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Token de acesso não informado.'
        });
    }

    const partes = authHeader.split(' ');

    if (partes.length !== 2 || partes[0] !== 'Bearer') {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Formato do token inválido.'
        });
    }

    const token = partes[1];

    try {
        const usuario = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.usuario = usuario;

        next();

    } catch (error) {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Token inválido ou expirado.'
        });
    }
};

const verificarPermissao = (modulo, acao) => {
    return async (req, res, next) => {
        try {
            if (!req.usuario) {
                return res.status(401).json({
                    sucesso: false,
                    mensagem: 'Usuário não autenticado.'
                });
            }

            const result = await pool.query(`
                SELECT
                    visualizar,
                    criar,
                    editar,
                    excluir
                FROM permissoes
                WHERE perfil = $1
                  AND modulo = $2
            `, [req.usuario.perfil, modulo]);

            if (result.rows.length === 0) {
                return res.status(403).json({
                    sucesso: false,
                    mensagem: 'Permissão não configurada para este módulo.'
                });
            }

            const permissao = result.rows[0];

            if (!permissao[acao]) {
                return res.status(403).json({
                    sucesso: false,
                    mensagem: 'Você não possui permissão para realizar esta ação.'
                });
            }

            next();

        } catch (error) {
            console.error('Erro ao verificar permissão:', error);

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao verificar permissão.'
            });
        }
    };
};


app.get('/teste-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');

        res.json({
            sucesso: true,
            mensagem: 'Conexão com PostgreSQL funcionando!',
            horarioBanco: result.rows[0].now
        });
    } catch (error) {
        console.error('Erro ao conectar ao banco:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao conectar ao PostgreSQL.'
        });
    }
});

const PORT = 3000;
app.get(
    '/api/agendamentos',
    autenticarToken,
    verificarPermissao('agendamentos', 'visualizar'),
    async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                a.id,
                a.data,
                a.horario,
                a.status,
                a.observacoes,

                c.id AS cliente_id,
                c.nome AS cliente,

                p.id AS pet_id,
                p.nome AS pet,

                s.id AS servico_id,
                s.nome AS servico,
                s.preco AS valor_servico,

                u.id AS usuario_id,
                u.nome AS responsavel

            FROM agendamentos a

            INNER JOIN pets p
                ON a.pet_id = p.id

            INNER JOIN clientes c
                ON p.cliente_id = c.id

            INNER JOIN servicos s
                ON a.servico_id = s.id

            LEFT JOIN usuarios u
                ON a.usuario_id = u.id

            ORDER BY a.data ASC, a.horario ASC
        `);

        res.json(result.rows);

    } catch (error) {
        console.error('Erro ao buscar agendamentos:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao buscar agendamentos.'
        });
    }
});
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});


app.get(
    '/api/clientes',
    autenticarToken,
    verificarPermissao('clientes', 'visualizar'),
    async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                nome,
                cpf_cnpj,
                telefone,
                whatsapp,
                email,
                cidade,
                estado,
                ativo
            FROM clientes
WHERE ativo = TRUE
ORDER BY nome ASC
        `);

        res.json(result.rows);

    } catch (error) {
        console.error('Erro ao buscar clientes:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao buscar clientes.'
        });
    }
});

app.post(
    '/api/clientes',
    autenticarToken,
    verificarPermissao('clientes', 'criar'),
    async (req, res) => {
    try {
        const {
            nome,
            cpf_cnpj,
            telefone,
            whatsapp,
            email,
            cep,
            endereco,
            numero,
            complemento,
            bairro,
            cidade,
            estado,
            observacoes
        } = req.body;

        if (!nome) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'O nome do cliente é obrigatório.'
            });
        }

        const result = await pool.query(`
            INSERT INTO clientes (
                nome,
                cpf_cnpj,
                telefone,
                whatsapp,
                email,
                cep,
                endereco,
                numero,
                complemento,
                bairro,
                cidade,
                estado,
                observacoes
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13
            )
            RETURNING *
        `, [
            nome,
            cpf_cnpj,
            telefone,
            whatsapp,
            email,
            cep,
            endereco,
            numero,
            complemento,
            bairro,
            cidade,
            estado,
            observacoes
        ]);

        res.status(201).json({
            sucesso: true,
            mensagem: 'Cliente cadastrado com sucesso.',
            cliente: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao cadastrar cliente:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao cadastrar cliente.'
        });
    }
});

app.put(
    '/api/clientes/:id',
    autenticarToken,
    verificarPermissao('clientes', 'editar'),
    async (req, res) => {
    try {
        const { id } = req.params;

        const {
            nome,
            cpf_cnpj,
            telefone,
            whatsapp,
            email,
            cep,
            endereco,
            numero,
            complemento,
            bairro,
            cidade,
            estado,
            observacoes
        } = req.body;

        if (!nome) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'O nome do cliente é obrigatório.'
            });
        }

        const result = await pool.query(`
            UPDATE clientes
            SET
                nome = $1,
                cpf_cnpj = $2,
                telefone = $3,
                whatsapp = $4,
                email = $5,
                cep = $6,
                endereco = $7,
                numero = $8,
                complemento = $9,
                bairro = $10,
                cidade = $11,
                estado = $12,
                observacoes = $13,
                updated_at = NOW()
            WHERE id = $14
            RETURNING *
        `, [
            nome,
            cpf_cnpj,
            telefone,
            whatsapp,
            email,
            cep,
            endereco,
            numero,
            complemento,
            bairro,
            cidade,
            estado,
            observacoes,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Cliente não encontrado.'
            });
        }

        res.json({
            sucesso: true,
            mensagem: 'Cliente atualizado com sucesso.',
            cliente: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao atualizar cliente:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao atualizar cliente.'
        });
    }
});

app.delete(
    '/api/clientes/:id',
    autenticarToken,
    verificarPermissao('clientes', 'excluir'),
    async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            UPDATE clientes
            SET
                ativo = FALSE,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Cliente não encontrado.'
            });
        }

        res.json({
            sucesso: true,
            mensagem: 'Cliente desativado com sucesso.',
            cliente: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao desativar cliente:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao desativar cliente.'
        });
    }
});

app.get(
    '/api/pets',
    autenticarToken,
    verificarPermissao('pets', 'visualizar'),
    async (req, res) => {
    try {
        const result = await pool.query(`
    SELECT
        p.id,
        p.cliente_id,
        c.nome AS cliente_nome,
        p.nome,
        p.especie,
        p.raca,
        p.sexo,
        p.data_nascimento,
        p.peso,
        p.cor,
        p.microchip,
        p.observacoes,
        p.ativo
    FROM pets p
    INNER JOIN clientes c ON c.id = p.cliente_id
    WHERE p.ativo = TRUE
    ORDER BY p.nome ASC
`);
        res.json(result.rows);

    } catch (error) {
        console.error('Erro ao buscar pets:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao buscar pets.'
        });
    }
});

app.post(
    '/api/pets',
    autenticarToken,
    verificarPermissao('pets', 'criar'),
    async (req, res) => {
    try {
        const {
            cliente_id,
            nome,
            especie,
            raca,
            sexo,
            data_nascimento,
            peso,
            cor,
            microchip,
            observacoes
        } = req.body;

        if (!cliente_id || !nome || !especie) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Cliente, nome e espécie são obrigatórios.'
            });
        }

        const result = await pool.query(`
            INSERT INTO pets (
                cliente_id,
                nome,
                especie,
                raca,
                sexo,
                data_nascimento,
                peso,
                cor,
                microchip,
                observacoes
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10
            )
            RETURNING *
        `, [
            cliente_id,
            nome,
            especie,
            raca,
            sexo,
            data_nascimento,
            peso,
            cor,
            microchip,
            observacoes
        ]);

        res.status(201).json({
            sucesso: true,
            mensagem: 'Pet cadastrado com sucesso.',
            pet: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao cadastrar pet:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao cadastrar pet.'
        });
    }
});

app.put('/api/pets/:id',
    autenticarToken,
    verificarPermissao('pets', 'editar'),
    async (req, res) => {
    try {
        const { id } = req.params;

        const {
            cliente_id,
            nome,
            especie,
            raca,
            sexo,
            data_nascimento,
            peso,
            cor,
            microchip,
            observacoes
        } = req.body;

        if (!cliente_id || !nome || !especie) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Cliente, nome e espécie são obrigatórios.'
            });
        }

        const result = await pool.query(`
            UPDATE pets
            SET
                cliente_id = $1,
                nome = $2,
                especie = $3,
                raca = $4,
                sexo = $5,
                data_nascimento = $6,
                peso = $7,
                cor = $8,
                microchip = $9,
                observacoes = $10,
                updated_at = NOW()
            WHERE id = $11
            RETURNING *
        `, [
            cliente_id,
            nome,
            especie,
            raca,
            sexo,
            data_nascimento,
            peso,
            cor,
            microchip,
            observacoes,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Pet não encontrado.'
            });
        }

        res.json({
            sucesso: true,
            mensagem: 'Pet atualizado com sucesso.',
            pet: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao atualizar pet:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao atualizar pet.'
        });
    }
});

app.delete(
    '/api/pets/:id',
    autenticarToken,
    verificarPermissao('pets', 'excluir'),
    async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            UPDATE pets
            SET
                ativo = FALSE,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Pet não encontrado.'
            });
        }

        res.json({
            sucesso: true,
            mensagem: 'Pet desativado com sucesso.',
            pet: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao desativar pet:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao desativar pet.'
        });
    }
});

app.post(
    '/api/servicos',
    autenticarToken,
    verificarPermissao('servicos', 'criar'),
    async (req, res) => {
    try {
        const {
            nome,
            descricao,
            preco,
            duracao_minutos
        } = req.body;

        if (!nome) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'O nome do serviço é obrigatório.'
            });
        }

        const result = await pool.query(`
            INSERT INTO servicos (
                nome,
                descricao,
                preco,
                duracao_minutos
            )
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [
            nome,
            descricao,
            preco,
            duracao_minutos
        ]);

        res.status(201).json({
            sucesso: true,
            mensagem: 'Serviço cadastrado com sucesso.',
            servico: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao cadastrar serviço:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao cadastrar serviço.'
        });
    }
});

app.put(
    '/api/servicos/:id',
    autenticarToken,
    verificarPermissao('servicos', 'editar'),
    async (req, res) => {
    try {
        const { id } = req.params;

        const {
            nome,
            descricao,
            preco,
            duracao_minutos
        } = req.body;

        if (!nome) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'O nome do serviço é obrigatório.'
            });
        }

        const result = await pool.query(`
            UPDATE servicos
            SET
                nome = $1,
                descricao = $2,
                preco = $3,
                duracao_minutos = $4,
                updated_at = NOW()
            WHERE id = $5
            RETURNING *
        `, [
            nome,
            descricao,
            preco,
            duracao_minutos,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Serviço não encontrado.'
            });
        }

        res.json({
            sucesso: true,
            mensagem: 'Serviço atualizado com sucesso.',
            servico: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao atualizar serviço:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao atualizar serviço.'
        });
    }
});

app.delete(
    '/api/servicos/:id',
    autenticarToken,
    verificarPermissao('servicos', 'excluir'),
    async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            UPDATE servicos
            SET
                ativo = FALSE,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Serviço não encontrado.'
            });
        }

        res.json({
            sucesso: true,
            mensagem: 'Serviço desativado com sucesso.',
            servico: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao desativar serviço:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao desativar serviço.'
        });
    }
});

app.post(
    '/api/agendamentos',
    autenticarToken,
    verificarPermissao('agendamentos', 'criar'),
    async (req, res) => {
    try {
        const {
            pet_id,
            servico_id,
            usuario_id,
            data,
            horario,
            status,
            observacoes
        } = req.body;

        if (!pet_id || !servico_id || !data || !horario) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Pet, serviço, data e horário são obrigatórios.'
            });
        }

        const result = await pool.query(`
            INSERT INTO agendamentos (
                pet_id,
                servico_id,
                usuario_id,
                data,
                horario,
                status,
                observacoes
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7
            )
            RETURNING *
        `, [
            pet_id,
            servico_id,
            usuario_id || null,
            data,
            horario,
            status || 'AGENDADO',
            observacoes
        ]);

        res.status(201).json({
            sucesso: true,
            mensagem: 'Agendamento cadastrado com sucesso.',
            agendamento: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao cadastrar agendamento:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao cadastrar agendamento.'
        });
    }
});

app.put(
    '/api/agendamentos/:id',
    autenticarToken,
    verificarPermissao('agendamentos', 'editar'),
    async (req, res) => {
    try {
        const { id } = req.params;

        const {
            pet_id,
            servico_id,
            usuario_id,
            data,
            horario,
            status,
            observacoes
        } = req.body;

        if (!pet_id || !servico_id || !data || !horario) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Pet, serviço, data e horário são obrigatórios.'
            });
        }

        const result = await pool.query(`
            UPDATE agendamentos
            SET
                pet_id = $1,
                servico_id = $2,
                usuario_id = $3,
                data = $4,
                horario = $5,
                status = $6,
                observacoes = $7,
                updated_at = NOW()
            WHERE id = $8
            RETURNING *
        `, [
            pet_id,
            servico_id,
            usuario_id || null,
            data,
            horario,
            status || 'AGENDADO',
            observacoes,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Agendamento não encontrado.'
            });
        }

        res.json({
            sucesso: true,
            mensagem: 'Agendamento atualizado com sucesso.',
            agendamento: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao atualizar agendamento:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao atualizar agendamento.'
        });
    }
});

app.patch(
    '/api/agendamentos/:id/cancelar',
    autenticarToken,
    verificarPermissao('agendamentos', 'excluir'),
    async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            UPDATE agendamentos
            SET
                status = 'CANCELADO',
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Agendamento não encontrado.'
            });
        }

        res.json({
            sucesso: true,
            mensagem: 'Agendamento cancelado com sucesso.',
            agendamento: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao cancelar agendamento:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao cancelar agendamento.'
        });
    }
});

app.get(
    '/api/servicos',
    autenticarToken,
    verificarPermissao('servicos', 'visualizar'),
    async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                nome,
                descricao,
                preco,
                duracao_minutos,
                ativo
            FROM servicos
            WHERE ativo = TRUE
            ORDER BY nome ASC
        `);

        res.json(result.rows);

    } catch (error) {
        console.error('Erro ao buscar serviços:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao buscar serviços.'
        });
    }
});




app.post('/api/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'E-mail e senha são obrigatórios.'
            });
        }

        const result = await pool.query(`
            SELECT
                id,
                nome,
                email,
                senha,
                perfil,
                ativo
            FROM usuarios
            WHERE email = $1
            LIMIT 1
        `, [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'E-mail ou senha inválidos.'
            });
        }

        const usuario = result.rows[0];

        if (!usuario.ativo) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Usuário está inativo.'
            });
        }

        const senhaValida = await bcrypt.compare(
            senha,
            usuario.senha
        );

        if (!senhaValida) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'E-mail ou senha inválidos.'
            });
        }

        const token = jwt.sign(
            {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                perfil: usuario.perfil
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '8h'
            }
        );

        res.json({
            sucesso: true,
            mensagem: 'Login realizado com sucesso.',
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                perfil: usuario.perfil
            }
        });

    } catch (error) {
        console.error('Erro ao realizar login:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro interno ao realizar login.'
        });
    }
});

app.get('/api/me', autenticarToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                nome,
                email,
                perfil,
                ativo
            FROM usuarios
            WHERE id = $1
            LIMIT 1
        `, [req.usuario.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Usuário não encontrado.'
            });
        }

        const usuario = result.rows[0];

        if (!usuario.ativo) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Usuário está inativo.'
            });
        }

        res.json({
            sucesso: true,
            usuario
        });

    } catch (error) {
        console.error('Erro ao buscar usuário autenticado:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao buscar usuário autenticado.'
        });
    }
});



const verificarPerfil = (...perfisPermitidos) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Usuário não autenticado.'
            });
        }

        if (!perfisPermitidos.includes(req.usuario.perfil)) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Você não tem permissão para realizar esta ação.'
            });
        }

        next();
    };
};




app.get(
    '/api/permissoes/teste',
    autenticarToken,
    verificarPermissao('clientes', 'excluir'),
    async (req, res) => {
        res.json({
            sucesso: true,
            mensagem: 'Permissão de exclusão de clientes autorizada.',
            perfil: req.usuario.perfil
        });
    }
);

app.get(
    '/api/permissoes',
    autenticarToken,
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    modulo,
                    visualizar,
                    criar,
                    editar,
                    excluir
                FROM permissoes
                WHERE perfil = $1
                ORDER BY modulo
            `, [req.usuario.perfil]);

            res.json({
                sucesso: true,
                perfil: req.usuario.perfil,
                permissoes: result.rows
            });

        } catch (error) {
            console.error('Erro ao carregar permissões:', error);

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao carregar permissões.'
            });
        }
    }
);

app.post('/api/vacinas', autenticarToken, verificarPerfil('ADMIN', 'GERENTE'), verificarPermissao('vacinas', 'criar'), async (req, res) => {
    try {
        const {
            nome,
            fabricante,
            descricao,
            intervalo_dias
        } = req.body;

        if (!nome) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Nome da vacina é obrigatório.'
            });
        }

        const intervalo = intervalo_dias === undefined
            ? null
            : Number(intervalo_dias);

        if (
            intervalo !== null &&
            (!Number.isInteger(intervalo) || intervalo <= 0)
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'O intervalo em dias deve ser um número inteiro maior que zero.'
            });
        }

        const result = await pool.query(`
            INSERT INTO vacinas (
                nome,
                fabricante,
                descricao,
                intervalo_dias
            )
            VALUES ($1, $2, $3, $4)
            RETURNING
                id,
                nome,
                fabricante,
                descricao,
                intervalo_dias,
                ativo,
                created_at,
                updated_at
        `, [
            nome,
            fabricante || null,
            descricao || null,
            intervalo
        ]);

        res.status(201).json({
            sucesso: true,
            mensagem: 'Vacina cadastrada com sucesso.',
            vacina: result.rows[0]
        });

    } catch (error) {
        console.error(
            'Erro ao cadastrar vacina:',
            error
        );

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro interno ao cadastrar vacina.'
        });
    }
});

app.get('/api/vacinas', autenticarToken, verificarPermissao('vacinas', 'visualizar'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                nome,
                fabricante,
                descricao,
                intervalo_dias,
                ativo,
                created_at,
                updated_at
            FROM vacinas
            WHERE ativo = TRUE
            ORDER BY nome ASC
        `);

        res.json({
            sucesso: true,
            total_registros: result.rows.length,
            vacinas: result.rows
        });

    } catch (error) {
        console.error(
            'Erro ao listar vacinas:',
            error
        );

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro interno ao listar vacinas.'
        });
    }
});

app.patch('/api/vacinas/:id', autenticarToken, verificarPerfil('ADMIN', 'GERENTE'), verificarPermissao('vacinas', 'editar'), async (req, res) => {
    try {
        const { id } = req.params;

        const {
            nome,
            fabricante,
            descricao,
            intervalo_dias
        } = req.body;

        if (!nome) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Nome da vacina é obrigatório.'
            });
        }

        const intervalo = intervalo_dias === undefined
            ? null
            : Number(intervalo_dias);

        if (
            intervalo !== null &&
            (!Number.isInteger(intervalo) || intervalo <= 0)
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'O intervalo em dias deve ser um número inteiro maior que zero.'
            });
        }

        const result = await pool.query(`
            UPDATE vacinas
            SET
                nome = $1,
                fabricante = $2,
                descricao = $3,
                intervalo_dias = $4,
                updated_at = NOW()
            WHERE id = $5
            RETURNING
                id,
                nome,
                fabricante,
                descricao,
                intervalo_dias,
                ativo,
                created_at,
                updated_at
        `, [
            nome,
            fabricante || null,
            descricao || null,
            intervalo,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Vacina não encontrada.'
            });
        }

        res.json({
            sucesso: true,
            mensagem: 'Vacina atualizada com sucesso.',
            vacina: result.rows[0]
        });

    } catch (error) {
        console.error(
            'Erro ao atualizar vacina:',
            error
        );

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro interno ao atualizar vacina.'
        });
    }
});

app.delete('/api/vacinas/:id',
    autenticarToken,
    verificarPerfil('ADMIN', 'GERENTE'),
    verificarPermissao('vacinas', 'excluir'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const result = await pool.query(`
                UPDATE vacinas
                SET
                    ativo = FALSE,
                    updated_at = NOW()
                WHERE id = $1
                  AND ativo = TRUE
                RETURNING
                    id,
                    nome
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Vacina não encontrada ou já está desativada.'
                });
            }

            res.json({
                sucesso: true,
                mensagem: 'Vacina desativada com sucesso.',
                vacina: result.rows[0]
            });

        } catch (error) {

            console.error(
                'Erro ao desativar vacina:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao desativar vacina.'
            });
        }
    }
);

app.post('/api/aplicacoes-vacinas',
    autenticarToken,
    verificarPermissao('vacinas', 'criar'),
    async (req, res) => {
        try {
            const {
                pet_id,
                vacina_id,
                data_aplicacao,
                proxima_dose,
                lote,
                fabricante,
                observacoes
            } = req.body;

            if (!pet_id || !vacina_id || !data_aplicacao) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Pet, vacina e data da aplicação são obrigatórios.'
                });
            }

            const petResult = await pool.query(`
                SELECT id, nome, ativo
                FROM pets
                WHERE id = $1
                LIMIT 1
            `, [pet_id]);

            if (petResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Pet não encontrado.'
                });
            }

            if (!petResult.rows[0].ativo) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O pet está inativo.'
                });
            }

            const vacinaResult = await pool.query(`
                SELECT
                    id,
                    nome,
                    fabricante,
                    ativo
                FROM vacinas
                WHERE id = $1
                LIMIT 1
            `, [vacina_id]);

            if (vacinaResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Vacina não encontrada.'
                });
            }

            if (!vacinaResult.rows[0].ativo) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'A vacina está inativa.'
                });
            }

            const result = await pool.query(`
                INSERT INTO aplicacoes_vacinas (
                    pet_id,
                    vacina_id,
                    usuario_id,
                    data_aplicacao,
                    proxima_dose,
                    lote,
                    fabricante,
                    observacoes
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8
                )
                RETURNING
                    id,
                    pet_id,
                    vacina_id,
                    usuario_id,
                    data_aplicacao,
                    proxima_dose,
                    lote,
                    fabricante,
                    observacoes,
                    created_at,
                    updated_at
            `, [
                pet_id,
                vacina_id,
                req.usuario.id,
                data_aplicacao,
                proxima_dose || null,
                lote || null,
                fabricante || null,
                observacoes || null
            ]);

            res.status(201).json({
                sucesso: true,
                mensagem: 'Aplicação de vacina registrada com sucesso.',
                aplicacao: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao registrar aplicação de vacina:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao registrar aplicação de vacina.'
            });
        }
    }
);

app.get('/api/aplicacoes-vacinas',
    autenticarToken,
    verificarPermissao('vacinas', 'visualizar'),
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    av.id,
                    av.pet_id,
                    p.nome AS pet,
                    av.vacina_id,
                    v.nome AS vacina,
                    av.usuario_id,
                    u.nome AS usuario,
                    av.data_aplicacao,
                    av.proxima_dose,
                    av.lote,
                    av.fabricante,
                    av.observacoes,
                    av.created_at,
                    av.updated_at
                FROM aplicacoes_vacinas av
JOIN pets p ON p.id = av.pet_id
JOIN vacinas v ON v.id = av.vacina_id
LEFT JOIN usuarios u ON u.id = av.usuario_id
WHERE av.ativo = TRUE
ORDER BY av.data_aplicacao DESC, av.id DESC
            `);

            res.json({
                sucesso: true,
                total_registros: result.rows.length,
                aplicacoes: result.rows
            });

        } catch (error) {
            console.error(
                'Erro ao listar aplicações de vacinas:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao listar aplicações de vacinas.'
            });
        }
    }
);

app.post('/api/consultas',
    autenticarToken,
    verificarPermissao('consultas', 'criar'),
    async (req, res) => {
        try {
            const {
                pet_id,
                data_consulta,
                horario,
                motivo,
                observacoes,
                status
            } = req.body;

            if (!pet_id || !data_consulta) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Pet e data da consulta são obrigatórios.'
                });
            }

            const petResult = await pool.query(`
                SELECT id, ativo
                FROM pets
                WHERE id = $1
                LIMIT 1
            `, [pet_id]);

            if (petResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Pet não encontrado.'
                });
            }

            if (!petResult.rows[0].ativo) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O pet está inativo.'
                });
            }

            const statusConsulta = status || 'AGENDADA';

            const result = await pool.query(`
                INSERT INTO consultas (
                    pet_id,
                    usuario_id,
                    data_consulta,
                    horario,
                    motivo,
                    observacoes,
                    status
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING
                    id,
                    pet_id,
                    usuario_id,
                    data_consulta,
                    horario,
                    motivo,
                    observacoes,
                    status,
                    created_at,
                    updated_at
            `, [
                pet_id,
                req.usuario.id,
                data_consulta,
                horario || null,
                motivo || null,
                observacoes || null,
                statusConsulta
            ]);

            res.status(201).json({
                sucesso: true,
                mensagem: 'Consulta cadastrada com sucesso.',
                consulta: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao cadastrar consulta:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao cadastrar consulta.'
            });
        }
    }
);

app.get('/api/consultas',
    autenticarToken,
    verificarPermissao('consultas', 'visualizar'),
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    c.id,
                    c.pet_id,
                    p.nome AS pet_nome,
                    p.especie,
                    p.raca,

                    cli.id AS cliente_id,
                    cli.nome AS cliente_nome,

                    c.usuario_id,
                    u.nome AS usuario_nome,

                    c.data_consulta,
                    c.horario,
                    c.motivo,
                    c.observacoes,
                    c.status,
                    c.created_at,
                    c.updated_at

                FROM consultas c

                INNER JOIN pets p
                    ON p.id = c.pet_id

                INNER JOIN clientes cli
                    ON cli.id = p.cliente_id

                LEFT JOIN usuarios u
                    ON u.id = c.usuario_id

                ORDER BY
                    c.data_consulta DESC,
                    c.horario DESC NULLS LAST,
                    c.id DESC
            `);

            res.json({
                sucesso: true,
                total: result.rows.length,
                consultas: result.rows
            });

        } catch (error) {
            console.error(
                'Erro ao listar consultas:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao listar consultas.'
            });
        }
    }
);

app.patch('/api/consultas/:id',
    autenticarToken,
    verificarPermissao('consultas', 'editar'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const {
                pet_id,
                data_consulta,
                horario,
                motivo,
                observacoes,
                status
            } = req.body;

            if (!pet_id || !data_consulta) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Pet e data da consulta são obrigatórios.'
                });
            }

            const petResult = await pool.query(`
                SELECT id, ativo
                FROM pets
                WHERE id = $1
                LIMIT 1
            `, [pet_id]);

            if (petResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Pet não encontrado.'
                });
            }

            if (!petResult.rows[0].ativo) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O pet está inativo.'
                });
            }

            const consultaResult = await pool.query(`
                SELECT id
                FROM consultas
                WHERE id = $1
                LIMIT 1
            `, [id]);

            if (consultaResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Consulta não encontrada.'
                });
            }

            const statusConsulta = status || 'AGENDADA';

            const result = await pool.query(`
                UPDATE consultas
                SET
                    pet_id = $1,
                    data_consulta = $2,
                    horario = $3,
                    motivo = $4,
                    observacoes = $5,
                    status = $6,
                    updated_at = NOW()
                WHERE id = $7
                RETURNING
                    id,
                    pet_id,
                    usuario_id,
                    data_consulta,
                    horario,
                    motivo,
                    observacoes,
                    status,
                    created_at,
                    updated_at
            `, [
                pet_id,
                data_consulta,
                horario || null,
                motivo || null,
                observacoes || null,
                statusConsulta,
                id
            ]);

            res.json({
                sucesso: true,
                mensagem: 'Consulta atualizada com sucesso.',
                consulta: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao atualizar consulta:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao atualizar consulta.'
            });
        }
    }
);

app.patch('/api/consultas/:id/cancelar',
    autenticarToken,
    verificarPermissao('consultas', 'excluir'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const result = await pool.query(`
                UPDATE consultas
                SET
                    status = 'CANCELADA',
                    updated_at = NOW()
                WHERE id = $1
                  AND status <> 'CANCELADA'
                RETURNING
                    id,
                    pet_id,
                    usuario_id,
                    data_consulta,
                    horario,
                    motivo,
                    observacoes,
                    status,
                    created_at,
                    updated_at
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Consulta não encontrada ou já cancelada.'
                });
            }

            res.json({
                sucesso: true,
                mensagem: 'Consulta cancelada com sucesso.',
                consulta: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao cancelar consulta:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao cancelar consulta.'
            });
        }
    }
);

app.get('/api/consultas/:id',
    autenticarToken,
    verificarPermissao('consultas', 'visualizar'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const result = await pool.query(`
                SELECT
                    c.id,
                    c.pet_id,
                    p.nome AS pet_nome,
                    p.especie,
                    p.raca,

                    cli.id AS cliente_id,
                    cli.nome AS cliente_nome,

                    c.usuario_id,
                    u.nome AS usuario_nome,

                    c.data_consulta,
                    c.horario,
                    c.motivo,
                    c.observacoes,
                    c.status,
                    c.created_at,
                    c.updated_at

                FROM consultas c

                INNER JOIN pets p
                    ON p.id = c.pet_id

                INNER JOIN clientes cli
                    ON cli.id = p.cliente_id

                LEFT JOIN usuarios u
                    ON u.id = c.usuario_id

                WHERE c.id = $1
                LIMIT 1
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Consulta não encontrada.'
                });
            }

            res.json({
                sucesso: true,
                consulta: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao buscar consulta:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao buscar consulta.'
            });
        }
    }
);

app.post('/api/medicamentos',
    autenticarToken,
    verificarPermissao('medicamentos', 'criar'),
    async (req, res) => {
        try {
            const {
                nome,
                principio_ativo,
                fabricante,
                apresentacao,
                dosagem,
                descricao,
                observacoes
            } = req.body;

            if (!nome) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O nome do medicamento é obrigatório.'
                });
            }

            const result = await pool.query(`
                INSERT INTO medicamentos (
                    nome,
                    principio_ativo,
                    fabricante,
                    apresentacao,
                    dosagem,
                    descricao,
                    observacoes
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING
                    id,
                    nome,
                    principio_ativo,
                    fabricante,
                    apresentacao,
                    dosagem,
                    descricao,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
            `, [
                nome,
                principio_ativo || null,
                fabricante || null,
                apresentacao || null,
                dosagem || null,
                descricao || null,
                observacoes || null
            ]);

            res.status(201).json({
                sucesso: true,
                mensagem: 'Medicamento cadastrado com sucesso.',
                medicamento: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao cadastrar medicamento:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao cadastrar medicamento.'
            });
        }
    }
);

app.get('/api/medicamentos',
    autenticarToken,
    verificarPermissao('medicamentos', 'visualizar'),
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    id,
                    nome,
                    principio_ativo,
                    fabricante,
                    apresentacao,
                    dosagem,
                    descricao,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
                FROM medicamentos
                WHERE ativo = TRUE
                ORDER BY nome ASC, id ASC
            `);

            res.json({
                sucesso: true,
                total: result.rows.length,
                medicamentos: result.rows
            });

        } catch (error) {
            console.error(
                'Erro ao listar medicamentos:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao listar medicamentos.'
            });
        }
    }
);

app.patch('/api/medicamentos/:id',
    autenticarToken,
    verificarPermissao('medicamentos', 'editar'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const {
                nome,
                principio_ativo,
                fabricante,
                apresentacao,
                dosagem,
                descricao,
                observacoes
            } = req.body;

            if (!nome) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O nome do medicamento é obrigatório.'
                });
            }

            const medicamentoResult = await pool.query(`
                SELECT id
                FROM medicamentos
                WHERE id = $1
                LIMIT 1
            `, [id]);

            if (medicamentoResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Medicamento não encontrado.'
                });
            }

            const result = await pool.query(`
                UPDATE medicamentos
                SET
                    nome = $1,
                    principio_ativo = $2,
                    fabricante = $3,
                    apresentacao = $4,
                    dosagem = $5,
                    descricao = $6,
                    observacoes = $7,
                    updated_at = NOW()
                WHERE id = $8
                RETURNING
                    id,
                    nome,
                    principio_ativo,
                    fabricante,
                    apresentacao,
                    dosagem,
                    descricao,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
            `, [
                nome,
                principio_ativo || null,
                fabricante || null,
                apresentacao || null,
                dosagem || null,
                descricao || null,
                observacoes || null,
                id
            ]);

            res.json({
                sucesso: true,
                mensagem: 'Medicamento atualizado com sucesso.',
                medicamento: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao atualizar medicamento:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao atualizar medicamento.'
            });
        }
    }
);

app.patch('/api/medicamentos/:id/desativar',
    autenticarToken,
    verificarPermissao('medicamentos', 'excluir'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const result = await pool.query(`
                UPDATE medicamentos
                SET
                    ativo = FALSE,
                    updated_at = NOW()
                WHERE id = $1
                  AND ativo = TRUE
                RETURNING
                    id,
                    nome,
                    principio_ativo,
                    fabricante,
                    apresentacao,
                    dosagem,
                    descricao,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Medicamento não encontrado ou já está desativado.'
                });
            }

            res.json({
                sucesso: true,
                mensagem: 'Medicamento desativado com sucesso.',
                medicamento: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao desativar medicamento:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao desativar medicamento.'
            });
        }
    }
);

app.post('/api/administracoes-medicamentos',
    autenticarToken,
    verificarPermissao('medicamentos', 'criar'),
    async (req, res) => {
        try {
            const {
                pet_id,
                medicamento_id,
                data_administracao,
                dosagem,
                frequencia,
                motivo,
                observacoes
            } = req.body;

            if (!pet_id) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O pet é obrigatório.'
                });
            }

            if (!medicamento_id) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O medicamento é obrigatório.'
                });
            }

            if (!data_administracao) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'A data da administração é obrigatória.'
                });
            }

            // Verifica se o pet existe e está ativo
            const petResult = await pool.query(`
                SELECT id
                FROM pets
                WHERE id = $1
                  AND ativo = TRUE
                LIMIT 1
            `, [pet_id]);

            if (petResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Pet não encontrado ou está inativo.'
                });
            }

            // Verifica se o medicamento existe e está ativo
            const medicamentoResult = await pool.query(`
                SELECT id
                FROM medicamentos
                WHERE id = $1
                  AND ativo = TRUE
                LIMIT 1
            `, [medicamento_id]);

            if (medicamentoResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Medicamento não encontrado ou está inativo.'
                });
            }

            const result = await pool.query(`
                INSERT INTO administracoes_medicamentos (
                    pet_id,
                    medicamento_id,
                    usuario_id,
                    data_administracao,
                    dosagem,
                    frequencia,
                    motivo,
                    observacoes
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING
                    id,
                    pet_id,
                    medicamento_id,
                    usuario_id,
                    data_administracao,
                    dosagem,
                    frequencia,
                    motivo,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
            `, [
                pet_id,
                medicamento_id,
                req.usuario.id,
                data_administracao,
                dosagem || null,
                frequencia || null,
                motivo || null,
                observacoes || null
            ]);

            res.status(201).json({
                sucesso: true,
                mensagem: 'Administração de medicamento registrada com sucesso.',
                administracao: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao registrar administração de medicamento:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao registrar administração de medicamento.'
            });
        }
    }
);

app.get('/api/administracoes-medicamentos',
    autenticarToken,
    verificarPermissao('medicamentos', 'visualizar'),
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    am.id,
                    am.pet_id,
                    p.nome AS pet_nome,
                    c.id AS cliente_id,
                    c.nome AS cliente_nome,

                    am.medicamento_id,
                    m.nome AS medicamento_nome,
                    m.principio_ativo,
                    m.fabricante,

                    am.usuario_id,
                    u.nome AS usuario_nome,

                    am.data_administracao,
                    am.dosagem,
                    am.frequencia,
                    am.motivo,
                    am.observacoes,
                    am.ativo,
                    am.created_at,
                    am.updated_at

                FROM administracoes_medicamentos am

                INNER JOIN pets p
                    ON p.id = am.pet_id

                INNER JOIN clientes c
                    ON c.id = p.cliente_id

                INNER JOIN medicamentos m
                    ON m.id = am.medicamento_id

                LEFT JOIN usuarios u
                    ON u.id = am.usuario_id

                WHERE am.ativo = TRUE

                ORDER BY
                    am.data_administracao DESC,
                    am.id DESC
            `);

            res.json({
                sucesso: true,
                total: result.rows.length,
                administracoes: result.rows
            });

        } catch (error) {
            console.error(
                'Erro ao listar administrações de medicamentos:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao listar administrações de medicamentos.'
            });
        }
    }
);

app.patch('/api/administracoes-medicamentos/:id',
    autenticarToken,
    verificarPermissao('medicamentos', 'editar'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const {
                pet_id,
                medicamento_id,
                data_administracao,
                dosagem,
                frequencia,
                motivo,
                observacoes
            } = req.body;

            if (!pet_id) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O pet é obrigatório.'
                });
            }

            if (!medicamento_id) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O medicamento é obrigatório.'
                });
            }

            if (!data_administracao) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'A data da administração é obrigatória.'
                });
            }

            // Verifica se a administração existe e está ativa
            const administracaoResult = await pool.query(`
                SELECT id
                FROM administracoes_medicamentos
                WHERE id = $1
                  AND ativo = TRUE
                LIMIT 1
            `, [id]);

            if (administracaoResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Administração não encontrada ou está inativa.'
                });
            }

            // Verifica se o pet existe e está ativo
            const petResult = await pool.query(`
                SELECT id
                FROM pets
                WHERE id = $1
                  AND ativo = TRUE
                LIMIT 1
            `, [pet_id]);

            if (petResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Pet não encontrado ou está inativo.'
                });
            }

            // Verifica se o medicamento existe e está ativo
            const medicamentoResult = await pool.query(`
                SELECT id
                FROM medicamentos
                WHERE id = $1
                  AND ativo = TRUE
                LIMIT 1
            `, [medicamento_id]);

            if (medicamentoResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Medicamento não encontrado ou está inativo.'
                });
            }

            const result = await pool.query(`
                UPDATE administracoes_medicamentos
                SET
                    pet_id = $1,
                    medicamento_id = $2,
                    data_administracao = $3,
                    dosagem = $4,
                    frequencia = $5,
                    motivo = $6,
                    observacoes = $7,
                    updated_at = NOW()
                WHERE id = $8
                  AND ativo = TRUE
                RETURNING
                    id,
                    pet_id,
                    medicamento_id,
                    usuario_id,
                    data_administracao,
                    dosagem,
                    frequencia,
                    motivo,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
            `, [
                pet_id,
                medicamento_id,
                data_administracao,
                dosagem || null,
                frequencia || null,
                motivo || null,
                observacoes || null,
                id
            ]);

            res.json({
                sucesso: true,
                mensagem: 'Administração de medicamento atualizada com sucesso.',
                administracao: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao atualizar administração de medicamento:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao atualizar administração de medicamento.'
            });
        }
    }
);

app.patch('/api/administracoes-medicamentos/:id/cancelar',
    autenticarToken,
    verificarPermissao('medicamentos', 'excluir'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const result = await pool.query(`
                UPDATE administracoes_medicamentos
                SET
                    ativo = FALSE,
                    updated_at = NOW()
                WHERE id = $1
                  AND ativo = TRUE
                RETURNING
                    id,
                    pet_id,
                    medicamento_id,
                    usuario_id,
                    data_administracao,
                    dosagem,
                    frequencia,
                    motivo,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Administração não encontrada ou já está cancelada.'
                });
            }

            res.json({
                sucesso: true,
                mensagem: 'Administração de medicamento cancelada com sucesso.',
                administracao: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao cancelar administração de medicamento:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao cancelar administração de medicamento.'
            });
        }
    }
);

app.post('/api/exames',
    autenticarToken,
    verificarPermissao('exames', 'criar'),
    async (req, res) => {
        try {
            const {
                nome,
                categoria,
                descricao,
                observacoes
            } = req.body;

            if (!nome) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O nome do exame é obrigatório.'
                });
            }

            const result = await pool.query(`
                INSERT INTO exames (
                    nome,
                    categoria,
                    descricao,
                    observacoes
                )
                VALUES ($1, $2, $3, $4)
                RETURNING
                    id,
                    nome,
                    categoria,
                    descricao,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
            `, [
                nome,
                categoria || null,
                descricao || null,
                observacoes || null
            ]);

            res.status(201).json({
                sucesso: true,
                mensagem: 'Exame cadastrado com sucesso.',
                exame: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao cadastrar exame:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao cadastrar exame.'
            });
        }
    }
);

app.get('/api/exames',
    autenticarToken,
    verificarPermissao('exames', 'visualizar'),
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    id,
                    nome,
                    categoria,
                    descricao,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
                FROM exames
                WHERE ativo = TRUE
                ORDER BY nome ASC, id ASC
            `);

            res.json({
                sucesso: true,
                total: result.rows.length,
                exames: result.rows
            });

        } catch (error) {
            console.error(
                'Erro ao listar exames:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao listar exames.'
            });
        }
    }
);

app.patch('/api/exames/:id',
    autenticarToken,
    verificarPermissao('exames', 'editar'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const {
                nome,
                categoria,
                descricao,
                observacoes
            } = req.body;

            if (!nome) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O nome do exame é obrigatório.'
                });
            }

            const exameResult = await pool.query(`
                SELECT id
                FROM exames
                WHERE id = $1
                LIMIT 1
            `, [id]);

            if (exameResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Exame não encontrado.'
                });
            }

            const result = await pool.query(`
                UPDATE exames
                SET
                    nome = $1,
                    categoria = $2,
                    descricao = $3,
                    observacoes = $4,
                    updated_at = NOW()
                WHERE id = $5
                RETURNING
                    id,
                    nome,
                    categoria,
                    descricao,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
            `, [
                nome,
                categoria || null,
                descricao || null,
                observacoes || null,
                id
            ]);

            res.json({
                sucesso: true,
                mensagem: 'Exame atualizado com sucesso.',
                exame: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao atualizar exame:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao atualizar exame.'
            });
        }
    }
);

app.patch('/api/exames/:id/desativar',
    autenticarToken,
    verificarPermissao('exames', 'excluir'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const result = await pool.query(`
                UPDATE exames
                SET
                    ativo = FALSE,
                    updated_at = NOW()
                WHERE id = $1
                  AND ativo = TRUE
                RETURNING
                    id,
                    nome,
                    categoria,
                    descricao,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Exame não encontrado ou já está desativado.'
                });
            }

            res.json({
                sucesso: true,
                mensagem: 'Exame desativado com sucesso.',
                exame: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao desativar exame:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao desativar exame.'
            });
        }
    }
);

app.post('/api/exames-realizados',
    autenticarToken,
    verificarPermissao('exames', 'criar'),
    async (req, res) => {
        try {
            const {
                pet_id,
                exame_id,
                data_exame,
                laboratorio,
                resultado,
                observacoes
            } = req.body;

            if (!pet_id) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O pet é obrigatório.'
                });
            }

            if (!exame_id) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O exame é obrigatório.'
                });
            }

            if (!data_exame) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'A data do exame é obrigatória.'
                });
            }

            // Verifica se o pet existe e está ativo
            const petResult = await pool.query(`
                SELECT id
                FROM pets
                WHERE id = $1
                  AND ativo = TRUE
                LIMIT 1
            `, [pet_id]);

            if (petResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Pet não encontrado ou está inativo.'
                });
            }

            // Verifica se o exame existe e está ativo
            const exameResult = await pool.query(`
                SELECT id
                FROM exames
                WHERE id = $1
                  AND ativo = TRUE
                LIMIT 1
            `, [exame_id]);

            if (exameResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Exame não encontrado ou está inativo.'
                });
            }

            const result = await pool.query(`
                INSERT INTO exames_realizados (
                    pet_id,
                    exame_id,
                    usuario_id,
                    data_exame,
                    laboratorio,
                    resultado,
                    observacoes
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING
                    id,
                    pet_id,
                    exame_id,
                    usuario_id,
                    data_exame,
                    laboratorio,
                    resultado,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
            `, [
                pet_id,
                exame_id,
                req.usuario.id,
                data_exame,
                laboratorio || null,
                resultado || null,
                observacoes || null
            ]);

            res.status(201).json({
                sucesso: true,
                mensagem: 'Exame realizado registrado com sucesso.',
                exame_realizado: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao registrar exame realizado:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao registrar exame realizado.'
            });
        }
    }
);

app.get(
    '/api/exames-realizados',
    autenticarToken,
    verificarPermissao('exames', 'visualizar'),
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    er.id,

                    er.pet_id,
                    p.nome AS pet_nome,

                    c.id AS cliente_id,
                    c.nome AS cliente_nome,

                    er.exame_id,
                    e.nome AS exame_nome,
                    e.categoria AS exame_categoria,

                    er.usuario_id,
                    u.nome AS usuario_nome,

                    er.data_exame,
                    er.laboratorio,
                    er.resultado,
                    er.observacoes,
                    er.ativo,
                    er.created_at,
                    er.updated_at

                FROM exames_realizados er

                INNER JOIN pets p
                    ON p.id = er.pet_id

                INNER JOIN clientes c
                    ON c.id = p.cliente_id

                INNER JOIN exames e
                    ON e.id = er.exame_id

                LEFT JOIN usuarios u
                    ON u.id = er.usuario_id

                WHERE er.ativo = TRUE

                ORDER BY
                    er.data_exame DESC,
                    er.id DESC
            `);

            res.json({
                sucesso: true,
                total: result.rows.length,
                exames_realizados: result.rows
            });

        } catch (error) {
            console.error(
                'Erro ao listar exames realizados:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao listar exames realizados.'
            });
        }
    }
);

app.patch(
    '/api/exames-realizados/:id',
    autenticarToken,
    verificarPermissao('exames', 'editar'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const {
                pet_id,
                exame_id,
                data_exame,
                laboratorio,
                resultado,
                observacoes
            } = req.body;

            if (!pet_id) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O pet é obrigatório.'
                });
            }

            if (!exame_id) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O exame é obrigatório.'
                });
            }

            if (!data_exame) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'A data do exame é obrigatória.'
                });
            }

            // Verifica se o exame realizado existe e está ativo
            const exameRealizadoResult = await pool.query(`
                SELECT id
                FROM exames_realizados
                WHERE id = $1
                  AND ativo = TRUE
                LIMIT 1
            `, [id]);

            if (exameRealizadoResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Exame realizado não encontrado ou está inativo.'
                });
            }

            // Verifica se o pet existe e está ativo
            const petResult = await pool.query(`
                SELECT id
                FROM pets
                WHERE id = $1
                  AND ativo = TRUE
                LIMIT 1
            `, [pet_id]);

            if (petResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Pet não encontrado ou está inativo.'
                });
            }

            // Verifica se o tipo de exame existe e está ativo
            const exameResult = await pool.query(`
                SELECT id
                FROM exames
                WHERE id = $1
                  AND ativo = TRUE
                LIMIT 1
            `, [exame_id]);

            if (exameResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Exame não encontrado ou está inativo.'
                });
            }

            const result = await pool.query(`
                UPDATE exames_realizados
                SET
                    pet_id = $1,
                    exame_id = $2,
                    data_exame = $3,
                    laboratorio = $4,
                    resultado = $5,
                    observacoes = $6,
                    updated_at = NOW()
                WHERE id = $7
                  AND ativo = TRUE
                RETURNING
                    id,
                    pet_id,
                    exame_id,
                    usuario_id,
                    data_exame,
                    laboratorio,
                    resultado,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
            `, [
                pet_id,
                exame_id,
                data_exame,
                laboratorio || null,
                resultado || null,
                observacoes || null,
                id
            ]);

            res.json({
                sucesso: true,
                mensagem: 'Exame realizado atualizado com sucesso.',
                exame_realizado: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao atualizar exame realizado:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao atualizar exame realizado.'
            });
        }
    }
);

app.patch(
    '/api/exames-realizados/:id/cancelar',
    autenticarToken,
    verificarPermissao('exames', 'excluir'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const result = await pool.query(`
                UPDATE exames_realizados
                SET
                    ativo = FALSE,
                    updated_at = NOW()
                WHERE id = $1
                  AND ativo = TRUE
                RETURNING
                    id,
                    pet_id,
                    exame_id,
                    usuario_id,
                    data_exame,
                    laboratorio,
                    resultado,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Exame realizado não encontrado ou já está cancelado.'
                });
            }

            res.json({
                sucesso: true,
                mensagem: 'Exame realizado cancelado com sucesso.',
                exame_realizado: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao cancelar exame realizado:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao cancelar exame realizado.'
            });
        }
    }
);

app.post(
    '/api/prontuario',
    autenticarToken,
    verificarPermissao('prontuario', 'criar'),
    async (req, res) => {
        try {
            const {
                pet_id,
                usuario_id,
                data_registro,
                tipo_registro,
                titulo,
                diagnostico,
                sintomas,
                tratamento,
                observacoes
            } = req.body;

            if (!pet_id || !data_registro || !tipo_registro) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'pet_id, data_registro e tipo_registro são obrigatórios.'
                });
            }

            const result = await pool.query(`
                INSERT INTO prontuario (
                    pet_id,
                    usuario_id,
                    data_registro,
                    tipo_registro,
                    titulo,
                    diagnostico,
                    sintomas,
                    tratamento,
                    observacoes
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                RETURNING
                    id,
                    pet_id,
                    usuario_id,
                    data_registro,
                    tipo_registro,
                    titulo,
                    diagnostico,
                    sintomas,
                    tratamento,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
            `, [
                pet_id,
                usuario_id || null,
                data_registro,
                tipo_registro,
                titulo || null,
                diagnostico || null,
                sintomas || null,
                tratamento || null,
                observacoes || null
            ]);

            res.status(201).json({
                sucesso: true,
                mensagem: 'Registro do prontuário criado com sucesso.',
                prontuario: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao criar registro do prontuário:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao criar registro do prontuário.'
            });
        }
    }
);

app.get(
    '/api/prontuario',
    autenticarToken,
    verificarPermissao('prontuario', 'visualizar'),
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    p.id,
                    p.pet_id,
                    pets.nome AS pet_nome,
                    clientes.id AS cliente_id,
                    clientes.nome AS cliente_nome,
                    p.usuario_id,
                    usuarios.nome AS usuario_nome,
                    p.data_registro,
                    p.tipo_registro,
                    p.titulo,
                    p.diagnostico,
                    p.sintomas,
                    p.tratamento,
                    p.observacoes,
                    p.ativo,
                    p.created_at,
                    p.updated_at
                FROM prontuario p
                INNER JOIN pets
                    ON pets.id = p.pet_id
                INNER JOIN clientes
                    ON clientes.id = pets.cliente_id
                LEFT JOIN usuarios
                    ON usuarios.id = p.usuario_id
                WHERE p.ativo = TRUE
                ORDER BY
                    p.data_registro DESC,
                    p.id DESC
            `);

            res.json({
                sucesso: true,
                prontuarios: result.rows
            });

        } catch (error) {
            console.error(
                'Erro ao listar prontuários:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao listar prontuários.'
            });
        }
    }
);

app.patch(
    '/api/prontuario/:id',
    autenticarToken,
    verificarPermissao('prontuario', 'editar'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const {
                data_registro,
                tipo_registro,
                titulo,
                diagnostico,
                sintomas,
                tratamento,
                observacoes
            } = req.body;

            const result = await pool.query(`
                UPDATE prontuario
                SET
                    data_registro = COALESCE($1, data_registro),
                    tipo_registro = COALESCE($2, tipo_registro),
                    titulo = COALESCE($3, titulo),
                    diagnostico = COALESCE($4, diagnostico),
                    sintomas = COALESCE($5, sintomas),
                    tratamento = COALESCE($6, tratamento),
                    observacoes = COALESCE($7, observacoes),
                    updated_at = NOW()
                WHERE id = $8
                  AND ativo = TRUE
                RETURNING
                    id,
                    pet_id,
                    usuario_id,
                    data_registro,
                    tipo_registro,
                    titulo,
                    diagnostico,
                    sintomas,
                    tratamento,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
            `, [
                data_registro || null,
                tipo_registro || null,
                titulo || null,
                diagnostico || null,
                sintomas || null,
                tratamento || null,
                observacoes || null,
                id
            ]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Registro do prontuário não encontrado ou está inativo.'
                });
            }

            res.json({
                sucesso: true,
                mensagem: 'Registro do prontuário atualizado com sucesso.',
                prontuario: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao atualizar prontuário:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao atualizar prontuário.'
            });
        }
    }
);

app.patch(
    '/api/prontuario/:id/cancelar',
    autenticarToken,
    verificarPermissao('prontuario', 'excluir'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const result = await pool.query(`
                UPDATE prontuario
                SET
                    ativo = FALSE,
                    updated_at = NOW()
                WHERE id = $1
                  AND ativo = TRUE
                RETURNING
                    id,
                    pet_id,
                    usuario_id,
                    data_registro,
                    tipo_registro,
                    titulo,
                    diagnostico,
                    sintomas,
                    tratamento,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Registro do prontuário não encontrado ou já está cancelado.'
                });
            }

            res.json({
                sucesso: true,
                mensagem: 'Registro do prontuário cancelado com sucesso.',
                prontuario: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao cancelar prontuário:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao cancelar prontuário.'
            });
        }
    }
);

app.patch(
    '/api/aplicacoes-vacinas/:id',
    autenticarToken,
    verificarPermissao('vacinas', 'editar'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const {
                pet_id,
                vacina_id,
                data_aplicacao,
                proxima_dose,
                lote,
                fabricante,
                observacoes
            } = req.body;

            if (!pet_id || !vacina_id || !data_aplicacao) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Pet, vacina e data da aplicação são obrigatórios.'
                });
            }

            const petResult = await pool.query(`
                SELECT id, ativo
                FROM pets
                WHERE id = $1
                LIMIT 1
            `, [pet_id]);

            if (petResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Pet não encontrado.'
                });
            }

            if (!petResult.rows[0].ativo) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O pet está inativo.'
                });
            }

            const vacinaResult = await pool.query(`
                SELECT id, ativo
                FROM vacinas
                WHERE id = $1
                LIMIT 1
            `, [vacina_id]);

            if (vacinaResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Vacina não encontrada.'
                });
            }

            if (!vacinaResult.rows[0].ativo) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'A vacina está inativa.'
                });
            }

            const result = await pool.query(`
                UPDATE aplicacoes_vacinas
                SET
                    pet_id = $1,
                    vacina_id = $2,
                    data_aplicacao = $3,
                    proxima_dose = $4,
                    lote = $5,
                    fabricante = $6,
                    observacoes = $7,
                    updated_at = NOW()
                WHERE id = $8
                RETURNING
                    id,
                    pet_id,
                    vacina_id,
                    usuario_id,
                    data_aplicacao,
                    proxima_dose,
                    lote,
                    fabricante,
                    observacoes,
                    created_at,
                    updated_at
            `, [
                pet_id,
                vacina_id,
                data_aplicacao,
                proxima_dose || null,
                lote || null,
                fabricante || null,
                observacoes || null,
                id
            ]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Aplicação de vacina não encontrada.'
                });
            }

            res.json({
                sucesso: true,
                mensagem: 'Aplicação de vacina atualizada com sucesso.',
                aplicacao: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao atualizar aplicação de vacina:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao atualizar aplicação de vacina.'
            });
        }
    }
);

app.patch(
    '/api/aplicacoes-vacinas/:id/cancelar',
    autenticarToken,
    verificarPermissao('vacinas', 'excluir'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const result = await pool.query(`
                UPDATE aplicacoes_vacinas
                SET
                    ativo = FALSE,
                    updated_at = NOW()
                WHERE id = $1
                  AND ativo = TRUE
                RETURNING
                    id,
                    pet_id,
                    vacina_id,
                    usuario_id,
                    data_aplicacao,
                    proxima_dose,
                    lote,
                    fabricante,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Aplicação de vacina não encontrada ou já cancelada.'
                });
            }

            res.json({
                sucesso: true,
                mensagem: 'Aplicação de vacina cancelada com sucesso.',
                aplicacao: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao cancelar aplicação de vacina:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao cancelar aplicação de vacina.'
            });
        }
    }
);

app.post(
    '/api/produtos',
    autenticarToken,
    verificarPerfil('ADMIN', 'GERENTE'),
    verificarPermissao('produtos', 'criar'),
    async (req, res) => {
        try {
            const {
                nome,
                codigo_barras,
                categoria,
                marca,
                preco_custo,
                preco_venda,
                estoque_atual,
                estoque_minimo,
                unidade,
                observacoes
            } = req.body;

            if (!nome) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Nome do produto é obrigatório.'
                });
            }

            const result = await pool.query(`
                INSERT INTO produtos (
                    nome,
                    codigo_barras,
                    categoria,
                    marca,
                    preco_custo,
                    preco_venda,
                    estoque_atual,
                    estoque_minimo,
                    unidade,
                    observacoes
                )
                VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9, $10
                )
                RETURNING
                    id,
                    nome,
                    codigo_barras,
                    categoria,
                    marca,
                    preco_custo,
                    preco_venda,
                    estoque_atual,
                    estoque_minimo,
                    unidade,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
            `, [
                nome,
                codigo_barras || null,
                categoria || null,
                marca || null,
                preco_custo || 0,
                preco_venda || 0,
                estoque_atual || 0,
                estoque_minimo || 0,
                unidade || 'UN',
                observacoes || null
            ]);

            res.status(201).json({
                sucesso: true,
                mensagem: 'Produto cadastrado com sucesso.',
                produto: result.rows[0]
            });

        } catch (error) {
            console.error('Erro ao cadastrar produto:', error);

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao cadastrar produto.'
            });
        }
    }
);

app.get(
    '/api/produtos',
    autenticarToken,
    verificarPerfil('ADMIN', 'GERENTE'),
    verificarPermissao('produtos', 'visualizar'),
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    id,
                    nome,
                    codigo_barras,
                    categoria,
                    marca,
                    preco_custo,
                    preco_venda,
                    estoque_atual,
                    estoque_minimo,
                    unidade,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
                FROM produtos
                WHERE ativo = TRUE
                ORDER BY nome ASC
            `);

            res.json({
                sucesso: true,
                produtos: result.rows
            });

        } catch (error) {
            console.error('Erro ao buscar produtos:', error);

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao buscar produtos.'
            });
        }
    }
);

app.put(
    '/api/produtos/:id',
    autenticarToken,
    verificarPerfil('ADMIN', 'GERENTE'),
    verificarPermissao('produtos', 'editar'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const {
                nome,
                codigo_barras,
                categoria,
                marca,
                preco_custo,
                preco_venda,
                estoque_atual,
                estoque_minimo,
                unidade,
                observacoes
            } = req.body;

            if (!nome) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Nome do produto é obrigatório.'
                });
            }

            const produtoExistente = await pool.query(`
                SELECT id
                FROM produtos
                WHERE id = $1
                LIMIT 1
            `, [id]);

            if (produtoExistente.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Produto não encontrado.'
                });
            }

            const result = await pool.query(`
                UPDATE produtos
                SET
                    nome = $1,
                    codigo_barras = $2,
                    categoria = $3,
                    marca = $4,
                    preco_custo = $5,
                    preco_venda = $6,
                    estoque_atual = $7,
                    estoque_minimo = $8,
                    unidade = $9,
                    observacoes = $10,
                    updated_at = NOW()
                WHERE id = $11
                RETURNING
                    id,
                    nome,
                    codigo_barras,
                    categoria,
                    marca,
                    preco_custo,
                    preco_venda,
                    estoque_atual,
                    estoque_minimo,
                    unidade,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
            `, [
                nome,
                codigo_barras || null,
                categoria || null,
                marca || null,
                preco_custo || 0,
                preco_venda || 0,
                estoque_atual || 0,
                estoque_minimo || 0,
                unidade || 'UN',
                observacoes || null,
                id
            ]);

            res.json({
                sucesso: true,
                mensagem: 'Produto atualizado com sucesso.',
                produto: result.rows[0]
            });

        } catch (error) {
            console.error('Erro ao atualizar produto:', error);

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao atualizar produto.'
            });
        }
    }
);

app.delete(
    '/api/produtos/:id',
    autenticarToken,
    verificarPerfil('ADMIN', 'GERENTE'),
    verificarPermissao('produtos', 'excluir'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const result = await pool.query(`
                UPDATE produtos
                SET
                    ativo = FALSE,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING
                    id,
                    nome,
                    codigo_barras,
                    categoria,
                    marca,
                    preco_custo,
                    preco_venda,
                    estoque_atual,
                    estoque_minimo,
                    unidade,
                    observacoes,
                    ativo,
                    created_at,
                    updated_at
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Produto não encontrado.'
                });
            }

            res.json({
                sucesso: true,
                mensagem: 'Produto desativado com sucesso.',
                produto: result.rows[0]
            });

        } catch (error) {
            console.error('Erro ao desativar produto:', error);

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao desativar produto.'
            });
        }
    }
);

app.post(
    '/api/estoque/entrada',
    autenticarToken,
    verificarPerfil('ADMIN', 'GERENTE'),
    verificarPermissao('estoque', 'criar'),
    async (req, res) => {
        const client = await pool.connect();

        try {
            const {
                produto_id,
                quantidade,
                motivo
            } = req.body;

            if (!produto_id || !quantidade || quantidade <= 0) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Produto e quantidade válida são obrigatórios.'
                });
            }

            await client.query('BEGIN');

            const produtoResult = await client.query(`
                SELECT
                    id,
                    nome,
                    estoque_atual,
                    ativo
                FROM produtos
                WHERE id = $1
                FOR UPDATE
            `, [produto_id]);

            if (produtoResult.rows.length === 0) {
                await client.query('ROLLBACK');

                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Produto não encontrado.'
                });
            }

            const produto = produtoResult.rows[0];

            if (!produto.ativo) {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Não é possível movimentar um produto inativo.'
                });
            }

            const estoqueAnterior = Number(produto.estoque_atual);
            const estoquePosterior = estoqueAnterior + Number(quantidade);

            await client.query(`
                UPDATE produtos
                SET
                    estoque_atual = $1,
                    updated_at = NOW()
                WHERE id = $2
            `, [
                estoquePosterior,
                produto_id
            ]);

            const movimentacaoResult = await client.query(`
                INSERT INTO movimentacoes_estoque (
                    produto_id,
                    usuario_id,
                    tipo,
                    quantidade,
                    estoque_anterior,
                    estoque_posterior,
                    motivo
                )
                VALUES (
                    $1, $2, 'ENTRADA', $3, $4, $5, $6
                )
                RETURNING
                    id,
                    produto_id,
                    usuario_id,
                    tipo,
                    quantidade,
                    estoque_anterior,
                    estoque_posterior,
                    motivo,
                    created_at
            `, [
                produto_id,
                req.usuario.id,
                quantidade,
                estoqueAnterior,
                estoquePosterior,
                motivo || null
            ]);

            await client.query('COMMIT');

            res.status(201).json({
                sucesso: true,
                mensagem: 'Entrada de estoque registrada com sucesso.',
                movimentacao: movimentacaoResult.rows[0]
            });

        } catch (error) {
            await client.query('ROLLBACK');

            console.error('Erro ao registrar entrada de estoque:', error);

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao registrar entrada de estoque.'
            });

        } finally {
            client.release();
        }
    }
);

app.post(
    '/api/estoque/saida',
    autenticarToken,
    verificarPerfil('ADMIN', 'GERENTE'),
    verificarPermissao('estoque', 'criar'),
    async (req, res) => {
        const client = await pool.connect();

        try {
            const {
                produto_id,
                quantidade,
                motivo
            } = req.body;

            if (!produto_id || !quantidade || quantidade <= 0) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Produto e quantidade válida são obrigatórios.'
                });
            }

            await client.query('BEGIN');

            const produtoResult = await client.query(`
                SELECT
                    id,
                    nome,
                    estoque_atual,
                    ativo
                FROM produtos
                WHERE id = $1
                FOR UPDATE
            `, [produto_id]);

            if (produtoResult.rows.length === 0) {
                await client.query('ROLLBACK');

                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Produto não encontrado.'
                });
            }

            const produto = produtoResult.rows[0];

            if (!produto.ativo) {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Não é possível movimentar um produto inativo.'
                });
            }

            const estoqueAnterior = Number(produto.estoque_atual);
            const quantidadeSaida = Number(quantidade);

            if (quantidadeSaida > estoqueAnterior) {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Estoque insuficiente para realizar esta saída.'
                });
            }

            const estoquePosterior =
                estoqueAnterior - quantidadeSaida;

            await client.query(`
                UPDATE produtos
                SET
                    estoque_atual = $1,
                    updated_at = NOW()
                WHERE id = $2
            `, [
                estoquePosterior,
                produto_id
            ]);

            const movimentacaoResult = await client.query(`
                INSERT INTO movimentacoes_estoque (
                    produto_id,
                    usuario_id,
                    tipo,
                    quantidade,
                    estoque_anterior,
                    estoque_posterior,
                    motivo
                )
                VALUES (
                    $1, $2, 'SAIDA', $3, $4, $5, $6
                )
                RETURNING
                    id,
                    produto_id,
                    usuario_id,
                    tipo,
                    quantidade,
                    estoque_anterior,
                    estoque_posterior,
                    motivo,
                    created_at
            `, [
                produto_id,
                req.usuario.id,
                quantidadeSaida,
                estoqueAnterior,
                estoquePosterior,
                motivo || null
            ]);

            await client.query('COMMIT');

            res.status(201).json({
                sucesso: true,
                mensagem: 'Saída de estoque registrada com sucesso.',
                movimentacao: movimentacaoResult.rows[0]
            });

        } catch (error) {
            await client.query('ROLLBACK');

            console.error('Erro ao registrar saída de estoque:', error);

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao registrar saída de estoque.'
            });

        } finally {
            client.release();
        }
    }
);

app.post(
    '/api/estoque/ajuste',
    autenticarToken,
    verificarPerfil('ADMIN', 'GERENTE'),
    verificarPermissao('estoque', 'criar'),
    async (req, res) => {
        const client = await pool.connect();

        try {
            const {
                produto_id,
                estoque_novo,
                motivo
            } = req.body;

            if (
                !produto_id ||
                estoque_novo === undefined ||
                estoque_novo === null ||
                Number(estoque_novo) < 0
            ) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Produto e estoque novo válido são obrigatórios.'
                });
            }

            await client.query('BEGIN');

            const produtoResult = await client.query(`
                SELECT
                    id,
                    nome,
                    estoque_atual,
                    ativo
                FROM produtos
                WHERE id = $1
                FOR UPDATE
            `, [produto_id]);

            if (produtoResult.rows.length === 0) {
                await client.query('ROLLBACK');

                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Produto não encontrado.'
                });
            }

            const produto = produtoResult.rows[0];

            if (!produto.ativo) {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Não é possível ajustar um produto inativo.'
                });
            }

            const estoqueAnterior = Number(produto.estoque_atual);
            const estoquePosterior = Number(estoque_novo);

            await client.query(`
                UPDATE produtos
                SET
                    estoque_atual = $1,
                    updated_at = NOW()
                WHERE id = $2
            `, [
                estoquePosterior,
                produto_id
            ]);

            const movimentacaoResult = await client.query(`
                INSERT INTO movimentacoes_estoque (
                    produto_id,
                    usuario_id,
                    tipo,
                    quantidade,
                    estoque_anterior,
                    estoque_posterior,
                    motivo
                )
                VALUES (
                    $1,
                    $2,
                    'AJUSTE',
                    $3,
                    $4,
                    $5,
                    $6
                )
                RETURNING
                    id,
                    produto_id,
                    usuario_id,
                    tipo,
                    quantidade,
                    estoque_anterior,
                    estoque_posterior,
                    motivo,
                    created_at
            `, [
                produto_id,
                req.usuario.id,
                Math.abs(estoquePosterior - estoqueAnterior),
                estoqueAnterior,
                estoquePosterior,
                motivo || null
            ]);

            await client.query('COMMIT');

            res.status(201).json({
                sucesso: true,
                mensagem: 'Ajuste de estoque realizado com sucesso.',
                movimentacao: movimentacaoResult.rows[0]
            });

        } catch (error) {
            await client.query('ROLLBACK');

            console.error('Erro ao ajustar estoque:', error);

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao ajustar estoque.'
            });

        } finally {
            client.release();
        }
    }
);

app.get(
    '/api/estoque/movimentacoes',
    autenticarToken,
    verificarPermissao('estoque', 'visualizar'),
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    m.id,
                    m.produto_id,
                    p.nome AS produto,
                    m.usuario_id,
                    u.nome AS usuario,
                    m.tipo,
                    m.quantidade,
                    m.estoque_anterior,
                    m.estoque_posterior,
                    m.motivo,
                    m.created_at
                FROM movimentacoes_estoque m
                INNER JOIN produtos p
                    ON p.id = m.produto_id
                LEFT JOIN usuarios u
                    ON u.id = m.usuario_id
                ORDER BY m.created_at DESC
            `);

            res.json({
                sucesso: true,
                movimentacoes: result.rows
            });

        } catch (error) {
            console.error(
                'Erro ao buscar movimentações de estoque:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao buscar movimentações de estoque.'
            });
        }
    }
);

app.post(
    '/api/vendas',
    autenticarToken,
    verificarPermissao('vendas', 'criar'),
    async (req, res) => {
        try {
            const {
                cliente_id,
                observacoes
            } = req.body;

            if (cliente_id) {
                const clienteResult = await pool.query(`
                    SELECT id
                    FROM clientes
                    WHERE id = $1
                      AND ativo = TRUE
                    LIMIT 1
                `, [cliente_id]);

                if (clienteResult.rows.length === 0) {
                    return res.status(404).json({
                        sucesso: false,
                        mensagem: 'Cliente não encontrado ou está inativo.'
                    });
                }
            }

            const result = await pool.query(`
                INSERT INTO vendas (
                    cliente_id,
                    usuario_id,
                    subtotal,
                    desconto,
                    total,
                    status,
                    observacoes
                )
                VALUES (
                    $1,
                    $2,
                    0,
                    0,
                    0,
                    'ABERTA',
                    $3
                )
                RETURNING
                    id,
                    cliente_id,
                    usuario_id,
                    data_venda,
                    subtotal,
                    desconto,
                    total,
                    status,
                    observacoes,
                    created_at,
                    updated_at
            `, [
                cliente_id || null,
                req.usuario.id,
                observacoes || null
            ]);

            res.status(201).json({
                sucesso: true,
                mensagem: 'Venda criada com sucesso.',
                venda: result.rows[0]
            });

        } catch (error) {
            console.error('Erro ao criar venda:', error);

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao criar venda.'
            });
        }
    }
);


app.post(
    '/api/vendas/:vendaId/itens',
    autenticarToken,
    verificarPermissao('vendas', 'criar'),
    async (req, res) => {
        const client = await pool.connect();

        try {
            const { vendaId } = req.params;
            const {
                produto_id,
                quantidade,
                desconto
            } = req.body;

            if (!produto_id || !quantidade || Number(quantidade) <= 0) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Produto e quantidade válida são obrigatórios.'
                });
            }

            const descontoValor = Number(desconto || 0);

            if (!Number.isFinite(descontoValor) || descontoValor < 0) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O desconto não pode ser negativo.'
                });
            }

            await client.query('BEGIN');

            const vendaResult = await client.query(`
            SELECT
                id,
                subtotal,
                desconto,
                total,
                status
            FROM vendas
            WHERE id = $1
            FOR UPDATE
`, [vendaId]);
            if (vendaResult.rows.length === 0) {
                await client.query('ROLLBACK');

                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Venda não encontrada.'
                });
            }

            const venda = vendaResult.rows[0];

            if (venda.status !== 'ABERTA') {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Só é possível adicionar produtos em uma venda aberta.'
                });
            }

            // Verifica se a venda já possui pagamentos
            const pagamentoResult = await client.query(`
                SELECT
                    COALESCE(SUM(valor), 0) AS total_pago
                FROM pagamentos
                WHERE venda_id = $1
                  AND status IN ('PAGO', 'PENDENTE')
            `, [vendaId]);

            const totalPago = Number(
                pagamentoResult.rows[0].total_pago
            );

            if (totalPago > 0) {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Não é possível adicionar produtos a uma venda que já possui pagamento registrado.',
                    total_pago: totalPago
                });
            }

            const produtoResult = await client.query(`
                SELECT
                    id,
                    nome,
                    preco_venda,
                    estoque_atual,
                    ativo
                FROM produtos
                WHERE id = $1
                FOR UPDATE
            `, [produto_id]);

            if (produtoResult.rows.length === 0) {
                await client.query('ROLLBACK');

                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Produto não encontrado.'
                });
            }

            const produto = produtoResult.rows[0];

            if (!produto.ativo) {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O produto está inativo.'
                });
            }

            const quantidadeItem = Number(quantidade);
            const estoqueAtual = Number(produto.estoque_atual);
            const precoUnitario = Number(produto.preco_venda);

            if (quantidadeItem > estoqueAtual) {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Estoque insuficiente.'
                });
            }

            const valorBruto = quantidadeItem * precoUnitario;

            if (descontoValor > valorBruto) {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O desconto não pode ser maior que o valor do item.'
                });
            }

            const subtotal = valorBruto - descontoValor;

            const itemResult = await client.query(`
                INSERT INTO itens_venda (
                    venda_id,
                    produto_id,
                    quantidade,
                    preco_unitario,
                    desconto,
                    subtotal
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6
                )
                RETURNING
                    id,
                    venda_id,
                    produto_id,
                    quantidade,
                    preco_unitario,
                    desconto,
                    subtotal,
                    created_at
            `, [
                vendaId,
                produto_id,
                quantidadeItem,
                precoUnitario,
                descontoValor,
                subtotal
            ]);

            const totalVendaResult = await client.query(`
                SELECT
                    COALESCE(SUM(subtotal), 0) AS subtotal
                FROM itens_venda
                WHERE venda_id = $1
            `, [vendaId]);

            const novoSubtotal = Number(
                totalVendaResult.rows[0].subtotal
            );

            const descontoVenda = Number(venda.desconto || 0);

            const novoTotal = Math.max(
                novoSubtotal - descontoVenda,
                0
            );

            await client.query(`
                UPDATE vendas
                SET
                    subtotal = $1,
                    total = $2,
                    updated_at = NOW()
                WHERE id = $3
            `, [
                novoSubtotal,
                novoTotal,
                vendaId
            ]);

            await client.query('COMMIT');

            res.status(201).json({
                sucesso: true,
                mensagem: 'Produto adicionado à venda com sucesso.',
                item: itemResult.rows[0],
                venda: {
                    subtotal: novoSubtotal,
                    desconto: descontoVenda,
                    total: novoTotal
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');

            console.error(
                'Erro ao adicionar produto à venda:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao adicionar produto à venda.'
            });

        } finally {
            client.release();
        }
    }
);


app.get(
    '/api/vendas/:vendaId',
    autenticarToken,
    verificarPermissao('vendas', 'visualizar'),
    async (req, res) => {
        try {
            const { vendaId } = req.params;

            const vendaResult = await pool.query(`
                SELECT
                    v.id,
                    v.cliente_id,
                    c.nome AS cliente,
                    v.usuario_id,
                    u.nome AS usuario,
                    v.data_venda,
                    v.subtotal,
                    v.desconto,
                    v.total,
                    v.status,
                    v.observacoes,
                    v.created_at,
                    v.updated_at
                FROM vendas v
                LEFT JOIN clientes c
                    ON c.id = v.cliente_id
                INNER JOIN usuarios u
                    ON u.id = v.usuario_id
                WHERE v.id = $1
                LIMIT 1
            `, [vendaId]);

            if (vendaResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Venda não encontrada.'
                });
            }

            const venda = vendaResult.rows[0];

            const itensResult = await pool.query(`
                SELECT
                    i.id,
                    i.produto_id,
                    p.nome AS produto,
                    i.quantidade,
                    i.preco_unitario,
                    i.desconto,
                    i.subtotal
                FROM itens_venda i
                INNER JOIN produtos p
                    ON p.id = i.produto_id
                WHERE i.venda_id = $1
                ORDER BY i.id ASC
            `, [vendaId]);

            const pagamentosResult = await pool.query(`
                SELECT
                    id,
                    forma_pagamento,
                    valor,
                    parcelas,
                    status,
                    observacoes,
                    created_at
                FROM pagamentos
                WHERE venda_id = $1
                ORDER BY id ASC
            `, [vendaId]);

            res.json({
                sucesso: true,
                venda: {
                    ...venda,
                    itens: itensResult.rows,
                    pagamentos: pagamentosResult.rows
                }
            });

        } catch (error) {
            console.error(
                'Erro ao buscar venda:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao buscar venda.'
            });
        }
    }
);

app.post('/api/vendas/:vendaId/pagamentos',
    autenticarToken,
    verificarPermissao('pagamentos', 'criar'),
    async (req, res) => {
        try {
            const { vendaId } = req.params;

            const {
                forma_pagamento,
                valor,
                parcelas,
                observacoes
            } = req.body;

            const formasPermitidas = [
                'DINHEIRO',
                'PIX',
                'DEBITO',
                'CREDITO',
                'TRANSFERENCIA',
                'OUTRO'
            ];

            if (!forma_pagamento) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Forma de pagamento é obrigatória.'
                });
            }

            if (!formasPermitidas.includes(forma_pagamento)) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Forma de pagamento inválida.'
                });
            }

            const valorPagamento = Number(valor);

            if (!Number.isFinite(valorPagamento) || valorPagamento <= 0) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Valor do pagamento deve ser maior que zero.'
                });
            }

            const vendaResult = await pool.query(`
                SELECT
                    id,
                    total,
                    status
                FROM vendas
                WHERE id = $1
                LIMIT 1
            `, [vendaId]);

            if (vendaResult.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Venda não encontrada.'
                });
            }

            const venda = vendaResult.rows[0];

            if (venda.status !== 'ABERTA') {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Só é possível adicionar pagamento em uma venda aberta.'
                });
            }

            const totalVenda = Number(venda.total);

            // Busca quanto já foi pago
            const pagamentosResult = await pool.query(`
                SELECT
                    COALESCE(SUM(valor), 0) AS total_pago
                FROM pagamentos
                WHERE venda_id = $1
                  AND status IN ('PAGO', 'PENDENTE')
            `, [vendaId]);

            const totalPago = Number(
                pagamentosResult.rows[0].total_pago
            );

            const restante = Math.max(
                totalVenda - totalPago,
                0
            );

            // Se já estiver totalmente paga, não aceita outro pagamento
            if (restante === 0) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'A venda já está totalmente paga.',
                    total_venda: totalVenda,
                    total_pago: totalPago,
                    restante: 0
                });
            }

            // Para formas que não são dinheiro,
            // não permitimos pagamento acima do restante.
            if (
                forma_pagamento !== 'DINHEIRO' &&
                valorPagamento > restante
            ) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O valor do pagamento não pode ser maior que o valor restante para esta forma de pagamento.',
                    total_venda: totalVenda,
                    total_pago: totalPago,
                    restante: restante
                });
            }

            const novoTotalPago =
                totalPago + valorPagamento;

            // Troco somente quando for dinheiro
            const troco =
    forma_pagamento === 'DINHEIRO'
        ? Number(
            Math.max(novoTotalPago - totalVenda, 0)
                .toFixed(2)
        )
        : 0;

            const pagamentoResult = await pool.query(`
                INSERT INTO pagamentos (
                    venda_id,
                    forma_pagamento,
                    valor,
                    parcelas,
                    status,
                    observacoes
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    'PAGO',
                    $5
                )
                RETURNING
                    id,
                    venda_id,
                    forma_pagamento,
                    valor,
                    parcelas,
                    status,
                    observacoes,
                    created_at
            `, [
                vendaId,
                forma_pagamento,
                valorPagamento,
                Number(parcelas || 1),
                observacoes || null
            ]);

            const novoRestante = Number(
    Math.max(totalVenda - novoTotalPago, 0)
        .toFixed(2)
);

            res.status(201).json({
                sucesso: true,
                mensagem: 'Pagamento registrado com sucesso.',
                pagamento: pagamentoResult.rows[0],
                resumo_pagamento: {
                    total_venda: totalVenda,
                    total_pago: novoTotalPago,
                    restante: novoRestante,
                    troco: troco
                }
            });

        } catch (error) {
            console.error(
                'Erro ao registrar pagamento:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao registrar pagamento.'
            });
        }
    }
);



app.patch(
    '/api/vendas/:vendaId/cancelar',
    autenticarToken,
    verificarPermissao('vendas', 'excluir'),
    async (req, res) => {
        const client = await pool.connect();

        try {
            const { vendaId } = req.params;

            await client.query('BEGIN');

            // 1. Buscar e bloquear a venda
            const vendaResult = await client.query(`
                SELECT
                    id,
                    status
                FROM vendas
                WHERE id = $1
                FOR UPDATE
            `, [vendaId]);

            if (vendaResult.rows.length === 0) {
                await client.query('ROLLBACK');

                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Venda não encontrada.'
                });
            }

            const venda = vendaResult.rows[0];

            if (venda.status === 'CANCELADA') {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'A venda já está cancelada.'
                });
            }

            if (venda.status !== 'FINALIZADA') {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Somente vendas finalizadas podem ser canceladas.'
                });
            }

            // 2. Buscar os itens e bloquear os produtos
            const itensResult = await client.query(`
                SELECT
                    i.produto_id,
                    i.quantidade,
                    p.nome AS produto,
                    p.estoque_atual,
                    p.ativo
                FROM itens_venda i
                INNER JOIN produtos p
                    ON p.id = i.produto_id
                WHERE i.venda_id = $1
                FOR UPDATE OF p
            `, [vendaId]);

            // 3. Devolver os produtos ao estoque
            for (const item of itensResult.rows) {

                const estoqueAnterior = Number(
                    item.estoque_atual
                );

                const quantidade = Number(
                    item.quantidade
                );

                const estoquePosterior =
                    estoqueAnterior + quantidade;

                await client.query(`
                    UPDATE produtos
                    SET
                        estoque_atual = $1,
                        updated_at = NOW()
                    WHERE id = $2
                `, [
                    estoquePosterior,
                    item.produto_id
                ]);

                await client.query(`
                    INSERT INTO movimentacoes_estoque (
                        produto_id,
                        usuario_id,
                        tipo,
                        quantidade,
                        estoque_anterior,
                        estoque_posterior,
                        motivo
                    )
                    VALUES (
                        $1,
                        $2,
                        'ENTRADA',
                        $3,
                        $4,
                        $5,
                        $6
                    )
                `, [
                    item.produto_id,
                    req.usuario.id,
                    quantidade,
                    estoqueAnterior,
                    estoquePosterior,
                    `Cancelamento da venda #${vendaId}`
                ]);
            }

            // 4. Cancelar a venda
            const vendaCancelada = await client.query(`
                UPDATE vendas
                SET
                    status = 'CANCELADA',
                    updated_at = NOW()
                WHERE id = $1
                RETURNING
                    id,
                    cliente_id,
                    usuario_id,
                    data_venda,
                    subtotal,
                    desconto,
                    total,
                    status,
                    observacoes,
                    created_at,
                    updated_at
            `, [vendaId]);

            // 5. Cancelar os pagamentos
            await client.query(`
                UPDATE pagamentos
                SET
                    status = 'CANCELADO'
                WHERE venda_id = $1
                  AND status = 'PAGO'
            `, [vendaId]);

            await client.query('COMMIT');

            res.json({
                sucesso: true,
                mensagem: 'Venda cancelada com sucesso e estoque devolvido.',
                venda: vendaCancelada.rows[0]
            });

        } catch (error) {

            await client.query('ROLLBACK');

            console.error(
                'Erro ao cancelar venda:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao cancelar venda.'
            });

        } finally {
            client.release();
        }
    }
);

app.get(
    '/api/vendas',
    autenticarToken,
    verificarPermissao('vendas', 'visualizar'),
    async (req, res) => {
        try {
            const {
                status,
                cliente_id,
                data_inicial,
                data_final
            } = req.query;

            const parametros = [];
            const condicoes = [];

            let numeroParametro = 1;

            if (status) {
                const statusPermitidos = [
                    'ABERTA',
                    'FINALIZADA',
                    'CANCELADA'
                ];

                if (!statusPermitidos.includes(status)) {
                    return res.status(400).json({
                        sucesso: false,
                        mensagem: 'Status de venda inválido.'
                    });
                }

                condicoes.push(
                    `v.status = $${numeroParametro}`
                );

                parametros.push(status);
                numeroParametro++;
            }

            if (cliente_id) {
                condicoes.push(
                    `v.cliente_id = $${numeroParametro}`
                );

                parametros.push(cliente_id);
                numeroParametro++;
            }

            if (data_inicial) {
                condicoes.push(
                    `v.data_venda >= $${numeroParametro}::date`
                );

                parametros.push(data_inicial);
                numeroParametro++;
            }

            if (data_final) {
                condicoes.push(
                    `v.data_venda < ($${numeroParametro}::date + INTERVAL '1 day')`
                );

                parametros.push(data_final);
                numeroParametro++;
            }

            let query = `
                SELECT
                    v.id,
                    v.cliente_id,
                    c.nome AS cliente,
                    v.usuario_id,
                    u.nome AS usuario,
                    v.data_venda,
                    v.subtotal,
                    v.desconto,
                    v.total,
                    v.status,
                    v.observacoes,
                    v.created_at,
                    v.updated_at
                FROM vendas v
                LEFT JOIN clientes c
                    ON c.id = v.cliente_id
                INNER JOIN usuarios u
                    ON u.id = v.usuario_id
            `;

            if (condicoes.length > 0) {
                query += `
                    WHERE ${condicoes.join(' AND ')}
                `;
            }

            query += `
                ORDER BY v.id DESC
            `;

            const result = await pool.query(
                query,
                parametros
            );

            res.json({
                sucesso: true,
                filtros: {
                    status: status || null,
                    cliente_id: cliente_id || null,
                    data_inicial: data_inicial || null,
                    data_final: data_final || null
                },
                total_registros: result.rows.length,
                vendas: result.rows
            });

        } catch (error) {

            console.error(
                'Erro ao buscar vendas:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao buscar vendas.'
            });
        }
    }
);

app.patch(
    '/api/vendas/:vendaId/itens/:itemId',
    autenticarToken,
    verificarPermissao('vendas', 'editar'),
    async (req, res) => {
    const { vendaId, itemId } = req.params;
    const { quantidade, desconto } = req.body;

    if (quantidade === undefined) {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'A quantidade é obrigatória.'
        });
    }

    const novaQuantidade = Number(quantidade);
    const novoDesconto = desconto === undefined ? 0 : Number(desconto);

    if (!Number.isFinite(novaQuantidade) || novaQuantidade <= 0) {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'A quantidade deve ser maior que zero.'
        });
    }

    if (!Number.isFinite(novoDesconto) || novoDesconto < 0) {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'O desconto não pode ser negativo.'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const vendaResult = await client.query(`
            SELECT
                id,
                subtotal,
                desconto,
                total,
                status
            FROM vendas
            WHERE id = $1
            FOR UPDATE
        `, [vendaId]);

        if (vendaResult.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(404).json({
                sucesso: false,
                mensagem: 'Venda não encontrada.'
            });
        }

        const venda = vendaResult.rows[0];

        if (venda.status !== 'ABERTA') {
            await client.query('ROLLBACK');

            return res.status(400).json({
                sucesso: false,
                mensagem: 'Só é possível alterar itens de uma venda ABERTA.'
            });
        }

        // Verifica se a venda já possui pagamentos
        const pagamentoResult = await client.query(`
            SELECT
                COALESCE(SUM(valor), 0) AS total_pago
            FROM pagamentos
            WHERE venda_id = $1
              AND status IN ('PAGO', 'PENDENTE')
        `, [vendaId]);

        const totalPago = Number(
            pagamentoResult.rows[0].total_pago
        );

        if (totalPago > 0) {
            await client.query('ROLLBACK');

            return res.status(400).json({
                sucesso: false,
                mensagem: 'Não é possível alterar itens de uma venda que já possui pagamento registrado.',
                total_pago: totalPago
            });
        }

        const itemResult = await client.query(`
            SELECT
                iv.id,
                iv.venda_id,
                iv.produto_id,
                iv.quantidade,
                iv.preco_unitario,
                iv.desconto,
                p.nome AS produto,
                p.ativo,
                p.estoque_atual
            FROM itens_venda iv
            INNER JOIN produtos p
                ON p.id = iv.produto_id
            WHERE iv.id = $1
              AND iv.venda_id = $2
            FOR UPDATE
        `, [itemId, vendaId]);

        if (itemResult.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(404).json({
                sucesso: false,
                mensagem: 'Item não encontrado nesta venda.'
            });
        }

        const item = itemResult.rows[0];

        if (!item.ativo) {
            await client.query('ROLLBACK');

            return res.status(400).json({
                sucesso: false,
                mensagem: 'O produto deste item está inativo.'
            });
        }

        const estoqueAtual = Number(item.estoque_atual);

        if (novaQuantidade > estoqueAtual) {
            await client.query('ROLLBACK');

            return res.status(400).json({
                sucesso: false,
                mensagem: `Estoque insuficiente. Estoque atual: ${estoqueAtual}.`
            });
        }

        const valorBruto =
            novaQuantidade * Number(item.preco_unitario);

        if (novoDesconto > valorBruto) {
            await client.query('ROLLBACK');

            return res.status(400).json({
                sucesso: false,
                mensagem: 'O desconto não pode ser maior que o valor do item.'
            });
        }

        const subtotal = valorBruto - novoDesconto;

        await client.query(`
            UPDATE itens_venda
            SET
                quantidade = $1,
                desconto = $2,
                subtotal = $3
            WHERE id = $4
              AND venda_id = $5
        `, [
            novaQuantidade,
            novoDesconto,
            subtotal,
            itemId,
            vendaId
        ]);

        const totalResult = await client.query(`
            SELECT
                COALESCE(SUM(subtotal), 0) AS subtotal
            FROM itens_venda
            WHERE venda_id = $1
        `, [vendaId]);

        const novoSubtotal = Number(
            totalResult.rows[0].subtotal
        );

        const descontoVenda = Number(venda.desconto || 0);

        if (descontoVenda > novoSubtotal) {
            await client.query('ROLLBACK');

            return res.status(400).json({
                sucesso: false,
                mensagem: 'O desconto geral da venda não pode ser maior que o novo subtotal.'
            });
        }

        const novoTotal = Math.max(
            novoSubtotal - descontoVenda,
            0
        );

        await client.query(`
            UPDATE vendas
            SET
                subtotal = $1,
                total = $2,
                updated_at = NOW()
            WHERE id = $3
        `, [
            novoSubtotal,
            novoTotal,
            vendaId
        ]);

        await client.query('COMMIT');

        res.json({
            sucesso: true,
            mensagem: 'Item atualizado com sucesso.',
            item: {
                id: Number(itemId),
                produto_id: Number(item.produto_id),
                produto: item.produto,
                quantidade: novaQuantidade,
                preco_unitario: Number(item.preco_unitario),
                desconto: novoDesconto,
                subtotal: subtotal
            },
            venda: {
                id: Number(vendaId),
                subtotal: novoSubtotal,
                desconto: descontoVenda,
                total: novoTotal
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');

        console.error(
            'Erro ao atualizar item da venda:',
            error
        );

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro interno ao atualizar item da venda.'
        });

    } finally {
        client.release();
    }
});


app.patch(
    '/api/vendas/:vendaId/desconto',
    autenticarToken,
    verificarPermissao('vendas', 'editar'),
    async (req, res) => {
    const { vendaId } = req.params;
    const { desconto } = req.body;

    if (desconto === undefined) {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'O desconto é obrigatório.'
        });
    }

    const novoDesconto = Number(desconto);

    if (!Number.isFinite(novoDesconto) || novoDesconto < 0) {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'O desconto deve ser um valor maior ou igual a zero.'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const vendaResult = await client.query(`
            SELECT
                id,
                subtotal,
                desconto,
                total,
                status
            FROM vendas
            WHERE id = $1
            FOR UPDATE
        `, [vendaId]);

        if (vendaResult.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(404).json({
                sucesso: false,
                mensagem: 'Venda não encontrada.'
            });
        }

        const venda = vendaResult.rows[0];

        if (venda.status !== 'ABERTA') {
            await client.query('ROLLBACK');

            return res.status(400).json({
                sucesso: false,
                mensagem: 'Só é possível alterar o desconto de uma venda ABERTA.'
            });
        }

        // Verifica se a venda já possui pagamentos
const pagamentoResult = await client.query(`
    SELECT
        COALESCE(SUM(valor), 0) AS total_pago
    FROM pagamentos
    WHERE venda_id = $1
      AND status IN ('PAGO', 'PENDENTE')
`, [vendaId]);

const totalPago = Number(
    pagamentoResult.rows[0].total_pago
);

if (totalPago > 0) {
    await client.query('ROLLBACK');

    return res.status(400).json({
        sucesso: false,
        mensagem: 'Não é possível alterar o desconto de uma venda que já possui pagamento registrado.',
        total_pago: totalPago
    });
}

        const subtotal = Number(venda.subtotal);

        if (novoDesconto > subtotal) {
            await client.query('ROLLBACK');

            return res.status(400).json({
                sucesso: false,
                mensagem: 'O desconto não pode ser maior que o subtotal da venda.'
            });
        }

        const novoTotal = subtotal - novoDesconto;

        await client.query(`
            UPDATE vendas
            SET
                desconto = $1,
                total = $2,
                updated_at = NOW()
            WHERE id = $3
        `, [
            novoDesconto,
            novoTotal,
            vendaId
        ]);

        await client.query('COMMIT');

        res.json({
            sucesso: true,
            mensagem: 'Desconto da venda atualizado com sucesso.',
            venda: {
                id: Number(vendaId),
                subtotal: subtotal,
                desconto: novoDesconto,
                total: novoTotal
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');

        console.error('Erro ao atualizar desconto da venda:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro interno ao atualizar desconto da venda.'
        });

    } finally {
        client.release();
    }
});

app.delete(
    '/api/vendas/:vendaId/itens/:itemId',
    autenticarToken,
    verificarPermissao('vendas', 'excluir'),
    async (req, res) => {
    const { vendaId, itemId } = req.params;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Busca a venda
        const vendaResult = await client.query(`
            SELECT
                id,
                subtotal,
                desconto,
                total,
                status
            FROM vendas
            WHERE id = $1
            FOR UPDATE
        `, [vendaId]);

        if (vendaResult.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(404).json({
                sucesso: false,
                mensagem: 'Venda não encontrada.'
            });
        }

        const venda = vendaResult.rows[0];

        // Só permite excluir itens de vendas abertas
        if (venda.status !== 'ABERTA') {
            await client.query('ROLLBACK');

            return res.status(400).json({
                sucesso: false,
                mensagem: 'Só é possível excluir itens de uma venda ABERTA.'
            });
        }

        // Verifica se já existe pagamento
        const pagamentoResult = await client.query(`
            SELECT
                COALESCE(SUM(valor), 0) AS total_pago
            FROM pagamentos
            WHERE venda_id = $1
              AND status IN ('PAGO', 'PENDENTE')
        `, [vendaId]);

        const totalPago = Number(
            pagamentoResult.rows[0].total_pago
        );

        if (totalPago > 0) {
            await client.query('ROLLBACK');

            return res.status(400).json({
                sucesso: false,
                mensagem: 'Não é possível excluir itens de uma venda que já possui pagamento registrado.',
                total_pago: totalPago
            });
        }

        // Verifica se o item pertence à venda
        const itemResult = await client.query(`
            SELECT
                id,
                venda_id,
                produto_id,
                quantidade,
                preco_unitario,
                desconto,
                subtotal
            FROM itens_venda
            WHERE id = $1
              AND venda_id = $2
            FOR UPDATE
        `, [itemId, vendaId]);

        if (itemResult.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(404).json({
                sucesso: false,
                mensagem: 'Item não encontrado nesta venda.'
            });
        }

        const item = itemResult.rows[0];

        // Exclui o item
        await client.query(`
            DELETE FROM itens_venda
            WHERE id = $1
              AND venda_id = $2
        `, [itemId, vendaId]);

        // Recalcula o subtotal da venda
        const totalResult = await client.query(`
            SELECT
                COALESCE(SUM(subtotal), 0) AS subtotal
            FROM itens_venda
            WHERE venda_id = $1
        `, [vendaId]);

        const novoSubtotal = Number(
            totalResult.rows[0].subtotal
        );

        const descontoVenda = Number(venda.desconto || 0);

        // Se o desconto geral ficou maior que o novo subtotal,
        // ajustamos para o novo subtotal.
        const novoDesconto = Math.min(
            descontoVenda,
            novoSubtotal
        );

        const novoTotal = novoSubtotal - novoDesconto;

        await client.query(`
            UPDATE vendas
            SET
                subtotal = $1,
                desconto = $2,
                total = $3,
                updated_at = NOW()
            WHERE id = $4
        `, [
            novoSubtotal,
            novoDesconto,
            novoTotal,
            vendaId
        ]);

        await client.query('COMMIT');

        res.json({
            sucesso: true,
            mensagem: 'Item excluído com sucesso.',
            item_excluido: {
                id: Number(item.id),
                produto_id: Number(item.produto_id),
                quantidade: Number(item.quantidade),
                subtotal: Number(item.subtotal)
            },
            venda: {
                id: Number(vendaId),
                subtotal: novoSubtotal,
                desconto: novoDesconto,
                total: novoTotal
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');

        console.error(
            'Erro ao excluir item da venda:',
            error
        );

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro interno ao excluir item da venda.'
        });

    } finally {
        client.release();
    }
});

app.patch(
    '/api/vendas/:vendaId/finalizar',
    autenticarToken,
    verificarPermissao('vendas', 'editar'),
    async (req, res) => {
        const client = await pool.connect();

        try {
            const { vendaId } = req.params;

            await client.query('BEGIN');

            // 1. Buscar e bloquear a venda
            const vendaResult = await client.query(`
                SELECT
                    id,
                    subtotal,
                    desconto,
                    total,
                    status
                FROM vendas
                WHERE id = $1
                FOR UPDATE
            `, [vendaId]);

            if (vendaResult.rows.length === 0) {
                await client.query('ROLLBACK');

                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Venda não encontrada.'
                });
            }

            const venda = vendaResult.rows[0];

            if (venda.status !== 'ABERTA') {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'A venda não está aberta.'
                });
            }

            // 2. Buscar itens
            const itensResult = await client.query(`
                SELECT
                    i.id,
                    i.produto_id,
                    i.quantidade,
                    i.preco_unitario,
                    i.subtotal,
                    p.nome AS produto,
                    p.estoque_atual,
                    p.ativo
                FROM itens_venda i
                INNER JOIN produtos p
                    ON p.id = i.produto_id
                WHERE i.venda_id = $1
                FOR UPDATE OF p
            `, [vendaId]);

            if (itensResult.rows.length === 0) {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'A venda não possui produtos.'
                });
            }

            // 3. Conferir estoque
            for (const item of itensResult.rows) {

                if (!item.ativo) {
                    await client.query('ROLLBACK');

                    return res.status(400).json({
                        sucesso: false,
                        mensagem:
                            `O produto "${item.produto}" está inativo.`
                    });
                }

                const estoqueAtual = Number(
                    item.estoque_atual
                );

                const quantidade = Number(
                    item.quantidade
                );

                if (quantidade > estoqueAtual) {
                    await client.query('ROLLBACK');

                    return res.status(400).json({
                        sucesso: false,
                        mensagem:
                            `Estoque insuficiente para o produto "${item.produto}".`
                    });
                }
            }

            // 4. Conferir pagamentos
            const pagamentosResult = await client.query(`
                SELECT
                    COALESCE(SUM(valor), 0) AS total_pago
                FROM pagamentos
                WHERE venda_id = $1
                  AND status = 'PAGO'
            `, [vendaId]);

            const totalPago = Number(
                pagamentosResult.rows[0].total_pago
            );

            const totalVenda = Number(venda.total);

            if (totalPago < totalVenda) {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'O valor pago é inferior ao total da venda.',
                    total_venda: totalVenda,
                    total_pago: totalPago,
                    restante: Number(
                        (totalVenda - totalPago).toFixed(2)
                    )
                });
            }

            // 5. Baixar estoque e registrar movimentação
            for (const item of itensResult.rows) {

                const estoqueAnterior = Number(
                    item.estoque_atual
                );

                const quantidade = Number(
                    item.quantidade
                );

                const estoquePosterior =
                    estoqueAnterior - quantidade;

                await client.query(`
                    UPDATE produtos
                    SET
                        estoque_atual = $1,
                        updated_at = NOW()
                    WHERE id = $2
                `, [
                    estoquePosterior,
                    item.produto_id
                ]);

                await client.query(`
                    INSERT INTO movimentacoes_estoque (
                        produto_id,
                        usuario_id,
                        tipo,
                        quantidade,
                        estoque_anterior,
                        estoque_posterior,
                        motivo
                    )
                    VALUES (
                        $1,
                        $2,
                        'SAIDA',
                        $3,
                        $4,
                        $5,
                        $6
                    )
                `, [
                    item.produto_id,
                    req.usuario.id,
                    quantidade,
                    estoqueAnterior,
                    estoquePosterior,
                    `Venda #${vendaId}`
                ]);
            }

            // 6. Finalizar venda
            const vendaFinalizada = await client.query(`
                UPDATE vendas
                SET
                    status = 'FINALIZADA',
                    updated_at = NOW()
                WHERE id = $1
                RETURNING
                    id,
                    cliente_id,
                    usuario_id,
                    data_venda,
                    subtotal,
                    desconto,
                    total,
                    status,
                    observacoes,
                    created_at,
                    updated_at
            `, [vendaId]);

            await client.query('COMMIT');

            res.json({
                sucesso: true,
                mensagem: 'Venda finalizada com sucesso.',
                venda: vendaFinalizada.rows[0],
                pagamento: {
                    total_pago: totalPago,
                    troco: Number(
                        Math.max(
                            totalPago - totalVenda,
                            0
                        ).toFixed(2)
                    )
                }
            });

        } catch (error) {

            await client.query('ROLLBACK');

            console.error(
                'Erro ao finalizar venda:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao finalizar venda.'
            });

        } finally {
            client.release();
        }
    }
);

app.get(
    '/api/usuarios',
    autenticarToken,
    verificarPermissao('usuarios', 'visualizar'),
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    id,
                    nome,
                    email,
                    perfil,
                    ativo,
                    created_at,
                    updated_at
                FROM usuarios
                ORDER BY nome ASC
            `);

            res.json(result.rows);

        } catch (error) {
            console.error('Erro ao buscar usuários:', error);

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao buscar usuários.'
            });
        }
    }
);

app.post(
    '/api/usuarios',
    autenticarToken,
    verificarPermissao('usuarios', 'criar'),
    async (req, res) => {
        try {
            const {
                nome,
                email,
                senha,
                perfil
            } = req.body;

            if (!nome || !email || !senha || !perfil) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Nome, e-mail, senha e perfil são obrigatórios.'
                });
            }

            const perfisValidos = [
                'ADMIN',
                'GERENTE',
                'ATENDENTE'
            ];

            if (!perfisValidos.includes(perfil)) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Perfil de usuário inválido.'
                });
            }

            const usuarioExistente = await pool.query(`
                SELECT id
                FROM usuarios
                WHERE email = $1
                LIMIT 1
            `, [email]);

            if (usuarioExistente.rows.length > 0) {
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'Já existe um usuário com este e-mail.'
                });
            }

            const senhaHash = await bcrypt.hash(senha, 12);

            const result = await pool.query(`
                INSERT INTO usuarios (
                    nome,
                    email,
                    senha,
                    perfil
                )
                VALUES ($1, $2, $3, $4)
                RETURNING
                    id,
                    nome,
                    email,
                    perfil,
                    ativo,
                    created_at,
                    updated_at
            `, [
                nome,
                email,
                senhaHash,
                perfil
            ]);

            res.status(201).json({
                sucesso: true,
                mensagem: 'Usuário cadastrado com sucesso.',
                usuario: result.rows[0]
            });

        } catch (error) {
            console.error('Erro ao cadastrar usuário:', error);

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao cadastrar usuário.'
            });
        }
    }
);

app.put(
    '/api/usuarios/:id',
    autenticarToken,
    verificarPermissao('usuarios', 'editar'),
    async (req, res) => {
        try {
            const { id } = req.params;
            const {
                nome,
                email,
                senha,
                perfil,
                ativo
            } = req.body;

            if (!nome || !email || !perfil || ativo === undefined) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Nome, e-mail, perfil e ativo são obrigatórios.'
                });
            }

            const perfisValidos = [
                'ADMIN',
                'GERENTE',
                'ATENDENTE'
            ];

            if (!perfisValidos.includes(perfil)) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Perfil de usuário inválido.'
                });
            }

            const usuarioExistente = await pool.query(`
                SELECT id
                FROM usuarios
                WHERE id = $1
                LIMIT 1
            `, [id]);

            if (usuarioExistente.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Usuário não encontrado.'
                });
            }

            const emailExistente = await pool.query(`
                SELECT id
                FROM usuarios
                WHERE email = $1
                AND id <> $2
                LIMIT 1
            `, [email, id]);

            if (emailExistente.rows.length > 0) {
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'Já existe outro usuário com este e-mail.'
                });
            }

            let result;

            if (senha) {
                const senhaHash = await bcrypt.hash(senha, 12);

                result = await pool.query(`
                    UPDATE usuarios
                    SET
                        nome = $1,
                        email = $2,
                        senha = $3,
                        perfil = $4,
                        ativo = $5,
                        updated_at = NOW()
                    WHERE id = $6
                    RETURNING
                        id,
                        nome,
                        email,
                        perfil,
                        ativo,
                        created_at,
                        updated_at
                `, [
                    nome,
                    email,
                    senhaHash,
                    perfil,
                    ativo,
                    id
                ]);

            } else {
                result = await pool.query(`
                    UPDATE usuarios
                    SET
                        nome = $1,
                        email = $2,
                        perfil = $3,
                        ativo = $4,
                        updated_at = NOW()
                    WHERE id = $5
                    RETURNING
                        id,
                        nome,
                        email,
                        perfil,
                        ativo,
                        created_at,
                        updated_at
                `, [
                    nome,
                    email,
                    perfil,
                    ativo,
                    id
                ]);
            }

            res.json({
                sucesso: true,
                mensagem: 'Usuário atualizado com sucesso.',
                usuario: result.rows[0]
            });

        } catch (error) {
            console.error('Erro ao atualizar usuário:', error);

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao atualizar usuário.'
            });
        }
    }
);

app.delete(
    '/api/usuarios/:id',
    autenticarToken,
    verificarPermissao('usuarios', 'excluir'),
    async (req, res) => {
        try {
            const { id } = req.params;

            if (Number(id) === Number(req.usuario.id)) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Você não pode desativar o próprio usuário.'
                });
            }

            const result = await pool.query(`
                UPDATE usuarios
                SET
                    ativo = FALSE,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING
                    id,
                    nome,
                    email,
                    perfil,
                    ativo,
                    created_at,
                    updated_at
            `, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Usuário não encontrado.'
                });
            }

            res.json({
                sucesso: true,
                mensagem: 'Usuário desativado com sucesso.',
                usuario: result.rows[0]
            });

        } catch (error) {
            console.error('Erro ao desativar usuário:', error);

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao desativar usuário.'
            });
        }
    }
);

app.get(
    '/api/dashboard',
    autenticarToken,
    verificarPermissao('dashboard', 'visualizar'),
    async (req, res) => {
        try {
            const [
                clientes,
                pets,
                usuarios,
                agendamentosHoje,
                consultasHoje,
                agendamentosPendentes,
                consultasPendentes,
                produtos,
                estoqueBaixo,
                estoqueZerado,
                vendasHoje,
                faturamentoHoje,
                vendasAbertas,
                vendasCanceladas
            ] = await Promise.all([
                pool.query(`
    SELECT
        a.id,
        a.pet_id,
        pets.nome AS pet_nome,
        clientes.nome AS cliente_nome,
        a.servico_id,
        servicos.nome AS servico_nome,
        a.data,
        a.horario,
        a.status
    FROM agendamentos a
    INNER JOIN pets
        ON pets.id = a.pet_id
    INNER JOIN clientes
        ON clientes.id = pets.cliente_id
    INNER JOIN servicos
        ON servicos.id = a.servico_id
    WHERE a.status IN ('AGENDADO', 'CONFIRMADO')
      AND a.data
          BETWEEN CURRENT_DATE
          AND CURRENT_DATE + INTERVAL '7 days'
    ORDER BY a.data, a.horario
`),

                pool.query(`
                    SELECT COUNT(*) AS total
                    FROM clientes
                    WHERE ativo = TRUE
                `),

                pool.query(`
                    SELECT COUNT(*) AS total
                    FROM pets
                    WHERE ativo = TRUE
                `),

                pool.query(`
                    SELECT COUNT(*) AS total
                    FROM usuarios
                    WHERE ativo = TRUE
                `),

                pool.query(`
                    SELECT COUNT(*) AS total
                    FROM agendamentos
                    WHERE data = CURRENT_DATE
                      AND status NOT IN ('CANCELADO', 'NAO_COMPARECEU')
                `),

                pool.query(`
                    SELECT COUNT(*) AS total
                    FROM consultas
                    WHERE data_consulta = CURRENT_DATE
                      AND status NOT IN ('CANCELADA', 'CONCLUIDA')
                `),

                pool.query(`
                    SELECT COUNT(*) AS total
                    FROM agendamentos
                    WHERE status IN ('AGENDADO', 'CONFIRMADO')
                `),

                pool.query(`
                    SELECT COUNT(*) AS total
                    FROM consultas
                    WHERE status IN ('AGENDADA', 'CONFIRMADA')
                `),

                pool.query(`
                    SELECT COUNT(*) AS total
                    FROM produtos
                    WHERE ativo = TRUE
                `),

                pool.query(`
                    SELECT COUNT(*) AS total
                    FROM produtos
                    WHERE ativo = TRUE
                      AND estoque_atual > 0
                      AND estoque_atual <= estoque_minimo
                `),

                pool.query(`
                    SELECT COUNT(*) AS total
                    FROM produtos
                    WHERE ativo = TRUE
                      AND estoque_atual <= 0
                `),

                pool.query(`
                    SELECT COUNT(*) AS total
                    FROM vendas
                    WHERE DATE(data_venda) = CURRENT_DATE
                      AND status = 'FINALIZADA'
                `),

                pool.query(`
                    SELECT COALESCE(SUM(total), 0) AS total
                    FROM vendas
                    WHERE DATE(data_venda) = CURRENT_DATE
                      AND status = 'FINALIZADA'
                `),

                pool.query(`
                    SELECT COUNT(*) AS total
                    FROM vendas
                    WHERE status = 'ABERTA'
                `),

                pool.query(`
                    SELECT COUNT(*) AS total
                    FROM vendas
                    WHERE status = 'CANCELADA'
                `)
            ]);

            res.json({
                sucesso: true,
                dashboard: {
                    cadastros: {
                        clientes_ativos: Number(clientes.rows[0].total),
                        pets_ativos: Number(pets.rows[0].total),
                        usuarios_ativos: Number(usuarios.rows[0].total)
                    },

                    agenda: {
                        agendamentos_hoje: Number(agendamentosHoje.rows[0].total),
                        consultas_hoje: Number(consultasHoje.rows[0].total),
                        agendamentos_pendentes: Number(agendamentosPendentes.rows[0].total),
                        consultas_pendentes: Number(consultasPendentes.rows[0].total)
                    },

                    estoque: {
                        produtos_ativos: Number(produtos.rows[0].total),
                        estoque_baixo: Number(estoqueBaixo.rows[0].total),
                        estoque_zerado: Number(estoqueZerado.rows[0].total)
                    },

                    vendas: {
                        vendas_hoje: Number(vendasHoje.rows[0].total),
                        faturamento_hoje: Number(faturamentoHoje.rows[0].total),
                        vendas_abertas: Number(vendasAbertas.rows[0].total),
                        vendas_canceladas: Number(vendasCanceladas.rows[0].total)
                    }
                }
            });

        } catch (error) {
            console.error(
                'Erro ao carregar dashboard:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao carregar dashboard.'
            });
        }
    }
);

app.get(
    '/api/relatorios/vendas',
    autenticarToken,
    verificarPermissao('relatorios', 'visualizar'),
    async (req, res) => {
        try {
            const { data_inicio, data_fim } = req.query;

            if (!data_inicio || !data_fim) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'data_inicio e data_fim são obrigatórios.'
                });
            }

            const result = await pool.query(`
                SELECT
                    COUNT(*) FILTER (
                        WHERE status = 'FINALIZADA'
                    ) AS vendas_finalizadas,

                    COUNT(*) FILTER (
                        WHERE status = 'CANCELADA'
                    ) AS vendas_canceladas,

                    COUNT(*) FILTER (
                        WHERE status = 'ABERTA'
                    ) AS vendas_abertas,

                    COALESCE(
                        SUM(total) FILTER (
                            WHERE status = 'FINALIZADA'
                        ),
                        0
                    ) AS total_vendido,

                    COALESCE(
                        SUM(desconto) FILTER (
                            WHERE status = 'FINALIZADA'
                        ),
                        0
                    ) AS total_descontos

                FROM vendas

                WHERE data_venda >= $1::date
                  AND data_venda < ($2::date + INTERVAL '1 day')
            `, [
                data_inicio,
                data_fim
            ]);

            const dados = result.rows[0];

            res.json({
                sucesso: true,
                periodo: {
                    data_inicio,
                    data_fim
                },
                relatorio: {
                    vendas_finalizadas: Number(dados.vendas_finalizadas),
                    vendas_canceladas: Number(dados.vendas_canceladas),
                    vendas_abertas: Number(dados.vendas_abertas),
                    total_vendido: Number(dados.total_vendido),
                    total_descontos: Number(dados.total_descontos)
                }
            });

        } catch (error) {
            console.error(
                'Erro ao gerar relatório de vendas:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao gerar relatório de vendas.'
            });
        }
    }
);

app.get(
    '/api/relatorios/estoque',
    autenticarToken,
    verificarPermissao('relatorios', 'visualizar'),
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    id,
                    nome,
                    codigo_barras,
                    categoria,
                    marca,
                    unidade,
                    estoque_atual,
                    estoque_minimo,
                    preco_custo,
                    preco_venda,

                    CASE
                        WHEN estoque_atual <= 0 THEN 'ZERADO'
                        WHEN estoque_atual <= estoque_minimo THEN 'BAIXO'
                        ELSE 'NORMAL'
                    END AS situacao_estoque

                FROM produtos

                WHERE ativo = TRUE

                ORDER BY
                    CASE
                        WHEN estoque_atual <= 0 THEN 1
                        WHEN estoque_atual <= estoque_minimo THEN 2
                        ELSE 3
                    END,
                    nome
            `);

            const produtos = result.rows;

            const resumo = {
                total_produtos: produtos.length,

                estoque_zerado: produtos.filter(
                    produto => produto.situacao_estoque === 'ZERADO'
                ).length,

                estoque_baixo: produtos.filter(
                    produto => produto.situacao_estoque === 'BAIXO'
                ).length,

                estoque_normal: produtos.filter(
                    produto => produto.situacao_estoque === 'NORMAL'
                ).length
            };

            res.json({
                sucesso: true,
                resumo,
                produtos
            });

        } catch (error) {
            console.error(
                'Erro ao gerar relatório de estoque:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao gerar relatório de estoque.'
            });
        }
    }
);

app.get(
    '/api/relatorios/clientes',
    autenticarToken,
    verificarPermissao('relatorios', 'visualizar'),
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    c.id,
                    c.nome,
                    c.cpf_cnpj,
                    c.telefone,
                    c.whatsapp,
                    c.email,
                    c.cidade,
                    c.estado,

                    COUNT(p.id) FILTER (
                        WHERE p.ativo = TRUE
                    ) AS total_pets

                FROM clientes c

                LEFT JOIN pets p
                    ON p.cliente_id = c.id

                WHERE c.ativo = TRUE

                GROUP BY
                    c.id,
                    c.nome,
                    c.cpf_cnpj,
                    c.telefone,
                    c.whatsapp,
                    c.email,
                    c.cidade,
                    c.estado

                ORDER BY c.nome
            `);

            const clientes = result.rows;

            const resumo = {
                total_clientes: clientes.length,

                total_pets: clientes.reduce(
                    (total, cliente) =>
                        total + Number(cliente.total_pets),
                    0
                ),

                clientes_com_pets: clientes.filter(
                    cliente => Number(cliente.total_pets) > 0
                ).length,

                clientes_sem_pets: clientes.filter(
                    cliente => Number(cliente.total_pets) === 0
                ).length
            };

            res.json({
                sucesso: true,
                resumo,
                clientes
            });

        } catch (error) {
            console.error(
                'Erro ao gerar relatório de clientes:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao gerar relatório de clientes.'
            });
        }
    }
);

app.get(
    '/api/relatorios/agenda',
    autenticarToken,
    verificarPermissao('relatorios', 'visualizar'),
    async (req, res) => {
        try {
            const { data_inicio, data_fim } = req.query;

            if (!data_inicio || !data_fim) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'data_inicio e data_fim são obrigatórios.'
                });
            }

            const [agendamentosResult, consultasResult] =
                await Promise.all([

                    pool.query(`
                        SELECT
                            a.id,
                            'AGENDAMENTO' AS tipo,
                            a.data,
                            a.horario,
                            a.status,

                            pets.id AS pet_id,
                            pets.nome AS pet_nome,

                            clientes.id AS cliente_id,
                            clientes.nome AS cliente_nome,

                            servicos.id AS servico_id,
                            servicos.nome AS servico_nome,

                            a.observacoes

                        FROM agendamentos a

                        INNER JOIN pets
                            ON pets.id = a.pet_id

                        INNER JOIN clientes
                            ON clientes.id = pets.cliente_id

                        INNER JOIN servicos
                            ON servicos.id = a.servico_id

                        WHERE a.data BETWEEN $1::date AND $2::date

                        ORDER BY
                            a.data,
                            a.horario,
                            a.id
                    `, [
                        data_inicio,
                        data_fim
                    ]),

                    pool.query(`
                        SELECT
                            c.id,
                            'CONSULTA' AS tipo,
                            c.data_consulta AS data,
                            c.horario,
                            c.status,

                            pets.id AS pet_id,
                            pets.nome AS pet_nome,

                            clientes.id AS cliente_id,
                            clientes.nome AS cliente_nome,

                            NULL AS servico_id,
                            NULL AS servico_nome,

                            c.motivo,
                            c.observacoes

                        FROM consultas c

                        INNER JOIN pets
                            ON pets.id = c.pet_id

                        INNER JOIN clientes
                            ON clientes.id = pets.cliente_id

                        WHERE c.data_consulta
                            BETWEEN $1::date AND $2::date

                        ORDER BY
                            c.data_consulta,
                            c.horario,
                            c.id
                    `, [
                        data_inicio,
                        data_fim
                    ])
                ]);

            const agendamentos = agendamentosResult.rows;
            const consultas = consultasResult.rows;

            const eventos = [
                ...agendamentos,
                ...consultas
            ].sort((a, b) => {
                const dataA = `${a.data} ${a.horario || '00:00:00'}`;
                const dataB = `${b.data} ${b.horario || '00:00:00'}`;

                return dataA.localeCompare(dataB);
            });

            const resumo = {
                total_eventos: eventos.length,

                total_agendamentos: agendamentos.length,

                total_consultas: consultas.length,

                agendamentos_cancelados:
                    agendamentos.filter(
                        item => item.status === 'CANCELADO'
                    ).length,

                consultas_canceladas:
                    consultas.filter(
                        item => item.status === 'CANCELADA'
                    ).length
            };

            res.json({
                sucesso: true,

                periodo: {
                    data_inicio,
                    data_fim
                },

                resumo,

                eventos
            });

        } catch (error) {
            console.error(
                'Erro ao gerar relatório da agenda:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao gerar relatório da agenda.'
            });
        }
    }
);

app.get(
    '/api/notificacoes',
    autenticarToken,
    verificarPermissao('notificacoes', 'visualizar'),
    async (req, res) => {
        try {
            const [
                estoqueResult,
                vacinasResult,
                consultasResult,
                agendamentosResult
            ] = await Promise.all([

                pool.query(`
                    SELECT
                        id,
                        nome,
                        estoque_atual,
                        estoque_minimo
                    FROM produtos
                    WHERE ativo = TRUE
                      AND estoque_atual <= estoque_minimo
                    ORDER BY estoque_atual ASC, nome
                `),

                pool.query(`
                    SELECT
                        av.id,
                        av.pet_id,
                        pets.nome AS pet_nome,
                        av.vacina_id,
                        vacinas.nome AS vacina_nome,
                        av.proxima_dose
                    FROM aplicacoes_vacinas av
                    INNER JOIN pets
                        ON pets.id = av.pet_id
                    INNER JOIN vacinas
                        ON vacinas.id = av.vacina_id
                    WHERE av.ativo = TRUE
                      AND av.proxima_dose IS NOT NULL
                      AND av.proxima_dose
                          BETWEEN CURRENT_DATE
                          AND CURRENT_DATE + INTERVAL '30 days'
                    ORDER BY av.proxima_dose
                `),

                pool.query(`
                    SELECT
                        c.id,
                        c.pet_id,
                        pets.nome AS pet_nome,
                        clientes.nome AS cliente_nome,
                        c.data_consulta,
                        c.horario,
                        c.status
                    FROM consultas c
                    INNER JOIN pets
                        ON pets.id = c.pet_id
                    INNER JOIN clientes
                        ON clientes.id = pets.cliente_id
                    WHERE c.status IN ('AGENDADA', 'CONFIRMADA')
                      AND c.data_consulta
                          BETWEEN CURRENT_DATE
                          AND CURRENT_DATE + INTERVAL '7 days'
                    ORDER BY c.data_consulta, c.horario
                `),

                pool.query(`
                    SELECT
                        a.id,
                        a.pet_id,
                        pets.nome AS pet_nome,
                        clientes.nome AS cliente_nome,
                        a.servico_id,
                        servicos.nome AS servico_nome,
                        a.data,
                        a.horario,
                        a.status
                    FROM agendamentos a
                    INNER JOIN pets
                        ON pets.id = a.pet_id
                    INNER JOIN clientes
                        ON clientes.id = pets.cliente_id
                    INNER JOIN servicos
                        ON servicos.id = a.servico_id
                    WHERE a.status IN ('AGENDADO', 'CONFIRMADO')
                      AND a.data
                          BETWEEN CURRENT_DATE
                          AND CURRENT_DATE + INTERVAL '7 days'
                    ORDER BY a.data, a.horario
                `)
            ]);

            const notificacoes = [];

            estoqueResult.rows.forEach(produto => {
                if (Number(produto.estoque_atual) <= 0) {
                    notificacoes.push({
                        tipo: 'ESTOQUE_ZERADO',
                        prioridade: 'ALTA',
                        mensagem:
                            `O produto ${produto.nome} está sem estoque.`,
                        referencia_id: produto.id
                    });
                } else {
                    notificacoes.push({
                        tipo: 'ESTOQUE_BAIXO',
                        prioridade: 'MEDIA',
                        mensagem:
                            `O produto ${produto.nome} está com estoque baixo.`,
                        referencia_id: produto.id
                    });
                }
            });

            vacinasResult.rows.forEach(vacina => {
                notificacoes.push({
                    tipo: 'VACINA_PROXIMA',
                    prioridade: 'MEDIA',
                    mensagem:
                        `A vacina ${vacina.vacina_nome} do pet ${vacina.pet_nome} está próxima da próxima dose.`,
                    referencia_id: vacina.id,
                    data: vacina.proxima_dose
                });
            });

            consultasResult.rows.forEach(consulta => {
                notificacoes.push({
                    tipo: 'CONSULTA_PROXIMA',
                    prioridade: 'MEDIA',
                    mensagem:
                        `O pet ${consulta.pet_nome}, de ${consulta.cliente_nome}, possui uma consulta próxima.`,
                    referencia_id: consulta.id,
                    data: consulta.data_consulta,
                    horario: consulta.horario
                });
            });

            agendamentosResult.rows.forEach(agendamento => {
                notificacoes.push({
                    tipo: 'AGENDAMENTO_PROXIMO',
                    prioridade: 'MEDIA',
                    mensagem:
                        `O pet ${agendamento.pet_nome}, de ${agendamento.cliente_nome}, possui um agendamento próximo para ${agendamento.servico_nome}.`,
                    referencia_id: agendamento.id,
                    data: agendamento.data,
                    horario: agendamento.horario
                });
            });

            res.json({
                sucesso: true,
                total: notificacoes.length,
                notificacoes
            });

        } catch (error) {
            console.error(
                'Erro ao carregar notificações:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao carregar notificações.'
            });
        }
    }
);

app.post(
    '/api/notificacoes',
    autenticarToken,
    verificarPermissao('notificacoes', 'criar'),
    async (req, res) => {
        try {
            const {
                tipo,
                prioridade,
                titulo,
                mensagem,
                referencia_id,
                referencia_tipo
            } = req.body;

            if (!tipo || !titulo || !mensagem) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem:
                        'Tipo, título e mensagem são obrigatórios.'
                });
            }

            const result = await pool.query(`
                INSERT INTO notificacoes (
                    usuario_id,
                    tipo,
                    prioridade,
                    titulo,
                    mensagem,
                    referencia_id,
                    referencia_tipo
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [
                req.usuario.id,
                tipo,
                prioridade || 'MEDIA',
                titulo,
                mensagem,
                referencia_id || null,
                referencia_tipo || null
            ]);

            res.status(201).json({
                sucesso: true,
                mensagem: 'Notificação criada com sucesso.',
                notificacao: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao criar notificação:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao criar notificação.'
            });
        }
    }
);

app.get(
    '/api/notificacoes/minhas',
    autenticarToken,
    verificarPermissao('notificacoes', 'visualizar'),
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    id,
                    tipo,
                    prioridade,
                    titulo,
                    mensagem,
                    referencia_id,
                    referencia_tipo,
                    lida,
                    created_at,
                    lida_at
                FROM notificacoes
                WHERE usuario_id = $1
                ORDER BY
                    lida ASC,
                    created_at DESC
            `, [req.usuario.id]);

            res.json({
                sucesso: true,
                total: result.rows.length,
                nao_lidas: result.rows.filter(
                    notificacao => !notificacao.lida
                ).length,
                notificacoes: result.rows
            });

        } catch (error) {
            console.error(
                'Erro ao buscar notificações:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao buscar notificações.'
            });
        }
    }
);

app.patch(
    '/api/notificacoes/:id/lida',
    autenticarToken,
    verificarPermissao('notificacoes', 'editar'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const result = await pool.query(`
                UPDATE notificacoes
                SET
                    lida = TRUE,
                    lida_at = NOW()
                WHERE id = $1
                  AND usuario_id = $2
                RETURNING
                    id,
                    tipo,
                    prioridade,
                    titulo,
                    mensagem,
                    referencia_id,
                    referencia_tipo,
                    lida,
                    created_at,
                    lida_at
            `, [id, req.usuario.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem:
                        'Notificação não encontrada para este usuário.'
                });
            }

            res.json({
                sucesso: true,
                mensagem: 'Notificação marcada como lida.',
                notificacao: result.rows[0]
            });

        } catch (error) {
            console.error(
                'Erro ao marcar notificação como lida:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem:
                    'Erro interno ao marcar notificação como lida.'
            });
        }
    }
);

app.post(
    '/api/notificacoes/gerar',
    autenticarToken,
    verificarPermissao('notificacoes', 'criar'),
    async (req, res) => {
        try {
            let criadas = 0;

            // ==============================
            // ESTOQUE BAIXO / ZERADO
            // ==============================

            const estoqueResult = await pool.query(`
                SELECT
                    id,
                    nome,
                    estoque_atual,
                    estoque_minimo
                FROM produtos
                WHERE ativo = TRUE
                  AND estoque_atual <= estoque_minimo
            `);

            for (const produto of estoqueResult.rows) {

                const tipo =
                    Number(produto.estoque_atual) <= 0
                        ? 'ESTOQUE_ZERADO'
                        : 'ESTOQUE_BAIXO';

                const prioridade =
                    Number(produto.estoque_atual) <= 0
                        ? 'ALTA'
                        : 'MEDIA';

                const titulo =
                    Number(produto.estoque_atual) <= 0
                        ? 'Produto sem estoque'
                        : 'Estoque baixo';

                const mensagem =
                    Number(produto.estoque_atual) <= 0
                        ? `O produto ${produto.nome} está sem estoque.`
                        : `O produto ${produto.nome} está com estoque baixo.`;

                const existente = await pool.query(`
                    SELECT id
                    FROM notificacoes
                    WHERE usuario_id = $1
                      AND tipo = $2
                      AND referencia_id = $3
                      AND referencia_tipo = 'PRODUTO'
                      AND lida = FALSE
                    LIMIT 1
                `, [
                    req.usuario.id,
                    tipo,
                    produto.id
                ]);

                if (existente.rows.length === 0) {
                    await pool.query(`
                        INSERT INTO notificacoes (
                            usuario_id,
                            tipo,
                            prioridade,
                            titulo,
                            mensagem,
                            referencia_id,
                            referencia_tipo
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, 'PRODUTO')
                    `, [
                        req.usuario.id,
                        tipo,
                        prioridade,
                        titulo,
                        mensagem,
                        produto.id
                    ]);

                    criadas++;
                }
            }

            // ==============================
            // VACINAS PRÓXIMAS
            // ==============================

            const vacinasResult = await pool.query(`
                SELECT
                    av.id,
                    av.pet_id,
                    pets.nome AS pet_nome,
                    vacinas.nome AS vacina_nome,
                    av.proxima_dose
                FROM aplicacoes_vacinas av
                INNER JOIN pets
                    ON pets.id = av.pet_id
                INNER JOIN vacinas
                    ON vacinas.id = av.vacina_id
                WHERE av.ativo = TRUE
                  AND av.proxima_dose IS NOT NULL
                  AND av.proxima_dose
                      BETWEEN CURRENT_DATE
                      AND CURRENT_DATE + INTERVAL '30 days'
            `);

            for (const vacina of vacinasResult.rows) {

                const existente = await pool.query(`
                    SELECT id
                    FROM notificacoes
                    WHERE usuario_id = $1
                      AND tipo = 'VACINA_PROXIMA'
                      AND referencia_id = $2
                      AND referencia_tipo = 'APLICACAO_VACINA'
                      AND lida = FALSE
                    LIMIT 1
                `, [
                    req.usuario.id,
                    vacina.id
                ]);

                if (existente.rows.length === 0) {
                    await pool.query(`
                        INSERT INTO notificacoes (
                            usuario_id,
                            tipo,
                            prioridade,
                            titulo,
                            mensagem,
                            referencia_id,
                            referencia_tipo
                        )
                        VALUES (
                            $1,
                            'VACINA_PROXIMA',
                            'MEDIA',
                            'Vacina próxima',
                            $2,
                            $3,
                            'APLICACAO_VACINA'
                        )
                    `, [
                        req.usuario.id,
                        `A vacina ${vacina.vacina_nome} do pet ${vacina.pet_nome} está próxima da próxima dose.`,
                        vacina.id
                    ]);

                    criadas++;
                }
            }

            // ==============================
            // CONSULTAS PRÓXIMAS
            // ==============================

            const consultasResult = await pool.query(`
                SELECT
                    c.id,
                    pets.nome AS pet_nome,
                    clientes.nome AS cliente_nome,
                    c.data_consulta,
                    c.horario
                FROM consultas c
                INNER JOIN pets
                    ON pets.id = c.pet_id
                INNER JOIN clientes
                    ON clientes.id = pets.cliente_id
                WHERE c.status IN ('AGENDADA', 'CONFIRMADA')
                  AND c.data_consulta
                      BETWEEN CURRENT_DATE
                      AND CURRENT_DATE + INTERVAL '7 days'
            `);

            for (const consulta of consultasResult.rows) {

                const existente = await pool.query(`
                    SELECT id
                    FROM notificacoes
                    WHERE usuario_id = $1
                      AND tipo = 'CONSULTA_PROXIMA'
                      AND referencia_id = $2
                      AND referencia_tipo = 'CONSULTA'
                      AND lida = FALSE
                    LIMIT 1
                `, [
                    req.usuario.id,
                    consulta.id
                ]);

                if (existente.rows.length === 0) {
                    await pool.query(`
                        INSERT INTO notificacoes (
                            usuario_id,
                            tipo,
                            prioridade,
                            titulo,
                            mensagem,
                            referencia_id,
                            referencia_tipo
                        )
                        VALUES (
                            $1,
                            'CONSULTA_PROXIMA',
                            'MEDIA',
                            'Consulta próxima',
                            $2,
                            $3,
                            'CONSULTA'
                        )
                    `, [
                        req.usuario.id,
                        `O pet ${consulta.pet_nome}, de ${consulta.cliente_nome}, possui uma consulta próxima.`,
                        consulta.id
                    ]);

                    criadas++;
                }
            }

            // ==============================
            // AGENDAMENTOS PRÓXIMOS
            // ==============================

            const agendamentosResult = await pool.query(`
                SELECT
                    a.id,
                    pets.nome AS pet_nome,
                    clientes.nome AS cliente_nome,
                    servicos.nome AS servico_nome,
                    a.data,
                    a.horario
                FROM agendamentos a
                INNER JOIN pets
                    ON pets.id = a.pet_id
                INNER JOIN clientes
                    ON clientes.id = pets.cliente_id
                INNER JOIN servicos
                    ON servicos.id = a.servico_id
                WHERE a.status IN ('AGENDADO', 'CONFIRMADO')
                  AND a.data
                      BETWEEN CURRENT_DATE
                      AND CURRENT_DATE + INTERVAL '7 days'
            `);

            for (const agendamento of agendamentosResult.rows) {

                const existente = await pool.query(`
                    SELECT id
                    FROM notificacoes
                    WHERE usuario_id = $1
                      AND tipo = 'AGENDAMENTO_PROXIMO'
                      AND referencia_id = $2
                      AND referencia_tipo = 'AGENDAMENTO'
                      AND lida = FALSE
                    LIMIT 1
                `, [
                    req.usuario.id,
                    agendamento.id
                ]);

                if (existente.rows.length === 0) {
                    await pool.query(`
                        INSERT INTO notificacoes (
                            usuario_id,
                            tipo,
                            prioridade,
                            titulo,
                            mensagem,
                            referencia_id,
                            referencia_tipo
                        )
                        VALUES (
                            $1,
                            'AGENDAMENTO_PROXIMO',
                            'MEDIA',
                            'Agendamento próximo',
                            $2,
                            $3,
                            'AGENDAMENTO'
                        )
                    `, [
                        req.usuario.id,
                        `O pet ${agendamento.pet_nome}, de ${agendamento.cliente_nome}, possui um agendamento próximo para ${agendamento.servico_nome}.`,
                        agendamento.id
                    ]);

                    criadas++;
                }
            }

            res.json({
                sucesso: true,
                mensagem: 'Notificações verificadas e geradas com sucesso.',
                notificacoes_criadas: criadas
            });

        } catch (error) {
            console.error(
                'Erro ao gerar notificações:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem:
                    'Erro interno ao gerar notificações.'
            });
        }
    }
);

app.patch(
    '/api/notificacoes/marcar-todas-lidas',
    autenticarToken,
    verificarPermissao('notificacoes', 'editar'),
    async (req, res) => {
        try {
            const result = await pool.query(`
                UPDATE notificacoes
                SET
                    lida = TRUE,
                    lida_at = NOW()
                WHERE usuario_id = $1
                  AND lida = FALSE
                RETURNING id
            `, [req.usuario.id]);

            res.json({
                sucesso: true,
                mensagem: 'Todas as notificações foram marcadas como lidas.',
                notificacoes_atualizadas: result.rows.length
            });

        } catch (error) {
            console.error(
                'Erro ao marcar todas as notificações como lidas:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem:
                    'Erro interno ao marcar notificações como lidas.'
            });
        }
    }
);



app.delete(
    '/api/notificacoes/lidas',
    autenticarToken,
    verificarPermissao('notificacoes', 'excluir'),
    async (req, res) => {
        try {
            const result = await pool.query(`
                DELETE FROM notificacoes
                WHERE usuario_id = $1
                  AND lida = TRUE
                RETURNING id
            `, [req.usuario.id]);

            res.json({
                sucesso: true,
                mensagem:
                    'Notificações lidas foram excluídas com sucesso.',
                notificacoes_excluidas: result.rows.length
            });

        } catch (error) {
            console.error(
                'Erro ao excluir notificações lidas:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem:
                    'Erro interno ao excluir notificações lidas.'
            });
        }
    }
);

app.delete(
    '/api/notificacoes/:id',
    autenticarToken,
    verificarPermissao('notificacoes', 'excluir'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const result = await pool.query(`
                DELETE FROM notificacoes
                WHERE id = $1
                  AND usuario_id = $2
                RETURNING id
            `, [id, req.usuario.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Notificação não encontrada.'
                });
            }

            res.json({
                sucesso: true,
                mensagem: 'Notificação excluída com sucesso.',
                notificacao_id: result.rows[0].id
            });

        } catch (error) {
            console.error(
                'Erro ao excluir notificação:',
                error
            );

            res.status(500).json({
                sucesso: false,
                mensagem:
                    'Erro interno ao excluir notificação.'
            });
        }
    }
);

app.get(
    '/api/permissoes/teste-usuarios',
    autenticarToken,
    verificarPermissao('usuarios', 'visualizar'),
    async (req, res) => {
        res.json({
            sucesso: true,
            mensagem: 'Permissão de visualização de usuários autorizada.',
            perfil: req.usuario.perfil
        });
    }
);
