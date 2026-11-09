import {
  resumoDeComandas,
  creditosDaComanda,
  motivoParaUsarCashback,
  motivoParaUsarPremio,
  FIDELIDADE_PADRAO,
  cicloDaRenovacao,
  podeUsarPacote,
  saldoDeFidelidade,
  saldoDoPacote,
  validarConfigFidelidade,
  validarPacote,
  vigenciaDoPacote,
  diferencaDeCaixa,
  fimDe,
  motivoParaNaoReceber,
  resumoDoCaixa,
  totalDaComanda,
  hojeIso,
  horariosLivres,
  ocupaHorario,
  paraHora,
  paraMinutos,
  sobrepoe,
  janelaDoAgendamentoOnline,
  mesclarConfigBarbearia,
  TIPOS_DE_PRODUTO,
  UNIDADES,
  arredondarQuantidade,
  sugestaoDeCompra,
  baixasDaComanda,
  ajusteDeInventario,
  totalDaCompra,
  motivoParcelasInvalidas,
  documentoValido,
} from '@barbertime/dominio';
import { formatarTelefone, somenteDigitos } from '@barbertime/ui-utils';
import { ErroDeNegocio } from './erros.js';
import { criarDadosDeExemplo } from './exemplo.js';
import { criarApiHttp } from './apiHttp.js';

/**
 * Camada de dados do app. Mesma forma que a API HTTP terá: funções assíncronas
 * por recurso, que devolvem cópias e recusam regras de negócio com ErroDeNegocio.
 * Hoje usa memória (dados de exemplo); depois, só esta implementação muda.
 */
