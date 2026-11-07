import {
  fimDe,
  hojeIso,
  horariosLivres,
  ocupaHorario,
  paraHora,
  paraMinutos,
  sobrepoe,
} from '@barbertime/dominio';
import { formatarTelefone, somenteDigitos } from '@barbertime/ui-utils';
import { ErroDeNegocio } from './erros.js';
import { criarDadosDeExemplo } from './exemplo.js';

/**
 * Camada de dados do app. Mesma forma que a API HTTP terá: funções assíncronas
 * por recurso, que devolvem cópias e recusam regras de negócio com ErroDeNegocio.
 * Hoje usa memória (dados de exemplo); depois, só esta implementação muda.
 */
export function criarApi({ agora = () => new Date() } = {}) {
  let banco = criarDadosDeExemplo(hojeIso(agora()));
  const copia = (v) => structuredClone(v);
  const proximoId = (lista) => Math.max(0, ...lista.map((i) => i.id)) + 1;
  const hoje = () => hojeIso(agora());
  const horaAgora = () =>
    paraHora(agora().getHours() * 60 + agora().getMinutes());

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

  const api = {
    /** Só para testes e para o botão "restaurar exemplo". */
    reiniciar() {
      banco = criarDadosDeExemplo(hoje());
    },

    barbearia: {
      async obterPorSlug(slug) {
        if (banco.barbearia.slug !== slug)
          throw new ErroDeNegocio('Barbearia não encontrada.');
        return copia(banco.barbearia);
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

    barbeiros: {
      async listar() {
        return copia(banco.barbeiros);
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
      async obter(id) {
        const cliente = buscar('clientes', id, 'Cliente');
        return copia({ ...cliente, ...resumoDoCliente(cliente.id) });
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

/** Instância única do app. */
export const api = criarApi();