export function criarApi({ agora = () => new Date() } = {}) {
  let banco = criarDadosDeExemplo(hojeIso(agora()));
  const copia = (v) => structuredClone(v);
  /** Módulos ativos da barbearia (vêm da sessão; ADR 0011). */
  let modulosAtivos = [];
  const proximoId = (lista) => Math.max(0, ...lista.map((i) => i.id)) + 1;
  const hoje = () => hojeIso(agora());
  const horaAgora = () =>
    paraHora(agora().getHours() * 60 + agora().getMinutes());

  const saldoFidelidade = (clienteId) =>
    saldoDeFidelidade(
      banco.extratoFidelidade.filter((m) => m.clienteId === Number(clienteId)),
      banco.fidelidade ?? FIDELIDADE_PADRAO,
      hoje(),
    );

  const buscar = (lista, id, rotulo) => {
    const item = banco[lista].find((i) => i.id === Number(id));
    if (!item) throw new ErroDeNegocio(`${rotulo} não encontrado.`);
    return item;
  };

  const futurosCom = (campo, id) =>
    banco.agendamentos.filter(
      (a) =>
        a[campo] === id &&
        a.data >= hoje() &&
        ocupaHorario(a.estado) &&
        a.estado !== 'bloqueado',
    );

  const negarSeEmUso = (campo, id, nome) => {
    const n = futurosCom(campo, id).length;
    if (n) {
      throw new ErroDeNegocio(
        `Não é possível excluir "${nome}": há ${n} agendamento${n > 1 ? 's' : ''} futuro${n > 1 ? 's' : ''}. Cancele ou remarque antes.`,
      );
    }
  };

  const completar = (a) => ({
    ...a,
    clienteNome:
      banco.clientes.find((c) => c.id === a.clienteId)?.nome ?? a.motivo ?? '',
    servicoNome: banco.servicos.find((s) => s.id === a.servicoId)?.nome ?? '',
    barbeiroNome:
      banco.barbeiros.find((b) => b.id === a.barbeiroId)?.nome ?? '',
  });

  const ocupadosDoDia = (data, barbeiroId, ignorarId) =>
    banco.agendamentos.filter(
      (a) =>
        a.data === data &&
        a.barbeiroId === barbeiroId &&
        a.id !== ignorarId &&
        ocupaHorario(a.estado),
    );

  function validarHorario({ data, inicio, fim, barbeiroId }) {
    const barbeiro = buscar('barbeiros', barbeiroId, 'Barbeiro');
    if (
      paraMinutos(inicio) < paraMinutos(barbeiro.inicio) ||
      paraMinutos(fim) > paraMinutos(barbeiro.fim)
    ) {
      throw new ErroDeNegocio(
        `${barbeiro.nome} atende das ${barbeiro.inicio} às ${barbeiro.fim}. Escolha um horário dentro do expediente.`,
      );
    }
    if (
      ocupadosDoDia(data, barbeiro.id).some((o) => sobrepoe({ inicio, fim }, o))
    ) {
      throw new ErroDeNegocio(
        'Esse horário acabou de ser ocupado. Escolha outro.',
      );
    }
  }

  function resumoDoCliente(clienteId) {
    const passados = banco.agendamentos
      .filter(
        (a) =>
          a.clienteId === clienteId &&
          (a.estado === 'atendido' || a.estado === 'faltou'),
      )
      .sort((a, b) => (a.data < b.data ? 1 : -1));
    return {
      atendimentos: passados.filter((a) => a.estado === 'atendido').length,
      faltas: passados.filter((a) => a.estado === 'faltou').length,
      ultimaVisita: passados.find((a) => a.estado === 'atendido')?.data ?? null,
    };
  }

  const caixaDoDia = (data = hoje()) =>
    banco.caixas.find((c) => c.data === data) ?? null;
  const comandasDoCaixa = (caixaId) =>
    banco.comandas.filter((c) => c.caixaId === caixaId);

  function exigirCaixaAberto() {
    const caixa = caixaDoDia();
    if (!caixa?.aberto)
      throw new ErroDeNegocio('Abra o caixa de hoje antes de lançar comandas.');
    return caixa;
  }

  /** Comandas de um cliente, com a data do caixa em que foram lançadas. */
  const comandasDoCliente = (clienteId) =>
    banco.comandas
      .filter((c) => c.clienteId === clienteId)
      .map((c) => ({
        ...c,
        data: banco.caixas.find((x) => x.id === c.caixaId)?.data ?? null,
      }));

  const completarComanda = (c) => ({
    ...c,
    clienteNome:
      banco.clientes.find((x) => x.id === c.clienteId)?.nome ??
      'Cliente avulso',
    barbeiroNome:
      banco.barbeiros.find((b) => b.id === c.barbeiroId)?.nome ?? '',
    ...totalDaComanda(c),
  });

  function normalizarItens(itens = [], barbeiroId) {
    return itens.map((i) => {
      const quantidade = Math.max(1, Math.round(Number(i.quantidade) || 1));
      const barbeiro = Number(i.barbeiroId ?? barbeiroId);
      if (i.tipo === 'pacote') {
        const pacote = buscar('pacotes', i.refId, 'Pacote');
        return {
          tipo: 'pacote',
          refId: pacote.id,
          nome: i.nome ?? `Pacote: ${pacote.nome}`,
          preco: Number(i.preco ?? pacote.preco),
          quantidade: 1,
          barbeiroId: barbeiro,
        };
      }
      const lista = i.tipo === 'produto' ? 'produtos' : 'servicos';
      const ref = buscar(
        lista,
        i.refId,
        i.tipo === 'produto' ? 'Produto' : 'Serviço',
      );
      // Serviço usado por pacote: sai por R$ 0 e fica ligado à assinatura (planejamento 0015).
      if (i.tipo !== 'produto' && i.assinaturaId) {
        return {
          tipo: 'servico',
          refId: ref.id,
          nome: i.nome ?? `${ref.nome} (pacote)`,
          preco: 0,
          quantidade: 1,
          barbeiroId: barbeiro,
          assinaturaId: Number(i.assinaturaId),
        };
      }
      // Guarda nome e preço do momento da venda (base da comissão futura).
      return {
        tipo: i.tipo === 'produto' ? 'produto' : 'servico',
        refId: ref.id,
        nome: i.nome ?? ref.nome,
        preco: Number(i.preco ?? ref.preco),
        quantidade,
        barbeiroId: barbeiro,
      };
    });
  }

  const pacoteDa = (assinatura) =>
    buscar('pacotes', assinatura.pacoteId, 'Pacote');

  /** Confere cada uso de pacote da comanda, somando os usos da própria comanda. */
  function validarUsosDePacote(itens, clienteId) {
    const pendentes = new Map();
    for (const item of itens.filter((i) => i.assinaturaId)) {
      const assinatura = buscar(
        'assinaturas',
        item.assinaturaId,
        'Pacote do cliente',
      );
      if (assinatura.clienteId !== clienteId) {
        throw new ErroDeNegocio('Esse pacote é de outro cliente.');
      }
      if (assinatura.estado !== 'ativa') {
        throw new ErroDeNegocio(
          'Esse pacote ainda não foi pago ou foi cancelado.',
        );
      }
      const ja = pendentes.get(assinatura.id) ?? [];
      const r = podeUsarPacote({
        pacote: pacoteDa(assinatura),
        assinatura: { ...assinatura, usos: [...assinatura.usos, ...ja] },
        servicoId: item.refId,
        data: hoje(),
      });
      if (!r.ok) throw new ErroDeNegocio(r.motivo);
      pendentes.set(assinatura.id, [
        ...ja,
        { servicoId: item.refId, data: hoje() },
      ]);
    }
  }

  function completarAssinatura(a) {
    const pacote = pacoteDa(a);
    // Renovação pedida ou paga deste ciclo (planejamento 0034, etapa B).
    const renovacao = banco.assinaturas.find(
      (x) => x.renovacaoDe === a.id && x.estado !== 'cancelada',
    );
    return {
      ...a,
      renovacao: renovacao?.estado ?? null,
      pacote,
      saldo: a.inicio ? saldoDoPacote(pacote, a) : [],
      vigente: a.estado === 'ativa' && a.inicio <= hoje() && hoje() <= a.fim,
      aComecar: a.estado === 'ativa' && a.inicio > hoje(),
      renovaEm:
        a.estado === 'ativa' && pacote.tipo === 'recorrente' && a.fim >= hoje()
          ? cicloDaRenovacao(pacote, a, hoje()).inicio
          : null,
    };
  }

  /** Movimento de estoque: grava e muda o saldo junto (planejamento 0027). */
  function movimentar({
    produtoId,
    tipo,
    quantidade,
    custoUnitario = null,
    motivo = '',
    comandaId = null,
    compraId = null,
  }) {
    const qtd = arredondarQuantidade(quantidade);
    const p = buscar('produtos', produtoId, 'Produto');
    if (!qtd) return p;
    banco.movimentosEstoque.push({
      id: proximoId(banco.movimentosEstoque),
      produtoId: p.id,
      tipo,
      quantidade: qtd,
      custoUnitario,
      motivo,
      comandaId,
      compraId,
      criadoEm: agora().toISOString(),
      usuarioNome: '',
    });
    p.saldo = arredondarQuantidade(Number(p.saldo ?? 0) + qtd);
    return p;
  }

  function completarCompra(cp) {
    const f = banco.fornecedores.find((x) => x.id === cp.fornecedorId);
    return {
      ...cp,
      fornecedorNome: f?.nome ?? '',
      itens: cp.itens.map((i) => {
        const p = banco.produtos.find((x) => x.id === i.produtoId);
        return { ...i, nome: p?.nome ?? '', unidade: p?.unidade ?? 'un' };
      }),
      parcelas: cp.parcelas,
    };
  }

  const api = {
    /** Só para testes e para o botão "restaurar exemplo". */
    reiniciar() {
      banco = criarDadosDeExemplo(hoje());
    },

    /** A sessão informa os módulos ativos (fidelidade só credita com o módulo ativo). */
    definirModulosAtivos(lista = []) {
      modulosAtivos = [...lista];
    },

    barbearia: {
      async obterPorSlug(slug) {
        if (banco.barbearia.slug !== slug)
          throw new ErroDeNegocio('Barbearia não encontrada.');
        return copia(banco.barbearia);
      },
    },

    /**
     * Página pública (planejamento 0019): a mesma forma da API /api/publico.
     * Aqui só existe a barbearia de exemplo e o código do link é ignorado.
     */
    publico: {
      async carregar(slug) {
        if (banco.barbearia.slug !== slug)
          throw new ErroDeNegocio('Barbearia não encontrada.');
        const config = mesclarConfigBarbearia(banco.barbearia.configuracoes);
        return copia({
          barbearia: {
            nome: banco.barbearia.nome,
            slug,
            contato: config.contato,
            funcionamento: config.funcionamento,
            agendamento: config.agendamento,
          },
          servicos: banco.servicos,
          barbeiros: banco.barbeiros.map(({ id, nome, inicio, fim }) => ({
            id,
            nome,
            inicio,
            fim,
          })),
          hoje: hoje(),
        });
      },
      async horarios(slug, _codigo, { data, barbeiroId, servicoId }) {
        await api.publico.carregar(slug);
        const barbeiro = buscar('barbeiros', barbeiroId, 'Barbeiro');
        const servico = buscar('servicos', servicoId, 'Serviço');
        const janela = janelaDoAgendamentoOnline({
          config: banco.barbearia.configuracoes,
          barbeiro,
          data,
          agora: { data: hoje(), hora: horaAgora() },
        });
        if (!janela) return [];
        return horariosLivres({
          expediente: janela,
          duracao: servico.duracao,
          ocupados: ocupadosDoDia(data, barbeiro.id),
          aPartirDe: janela.aPartirDe,
        });
      },
      async reconhecer(slug, _codigo, telefone) {
        await api.publico.carregar(slug);
        return api.clientes.reconhecer(telefone);
      },
      async agendar(slug, _codigo, dados) {
        await api.publico.carregar(slug);
        const r = await api.agendamentos.criar(dados);
        return {
          id: r.id,
          data: r.data,
          inicio: r.inicio,
          fim: r.fim,
          servicoNome: r.servicoNome,
          barbeiroNome: r.barbeiroNome,
          // Como a API: o nome digitado, nunca o do cadastro.
          primeiroNome:
            String(dados.cliente?.nome ?? '')
              .trim()
              .split(/\s+/)[0] || null,
        };
      },
    },

    servicos: {
      async listar() {
        return copia(banco.servicos);
      },
      /** Quantos agendamentos futuros usam o serviço (para advertir antes de mudar). */
      async contarFuturos(id) {
        return futurosCom('servicoId', Number(id)).length;
      },
      async salvar(dados) {
        const nome = String(dados.nome ?? '').trim();
        if (!nome) throw new ErroDeNegocio('Informe o nome do serviço.');
        if (!(dados.duracao > 0))
          throw new ErroDeNegocio('A duração precisa ser maior que zero.');
        if (!(dados.preco >= 0))
          throw new ErroDeNegocio('Informe o preço do serviço.');
        const repetido = banco.servicos.find(
          (s) =>
            s.nome.toLowerCase() === nome.toLowerCase() && s.id !== dados.id,
        );
        if (repetido)
          throw new ErroDeNegocio(
            `Já existe um serviço chamado "${repetido.nome}".`,
          );
        const registro = {
          id: dados.id,
          nome,
          duracao: Number(dados.duracao),
          preco: Number(dados.preco),
        };
        if (dados.id)
          Object.assign(buscar('servicos', dados.id, 'Serviço'), registro);
        else
          banco.servicos.push({ ...registro, id: proximoId(banco.servicos) });
        return copia(registro.id ? registro : banco.servicos.at(-1));
      },
      async excluir(id) {
        const servico = buscar('servicos', id, 'Serviço');
        negarSeEmUso('servicoId', servico.id, servico.nome);
        banco.servicos = banco.servicos.filter((s) => s.id !== servico.id);
      },
    },

    produtos: {
      async listar() {
        return copia(banco.produtos).sort((a, b) =>
          a.nome.localeCompare(b.nome, 'pt-BR'),
        );
      },
      async salvar(dados) {
        const nome = String(dados.nome ?? '').trim();
        if (!nome) throw new ErroDeNegocio('Informe o nome do produto.');
        // Planejamento 0027: consumível não tem preço nem comissão.
        const tipo = dados.tipo ?? 'revenda';
        if (!TIPOS_DE_PRODUTO.includes(tipo))
          throw new ErroDeNegocio(
            'Escolha se o produto é de revenda ou consumível.',
          );
        const revenda = tipo === 'revenda';
        if (revenda && !(dados.preco > 0))
          throw new ErroDeNegocio('Informe o preço de venda do produto.');
        const unidade = dados.unidade ?? 'un';
        if (!UNIDADES.includes(unidade))
          throw new ErroDeNegocio('Unidade inválida.');
        const estoqueMinimo = arredondarQuantidade(dados.estoqueMinimo ?? 0);
        if (!(estoqueMinimo >= 0))
          throw new ErroDeNegocio('O estoque mínimo não pode ser negativo.');
        const comissao = revenda ? Number(dados.comissao ?? 0) : 0;
        if (!(comissao >= 0 && comissao <= 100)) {
          throw new ErroDeNegocio('A comissão precisa estar entre 0% e 100%.');
        }
        const repetido = banco.produtos.find(
          (p) =>
            p.nome.toLowerCase() === nome.toLowerCase() && p.id !== dados.id,
        );
        if (repetido)
          throw new ErroDeNegocio(
            `Já existe um produto chamado "${repetido.nome}".`,
          );
        const registro = {
          nome,
          preco: revenda ? Number(dados.preco) : null,
          comissao,
          tipo,
          unidade,
          estoqueMinimo,
        };
        let salvo;
        if (dados.id)
          salvo = Object.assign(
            buscar('produtos', dados.id, 'Produto'),
            registro,
          );
        else
          banco.produtos.push(
            (salvo = {
              ...registro,
              id: proximoId(banco.produtos),
              ultimoCusto: null,
              saldo: 0,
            }),
          );
        return copia(salvo);
      },
      async excluir(id) {
        const produto = buscar('produtos', id, 'Produto');
        banco.produtos = banco.produtos.filter((p) => p.id !== produto.id);
      },
    },

    barbeiros: {
      async listar() {
        return copia(banco.barbeiros);
      },
      /** Dados de exemplo não têm contas de usuário. */
      async contas() {
        return [];
      },
      async salvar(dados) {
        const nome = String(dados.nome ?? '').trim();
        if (!nome) throw new ErroDeNegocio('Informe o nome do barbeiro.');
        if (
          !dados.inicio ||
          !dados.fim ||
          paraMinutos(dados.inicio) >= paraMinutos(dados.fim)
        ) {
          throw new ErroDeNegocio(
            'O fim do expediente precisa ser depois do início.',
          );
        }
        const comissao = Number(dados.comissao);
        if (!(comissao >= 0 && comissao <= 100)) {
          throw new ErroDeNegocio('A comissão precisa estar entre 0% e 100%.');
        }
        const registro = {
          id: dados.id,
          nome,
          inicio: dados.inicio,
          fim: dados.fim,
          comissao,
          usuarioId: dados.usuarioId ?? null,
        };
        if (dados.id)
          Object.assign(buscar('barbeiros', dados.id, 'Barbeiro'), registro);
        else
          banco.barbeiros.push({ ...registro, id: proximoId(banco.barbeiros) });
        return copia(registro.id ? registro : banco.barbeiros.at(-1));
      },
      async excluir(id) {
        const barbeiro = buscar('barbeiros', id, 'Barbeiro');
        negarSeEmUso('barbeiroId', barbeiro.id, barbeiro.nome);
        banco.barbeiros = banco.barbeiros.filter((b) => b.id !== barbeiro.id);
        banco.agendamentos = banco.agendamentos.filter(
          (a) => !(a.barbeiroId === barbeiro.id && a.estado === 'bloqueado'),
        );
      },
    },

    clientes: {
      /** busca: parte do nome ou dos dígitos do telefone. */
      async listar({ busca = '' } = {}) {
        const termo = busca.trim().toLowerCase();
        const digitos = somenteDigitos(busca);
        return banco.clientes
          .filter(
            (c) =>
              !termo ||
              c.nome.toLowerCase().includes(termo) ||
              (digitos && c.telefone.includes(digitos)),
          )
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
          .map((c) => copia({ ...c, ...resumoDoCliente(c.id) }));
      },
      /**
       * Consulta pública (página de agendamento): só diz se o telefone já é
       * cliente e devolve o PRIMEIRO nome, para a saudação. Nada além (LGPD).
       */
      async reconhecer(telefone) {
        const digitos = somenteDigitos(telefone);
        const c = banco.clientes.find((x) => x.telefone === digitos);
        return c ? { primeiroNome: c.nome.split(' ')[0] } : null;
      },
      async obter(id) {
        const cliente = buscar('clientes', id, 'Cliente');
        return copia({ ...cliente, ...resumoDoCliente(cliente.id) });
      },
      /** Resumo das comandas pagas do cliente (planejamento 0016). */
      async resumo(id) {
        const cliente = buscar('clientes', id, 'Cliente');
        const r = resumoDeComandas(comandasDoCliente(cliente.id));
        return copia({
          ...r,
          faltas: resumoDoCliente(cliente.id).faltas,
          ultimoServico: r.ultimoServico && {
            ...r.ultimoServico,
            barbeiroNome:
              banco.barbeiros.find((b) => b.id === r.ultimoServico.barbeiroId)
                ?.nome ?? '',
          },
        });
      },
      /** Comandas do cliente, mais recentes primeiro, em páginas ("Ver mais"). */
      async comandas(id, { limite = 5, deslocamento = 0 } = {}) {
        const cliente = buscar('clientes', id, 'Cliente');
        const todas = comandasDoCliente(cliente.id)
          .filter((c) => c.estado !== 'cancelada')
          .sort((a, b) =>
            `${a.data} ${a.hora}` < `${b.data} ${b.hora}` ? 1 : -1,
          );
        return {
          total: todas.length,
          itens: todas
            .slice(deslocamento, deslocamento + limite)
            .map((c) => copia(completarComanda(c))),
        };
      },
      async historico(id) {
        const cliente = buscar('clientes', id, 'Cliente');
        return banco.agendamentos
          .filter((a) => a.clienteId === cliente.id)
          .sort((a, b) => (a.data + a.inicio < b.data + b.inicio ? 1 : -1))
          .map((a) => copia(completar(a)));
      },
      async salvar(dados) {
        const nome = String(dados.nome ?? '').trim();
        const telefone = somenteDigitos(dados.telefone);
        if (!nome) throw new ErroDeNegocio('Informe o nome do cliente.');
        if (!telefone)
          throw new ErroDeNegocio('Informe o telefone do cliente.');
        const dono = banco.clientes.find(
          (c) => c.telefone === telefone && c.id !== dados.id,
        );
        if (dono) {
          throw new ErroDeNegocio(
            `O telefone ${formatarTelefone(telefone)} já está no cadastro de ${dono.nome}.`,
          );
        }
        const registro = {
          nome,
          telefone,
          cpf: somenteDigitos(dados.cpf) || null,
          observacoes: String(dados.observacoes ?? '').trim(),
        };
        let salvo;
        if (dados.id)
          salvo = Object.assign(
            buscar('clientes', dados.id, 'Cliente'),
            registro,
          );
        else
          banco.clientes.push(
            (salvo = { ...registro, id: proximoId(banco.clientes) }),
          );
        return copia(salvo);
      },
      async excluir(id) {
        const cliente = buscar('clientes', id, 'Cliente');
        negarSeEmUso('clienteId', cliente.id, cliente.nome);
        banco.clientes = banco.clientes.filter((c) => c.id !== cliente.id);
      },
    },

    caixa: {
      /** Caixa do dia com o resumo por forma de pagamento, ou null se não foi aberto. */
      async obterDoDia() {
        const caixa = caixaDoDia();
        if (!caixa) return null;
        const resumo = resumoDoCaixa({
          valorInicial: caixa.valorInicial,
          comandas: comandasDoCaixa(caixa.id),
        });
        return copia({ ...caixa, resumo });
      },
      async abrir({ valorInicial }) {
        const atual = caixaDoDia();
        if (atual?.aberto)
          throw new ErroDeNegocio('O caixa de hoje já está aberto.');
        if (atual)
          throw new ErroDeNegocio(
            'O caixa de hoje já foi fechado. Ele reabre amanhã.',
          );
        if (!(Number(valorInicial) >= 0))
          throw new ErroDeNegocio('Informe o troco inicial (pode ser zero).');
        const caixa = {
          id: proximoId(banco.caixas),
          data: hoje(),
          valorInicial: Number(valorInicial),
          aberto: true,
          abertoAs: horaAgora(),
        };
        banco.caixas.push(caixa);
        return api.caixa.obterDoDia();
      },
      async fechar({ dinheiroContado }) {
        const caixa = exigirCaixaAberto();
        const resumo = resumoDoCaixa({
          valorInicial: caixa.valorInicial,
          comandas: comandasDoCaixa(caixa.id),
        });
        if (resumo.abertas) {
          throw new ErroDeNegocio(
            `Há ${resumo.abertas} comanda${resumo.abertas > 1 ? 's' : ''} em aberto. Receba ou cancele antes de fechar o caixa.`,
          );
        }
        if (!(Number(dinheiroContado) >= 0))
          throw new ErroDeNegocio('Informe quanto dinheiro há na gaveta.');
        Object.assign(caixa, {
          aberto: false,
          fechadoAs: horaAgora(),
          dinheiroContado: Number(dinheiroContado),
          diferenca: diferencaDeCaixa(dinheiroContado, resumo.dinheiroEsperado),
        });
        return copia({ ...caixa, resumo });
      },
    },

    comandas: {
      async listarDoDia() {
        const caixa = caixaDoDia();
        if (!caixa) return [];
        return comandasDoCaixa(caixa.id)
          .slice()
          .sort((a, b) => (a.hora < b.hora ? 1 : -1))
          .map((c) => copia(completarComanda(c)));
      },
      async obter(id) {
        return copia(completarComanda(buscar('comandas', id, 'Comanda')));
      },
      /** Cria ou atualiza uma comanda aberta. */
      async salvar(dados) {
        const caixa = exigirCaixaAberto();
        if (!dados.barbeiroId)
          throw new ErroDeNegocio('Escolha o barbeiro da comanda.');
        const barbeiro = buscar('barbeiros', dados.barbeiroId, 'Barbeiro');
        // O item do prêmio é montado aqui, nunca vem de quem chama (planejamento 0034).
        const itens = normalizarItens(
          (dados.itens ?? []).filter((i) => !i.premio),
          barbeiro.id,
        );
        validarUsosDePacote(
          itens,
          dados.clienteId ? Number(dados.clienteId) : null,
        );
        const desconto = Number(dados.desconto || 0);
        if (desconto < 0 || desconto > totalDaComanda({ itens }).subtotal) {
          throw new ErroDeNegocio(
            'O desconto não pode ser maior que o valor da comanda.',
          );
        }
        const clienteId = dados.clienteId
          ? buscar('clientes', dados.clienteId, 'Cliente').id
          : null;
        const premioFidelidade = Boolean(dados.premioFidelidade);
        const cashbackUsado = Number(dados.cashbackUsado || 0);
        if (premioFidelidade || cashbackUsado) {
          if (!modulosAtivos.includes('fidelidade'))
            throw new ErroDeNegocio(
              'O módulo Fidelidade não está ativo nesta barbearia.',
            );
          const config = banco.fidelidade ?? FIDELIDADE_PADRAO;
          const saldo = clienteId ? saldoFidelidade(clienteId) : null;
          if (premioFidelidade) {
            const motivo = motivoParaUsarPremio({ config, saldo, clienteId });
            if (motivo) throw new ErroDeNegocio(motivo);
            const s = buscar(
              'servicos',
              config.selos.premioServicoId,
              'Serviço do prêmio',
            );
            itens.push({
              tipo: 'servico',
              refId: s.id,
              nome: s.nome,
              preco: 0,
              quantidade: 1,
              barbeiroId: barbeiro.id,
              premio: true,
            });
          }
          const motivo = motivoParaUsarCashback({
            valor: cashbackUsado,
            saldo,
            comanda: { clienteId, itens, desconto },
          });
          if (motivo) throw new ErroDeNegocio(motivo);
        }
        const registro = {
          clienteId,
          barbeiroId: barbeiro.id,
          itens,
          desconto,
          forma: dados.forma ?? null,
          premioFidelidade,
          cashbackUsado,
        };
        let salva;
        if (dados.id) {
          salva = buscar('comandas', dados.id, 'Comanda');
          if (salva.estado !== 'aberta')
            throw new ErroDeNegocio('Só dá para alterar comanda em aberto.');
          Object.assign(salva, registro);
        } else {
          salva = {
            ...registro,
            id: proximoId(banco.comandas),
            caixaId: caixa.id,
            hora: horaAgora(),
            agendamentoId: dados.agendamentoId ?? null,
            estado: 'aberta',
          };
          banco.comandas.push(salva);
        }
        return copia(completarComanda(salva));
      },
      async receber(id, { forma } = {}) {
        exigirCaixaAberto();
        const comanda = buscar('comandas', id, 'Comanda');
        if (comanda.estado !== 'aberta')
          throw new ErroDeNegocio('Essa comanda já foi encerrada.');
        const motivo = motivoParaNaoReceber({
          ...comanda,
          forma: forma ?? comanda.forma,
        });
        if (motivo) throw new ErroDeNegocio(motivo);
        validarUsosDePacote(comanda.itens, comanda.clienteId);
        Object.assign(comanda, {
          forma: forma ?? comanda.forma,
          estado: 'paga',
          pagaAs: horaAgora(),
        });
        // Pacotes: registra os usos e ativa o pacote vendido nesta comanda.
        for (const item of comanda.itens) {
          if (item.assinaturaId) {
            buscar(
              'assinaturas',
              item.assinaturaId,
              'Pacote do cliente',
            ).usos.push({
              servicoId: item.refId,
              data: hoje(),
              comandaId: comanda.id,
            });
          }
        }
        for (const a of banco.assinaturas.filter(
          (x) => x.comandaVendaId === comanda.id,
        )) {
          const anterior = banco.assinaturas.find(
            (x) => x.id === a.renovacaoDe,
          );
          Object.assign(a, {
            estado: 'ativa',
            ...(anterior
              ? cicloDaRenovacao(pacoteDa(a), anterior, hoje())
              : vigenciaDoPacote(pacoteDa(a), hoje())),
          });
        }
        // Estoque (planejamento 0027): revenda e fichas técnicas, com o módulo ativo.
        if (modulosAtivos.includes('estoque')) {
          const produtos = new Map(banco.produtos.map((p) => [p.id, p]));
          for (const b of baixasDaComanda({
            itens: comanda.itens,
            fichas: banco.fichas,
            produtos,
          }))
            movimentar({ ...b, comandaId: comanda.id });
        }
        // Fidelidade: gastos do resgate, depois selo e cashback (só com o módulo
        // ativo e cliente identificado).
        let creditos = [];
        if (comanda.premioFidelidade || comanda.cashbackUsado) {
          const config = banco.fidelidade ?? FIDELIDADE_PADRAO;
          const saldo = saldoFidelidade(comanda.clienteId);
          const motivo =
            (comanda.premioFidelidade &&
              motivoParaUsarPremio({
                config,
                saldo,
                clienteId: comanda.clienteId,
              })) ||
            motivoParaUsarCashback({
              valor: comanda.cashbackUsado,
              saldo,
              comanda,
            });
          if (motivo) throw new ErroDeNegocio(motivo);
          if (comanda.premioFidelidade)
            banco.extratoFidelidade.push({
              clienteId: comanda.clienteId,
              tipo: 'resgate_selos',
              valor: config.selos.necessarios,
              data: hoje(),
              expiraEm: null,
            });
          if (comanda.cashbackUsado)
            banco.extratoFidelidade.push({
              clienteId: comanda.clienteId,
              tipo: 'uso_cashback',
              valor: comanda.cashbackUsado,
              data: hoje(),
              expiraEm: null,
            });
        }
        if (modulosAtivos.includes('fidelidade')) {
          creditos = creditosDaComanda(
            comanda,
            banco.fidelidade,
            hoje(),
          ).movimentos.map((m) => ({
            ...m,
            clienteId: comanda.clienteId,
          }));
          banco.extratoFidelidade.push(...creditos);
        }
        return copia({ ...completarComanda(comanda), creditos });
      },
      async cancelar(id) {
        const comanda = buscar('comandas', id, 'Comanda');
        if (comanda.estado === 'paga') {
          throw new ErroDeNegocio(
            'Comanda já recebida não pode ser cancelada.',
          );
        }
        comanda.estado = 'cancelada';
        for (const a of banco.assinaturas.filter(
          (x) => x.comandaVendaId === comanda.id,
        )) {
          a.estado = 'cancelada';
        }
        return copia(completarComanda(comanda));
      },
      /** Abre (ou reabre a existente) a comanda de um agendamento, com cliente, barbeiro e serviço. */
      async abrirDoAgendamento(agendamentoId) {
        const ag = buscar('agendamentos', agendamentoId, 'Agendamento');
        const existente = banco.comandas.find(
          (c) => c.agendamentoId === ag.id && c.estado !== 'cancelada',
        );
        if (existente) return copia(completarComanda(existente));
        if (!['confirmado', 'atendido'].includes(ag.estado)) {
          throw new ErroDeNegocio(
            'Só dá para abrir comanda de agendamento confirmado ou atendido.',
          );
        }
        return api.comandas.salvar({
          clienteId: ag.clienteId,
          barbeiroId: ag.barbeiroId,
          agendamentoId: ag.id,
          itens: ag.servicoId ? [{ tipo: 'servico', refId: ag.servicoId }] : [],
        });
      },
    },

    estoque: {
      async obter() {
        const produtos = copia(banco.produtos).sort((a, b) =>
          a.nome.localeCompare(b.nome, 'pt-BR'),
        );
        return { produtos, comprar: sugestaoDeCompra(produtos) };
      },
      async movimentos({ produtoId, limite = 50 } = {}) {
        return copia(
          banco.movimentosEstoque
            .filter((m) => !produtoId || m.produtoId === Number(produtoId))
            .map((m) => {
              const p = banco.produtos.find((x) => x.id === m.produtoId);
              return { ...m, produtoNome: p?.nome ?? '', unidade: p?.unidade };
            })
            .reverse()
            .slice(0, Math.min(200, limite)),
        );
      },
      async consumir({ produtoId, quantidade, motivo } = {}) {
        if (!produtoId) throw new ErroDeNegocio('Escolha o produto.');
        const qtd = arredondarQuantidade(quantidade);
        if (!(qtd > 0))
          throw new ErroDeNegocio('A quantidade precisa ser maior que zero.');
        if (!String(motivo ?? '').trim())
          throw new ErroDeNegocio('Informe o motivo do consumo.');
        return copia(
          movimentar({
            produtoId,
            tipo: 'consumo_manual',
            quantidade: -qtd,
            motivo: String(motivo).trim(),
          }),
        );
      },
      async inventario(itens = []) {
        if (!itens.length)
          throw new ErroDeNegocio('Informe a contagem de ao menos um produto.');
        if (itens.some((i) => i.contado === '' || !(Number(i.contado) >= 0)))
          throw new ErroDeNegocio(
            'A quantidade contada não pode ser negativa.',
          );
        const ajustes = [];
        for (const i of itens) {
          const p = buscar('produtos', i.produtoId, 'Produto');
          const diferenca = ajusteDeInventario(p.saldo, i.contado);
          if (diferenca === null) continue;
          const anterior = p.saldo;
          movimentar({
            produtoId: p.id,
            tipo: 'ajuste_inventario',
            quantidade: diferenca,
            motivo: 'Inventário',
          });
          ajustes.push({
            produtoId: p.id,
            nome: p.nome,
            anterior,
            contado: arredondarQuantidade(i.contado),
            diferenca,
          });
        }
        return copia({ ajustes });
      },
    },

    fichas: {
      async obter(servicoId) {
        buscar('servicos', servicoId, 'Serviço');
        return copia(
          banco.fichas
            .filter((f) => f.servicoId === Number(servicoId))
            .map((f) => {
              const p = banco.produtos.find((x) => x.id === f.produtoId);
              return {
                produtoId: f.produtoId,
                nome: p?.nome ?? 'Produto excluído',
                unidade: p?.unidade ?? 'un',
                quantidade: f.quantidade,
                valido: p?.tipo === 'consumivel',
              };
            }),
        );
      },
      async salvar(servicoId, itens = []) {
        const servico = buscar('servicos', servicoId, 'Serviço');
        const ids = new Set();
        for (const i of itens) {
          if (!i.produtoId)
            throw new ErroDeNegocio('Escolha o produto de cada linha.');
          if (!(arredondarQuantidade(i.quantidade) > 0))
            throw new ErroDeNegocio(
              'A quantidade de cada produto precisa ser maior que zero.',
            );
          if (ids.has(Number(i.produtoId)))
            throw new ErroDeNegocio(
              'Cada produto aparece uma vez só na ficha.',
            );
          ids.add(Number(i.produtoId));
          const p = banco.produtos.find((x) => x.id === Number(i.produtoId));
          if (p?.tipo !== 'consumivel')
            throw new ErroDeNegocio(
              'A ficha técnica só aceita produtos consumíveis ativos.',
            );
        }
        banco.fichas = [
          ...banco.fichas.filter((f) => f.servicoId !== servico.id),
          ...itens.map((i) => ({
            servicoId: servico.id,
            produtoId: Number(i.produtoId),
            quantidade: arredondarQuantidade(i.quantidade),
          })),
        ];
        return api.fichas.obter(servico.id);
      },
    },

    fornecedores: {
      async listar() {
        return copia(banco.fornecedores).sort((a, b) =>
          a.nome.localeCompare(b.nome, 'pt-BR'),
        );
      },
      async salvar(dados) {
        const nome = String(dados.nome ?? '').trim();
        if (!nome) throw new ErroDeNegocio('Informe o nome do fornecedor.');
        const documento = somenteDigitos(dados.documento ?? '');
        if (!documentoValido(documento))
          throw new ErroDeNegocio('CPF ou CNPJ inválido.');
        const registro = {
          nome,
          documento: documento || null,
          telefone: somenteDigitos(dados.telefone ?? '') || null,
          observacoes: String(dados.observacoes ?? '').trim(),
        };
        let salvo;
        if (dados.id)
          salvo = Object.assign(
            buscar('fornecedores', dados.id, 'Fornecedor'),
            registro,
          );
        else
          banco.fornecedores.push(
            (salvo = { ...registro, id: proximoId(banco.fornecedores) }),
          );
        return copia(salvo);
      },
      async excluir(id) {
        const f = buscar('fornecedores', id, 'Fornecedor');
        banco.fornecedores = banco.fornecedores.filter((x) => x.id !== f.id);
      },
    },

    compras: {
      async listar() {
        return copia(
          banco.compras
            .map((cp) => ({
              id: cp.id,
              data: cp.data,
              fornecedorId: cp.fornecedorId,
              fornecedorNome:
                banco.fornecedores.find((f) => f.id === cp.fornecedorId)
                  ?.nome ?? '',
              total: cp.total,
              cancelada: cp.cancelada,
              parcelas: cp.parcelas.length,
              quitadas: cp.parcelas.filter((p) => p.situacao === 'quitada')
                .length,
            }))
            .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id),
        );
      },
      async obter(id) {
        return copia(completarCompra(buscar('compras', id, 'Compra')));
      },
      async registrar(dados) {
        const fornecedor = banco.fornecedores.find(
          (f) => f.id === Number(dados.fornecedorId),
        );
        if (!fornecedor)
          throw new ErroDeNegocio('Escolha o fornecedor da compra.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dados.data ?? '')))
          throw new ErroDeNegocio('Informe a data da compra.');
        const itens = (dados.itens ?? []).map((i) => ({
          produtoId: Number(i.produtoId),
          quantidade: arredondarQuantidade(i.quantidade),
          custoUnitario: Math.round(Number(i.custoUnitario) * 100) / 100,
        }));
        if (!itens.length)
          throw new ErroDeNegocio('Inclua ao menos um produto na compra.');
        if (
          itens.some(
            (i) =>
              !i.produtoId || !(i.quantidade > 0) || !(i.custoUnitario >= 0),
          )
        )
          throw new ErroDeNegocio(
            'Cada item precisa de produto, quantidade e custo.',
          );
        itens.forEach((i) => buscar('produtos', i.produtoId, 'Produto'));
        const frete = Number(dados.frete || 0);
        const desconto = Number(dados.desconto || 0);
        const { total, motivo } = totalDaCompra({ itens, frete, desconto });
        if (motivo) throw new ErroDeNegocio(motivo);
        const parcelas = (dados.parcelas ?? []).map((p) => ({
          valor: Math.round(Number(p.valor) * 100) / 100,
          vencimento: String(p.vencimento ?? ''),
        }));
        if (total > 0) {
          const m = motivoParcelasInvalidas(parcelas, total);
          if (m) throw new ErroDeNegocio(m);
        }
        const compra = {
          id: proximoId(banco.compras),
          fornecedorId: fornecedor.id,
          data: dados.data,
          frete,
          desconto,
          total,
          observacao: String(dados.observacao ?? ''),
          cancelada: false,
          itens,
          parcelas:
            total > 0
              ? parcelas.map((p, n) => ({
                  id: n + 1,
                  parcela: n + 1,
                  parcelas: parcelas.length,
                  valor: p.valor,
                  vencimento: p.vencimento,
                  situacao: 'aberta',
                  pagoEm: null,
                }))
              : [],
        };
        for (const i of itens) {
          movimentar({
            produtoId: i.produtoId,
            tipo: 'compra',
            quantidade: i.quantidade,
            custoUnitario: i.custoUnitario,
            compraId: compra.id,
          });
          buscar('produtos', i.produtoId, 'Produto').ultimoCusto =
            i.custoUnitario;
        }
        banco.compras.push(compra);
        return copia(completarCompra(compra));
      },
      async cancelar(id) {
        const compra = buscar('compras', id, 'Compra');
        if (compra.cancelada)
          throw new ErroDeNegocio('Essa compra já foi cancelada.');
        if (compra.parcelas.some((p) => p.situacao === 'quitada'))
          throw new ErroDeNegocio(
            'Essa compra já tem parcela paga. Estorne o pagamento antes de cancelar.',
          );
        for (const i of compra.itens)
          movimentar({
            produtoId: i.produtoId,
            tipo: 'estorno_compra',
            quantidade: -i.quantidade,
            custoUnitario: i.custoUnitario,
            compraId: compra.id,
          });
        compra.parcelas.forEach((p) => {
          if (p.situacao === 'aberta') p.situacao = 'cancelada';
        });
        compra.cancelada = true;
        return copia(completarCompra(compra));
      },
    },

    fidelidade: {
      async obterConfig() {
        return copia(banco.fidelidade ?? FIDELIDADE_PADRAO);
      },
      async salvarConfig(config) {
        const motivo = validarConfigFidelidade(config);
        if (motivo) throw new ErroDeNegocio(motivo);
        if (config.selos?.ativo)
          buscar('servicos', config.selos.premioServicoId, 'Serviço de prêmio');
        banco.fidelidade = copia(config);
        return copia(banco.fidelidade);
      },
      async saldo(clienteId) {
        const movimentos = banco.extratoFidelidade.filter(
          (m) => m.clienteId === Number(clienteId),
        );
        return saldoDeFidelidade(
          movimentos,
          banco.fidelidade ?? FIDELIDADE_PADRAO,
          hoje(),
        );
      },
      async extrato(clienteId) {
        return copia(
          banco.extratoFidelidade
            .filter((m) => m.clienteId === Number(clienteId))
            .sort((a, b) => (a.data < b.data ? 1 : -1)),
        );
      },
    },

    pacotes: {
      async listar() {
        return copia(banco.pacotes);
      },
      async salvar(dados) {
        const itens = (dados.itens ?? []).map((i) => ({
          servicoId: Number(i.servicoId) || null,
          servicoNome: banco.servicos.find((x) => x.id === Number(i.servicoId))
            ?.nome,
          quantidade:
            i.quantidade == null || i.quantidade === ''
              ? null
              : Number(i.quantidade),
        }));
        const pacote = {
          id: dados.id,
          nome: String(dados.nome ?? '').trim(),
          preco: Number(dados.preco),
          tipo: dados.tipo,
          validadeDias:
            dados.tipo === 'unico' ? Number(dados.validadeDias) : null,
          itens,
          limites: {
            intervaloMinimoDias: dados.limites?.intervaloMinimoDias
              ? Number(dados.limites.intervaloMinimoDias)
              : null,
            maximoPorSemana: dados.limites?.maximoPorSemana
              ? Number(dados.limites.maximoPorSemana)
              : null,
          },
        };
        const motivo = validarPacote(pacote);
        if (motivo) throw new ErroDeNegocio(motivo);
        const repetido = banco.pacotes.find(
          (p) =>
            p.nome.toLowerCase() === pacote.nome.toLowerCase() &&
            p.id !== dados.id,
        );
        if (repetido)
          throw new ErroDeNegocio(
            `Já existe um pacote chamado "${repetido.nome}".`,
          );
        if (dados.id)
          Object.assign(buscar('pacotes', dados.id, 'Pacote'), pacote);
        else banco.pacotes.push({ ...pacote, id: proximoId(banco.pacotes) });
        return copia(dados.id ? pacote : banco.pacotes.at(-1));
      },
      async excluir(id) {
        const pacote = buscar('pacotes', id, 'Pacote');
        const vendidos = banco.assinaturas.filter(
          (a) =>
            a.pacoteId === pacote.id &&
            a.estado !== 'cancelada' &&
            (!a.fim || a.fim >= hoje()),
        ).length;
        if (vendidos) {
          throw new ErroDeNegocio(
            `Não é possível excluir "${pacote.nome}": ${vendidos} cliente(s) com o pacote em vigor.`,
          );
        }
        banco.pacotes = banco.pacotes.filter((p) => p.id !== pacote.id);
      },
    },

    assinaturas: {
      /** Pacotes do cliente com saldo por serviço e se estão em vigor hoje. */
      async doCliente(clienteId) {
        return banco.assinaturas
          .filter(
            (a) =>
              a.clienteId === Number(clienteId) && a.estado !== 'cancelada',
          )
          .map((a) => copia(completarAssinatura(a)));
      },
      /**
       * Vende um pacote: abre uma comanda com o item "Pacote: <nome>" para receber
       * no caixa; o pacote passa a valer quando a comanda é paga.
       */
      async vender({ clienteId, pacoteId, barbeiroId }) {
        const cliente = buscar('clientes', clienteId, 'Cliente');
        const pacote = buscar('pacotes', pacoteId, 'Pacote');
        const comanda = await api.comandas.salvar({
          clienteId: cliente.id,
          barbeiroId,
          itens: [{ tipo: 'pacote', refId: pacote.id }],
        });
        const assinatura = {
          id: proximoId(banco.assinaturas),
          clienteId: cliente.id,
          pacoteId: pacote.id,
          estado: 'aguardando_pagamento',
          comandaVendaId: comanda.id,
          inicio: null,
          fim: null,
          usos: [],
        };
        banco.assinaturas.push(assinatura);
        return {
          assinatura: copia(completarAssinatura(assinatura)),
          comandaId: comanda.id,
        };
      },
      /** Renova o pacote mensal: nova assinatura ligada à anterior, paga no caixa. */
      async renovar(id, { barbeiroId } = {}) {
        const anterior = buscar('assinaturas', id, 'Pacote do cliente');
        const pacote = pacoteDa(anterior);
        if (anterior.estado !== 'ativa')
          throw new ErroDeNegocio('Só dá para renovar um pacote já pago.');
        if (pacote.tipo !== 'recorrente')
          throw new ErroDeNegocio(
            'Só o pacote mensal é renovado. Venda o pacote de novo ao cliente.',
          );
        const pendente = banco.assinaturas.find(
          (x) => x.renovacaoDe === anterior.id && x.estado !== 'cancelada',
        );
        if (pendente)
          throw new ErroDeNegocio(
            pendente.estado === 'ativa'
              ? 'Este ciclo já foi renovado.'
              : 'Já existe uma renovação aguardando pagamento no caixa.',
          );
        const comanda = await api.comandas.salvar({
          clienteId: anterior.clienteId,
          barbeiroId,
          itens: [{ tipo: 'pacote', refId: pacote.id }],
        });
        const assinatura = {
          id: proximoId(banco.assinaturas),
          clienteId: anterior.clienteId,
          pacoteId: pacote.id,
          estado: 'aguardando_pagamento',
          comandaVendaId: comanda.id,
          renovacaoDe: anterior.id,
          inicio: null,
          fim: null,
          usos: [],
        };
        banco.assinaturas.push(assinatura);
        return {
          assinatura: copia(completarAssinatura(assinatura)),
          comandaId: comanda.id,
        };
      },
      /** Pré-checagem para a tela: pode usar este pacote neste serviço hoje? */
      async podeUsar({ assinaturaId, servicoId, jaNaComanda = [] }) {
        const a = buscar('assinaturas', assinaturaId, 'Pacote do cliente');
        if (a.estado !== 'ativa')
          return {
            ok: false,
            motivo: 'Esse pacote ainda não foi pago ou foi cancelado.',
          };
        return podeUsarPacote({
          pacote: pacoteDa(a),
          assinatura: {
            ...a,
            usos: [
              ...a.usos,
              ...jaNaComanda.map((sid) => ({ servicoId: sid, data: hoje() })),
            ],
          },
          servicoId: Number(servicoId),
          data: hoje(),
        });
      },
    },

    agendamentos: {
      async listarDoDia(data) {
        return banco.agendamentos
          .filter((a) => a.data === data && a.estado !== 'cancelado')
          .sort((a, b) => paraMinutos(a.inicio) - paraMinutos(b.inicio))
          .map((a) => copia(completar(a)));
      },
      async obter(id) {
        const a = buscar('agendamentos', id, 'Agendamento');
        const cliente = banco.clientes.find((c) => c.id === a.clienteId);
        return copia({
          ...completar(a),
          clienteTelefone: cliente?.telefone ?? null,
          clienteObservacoes: cliente?.observacoes ?? '',
        });
      },
      async horariosLivres({ data, barbeiroId, servicoId }) {
        const barbeiro = buscar('barbeiros', barbeiroId, 'Barbeiro');
        const servico = buscar('servicos', servicoId, 'Serviço');
        if (data < hoje()) return [];
        return horariosLivres({
          expediente: barbeiro,
          duracao: servico.duracao,
          ocupados: ocupadosDoDia(data, barbeiro.id),
          aPartirDe: data === hoje() ? horaAgora() : undefined,
        });
      },
      /**
       * Cria um agendamento. Informe clienteId (balcão) ou cliente { nome, telefone }
       * (página pública: reaproveita o cadastro pelo telefone).
       */
      async criar({ data, inicio, barbeiroId, servicoId, clienteId, cliente }) {
        if (!data || !inicio)
          throw new ErroDeNegocio('Escolha o dia e o horário.');
        if (data < hoje())
          throw new ErroDeNegocio(
            'Não é possível agendar em um dia que já passou.',
          );
        const servico = buscar('servicos', servicoId, 'Serviço');
        const fim = fimDe(inicio, servico.duracao);
        validarHorario({ data, inicio, fim, barbeiroId: Number(barbeiroId) });

        let idCliente = clienteId
          ? buscar('clientes', clienteId, 'Cliente').id
          : null;
        if (!idCliente && cliente) {
          const telefone = somenteDigitos(cliente.telefone);
          const existente = banco.clientes.find((c) => c.telefone === telefone);
          idCliente = existente
            ? existente.id
            : (await api.clientes.salvar({ nome: cliente.nome, telefone })).id;
        }
        if (!idCliente) throw new ErroDeNegocio('Escolha o cliente.');

        const novo = {
          id: proximoId(banco.agendamentos),
          data,
          inicio,
          fim,
          barbeiroId: Number(barbeiroId),
          servicoId: servico.id,
          clienteId: idCliente,
          estado: 'pendente',
        };
        banco.agendamentos.push(novo);
        return copia(completar(novo));
      },
      async bloquear({ data, inicio, fim, barbeiroId, motivo }) {
        if (!inicio || !fim || paraMinutos(inicio) >= paraMinutos(fim)) {
          throw new ErroDeNegocio(
            'O fim do bloqueio precisa ser depois do início.',
          );
        }
        validarHorario({ data, inicio, fim, barbeiroId: Number(barbeiroId) });
        const novo = {
          id: proximoId(banco.agendamentos),
          data,
          inicio,
          fim,
          barbeiroId: Number(barbeiroId),
          servicoId: null,
          clienteId: null,
          estado: 'bloqueado',
          motivo: String(motivo ?? '').trim() || 'Bloqueado',
        };
        banco.agendamentos.push(novo);
        return copia(completar(novo));
      },
      /** pendente → confirmado → atendido | faltou; qualquer um (menos atendido) → cancelado. */
      async alterarEstado(id, estado) {
        const a = buscar('agendamentos', id, 'Agendamento');
        const permitidos = {
          pendente: ['confirmado', 'cancelado'],
          confirmado: ['atendido', 'faltou', 'cancelado'],
          bloqueado: ['cancelado'],
        };
        if (!permitidos[a.estado]?.includes(estado)) {
          throw new ErroDeNegocio(
            'Esse agendamento não pode mais mudar para esse estado.',
          );
        }
        a.estado = estado;
        return copia(completar(a));
      },
    },
  };
  return api;
}

/**
 * Instância única do app (planejamento 0019): API real em `pnpm dev` e produção;
 * dados de exemplo em memória nos testes do front e com VITE_DADOS=exemplo.
 */
const usarExemplo =
  import.meta.env.MODE === 'test' || import.meta.env.VITE_DADOS === 'exemplo';
export const api = usarExemplo ? criarApi() : criarApiHttp(criarApi());
