# Identidade visual do BarberTime

> Fonte de verdade da marca (ADR 0003). Tokens em `tokens.json`, logos em `logos/`. Mudou aqui, muda no design system publicado e em `libs/ui-tokens`.

O BarberTime é o sistema da barbearia de bairro que virou negócio: agenda, fila, comanda e assinaturas num só lugar. A identidade é **industrial e urbana**: concreto, grafite e cobre, letras condensadas de placa de oficina, cantos vivos e informação organizada como um quadro de horários. Ela tem de funcionar no balcão, com pressa e no celular, sem enfeite.

## Princípios

- **Quadro de horários, não vitrine.** A agenda é a tela principal; tudo se organiza em grade, colunas e linhas finas (`linha`). Sem gradientes, sem ilustração decorativa.
- **Uma cor de marca, uma cor de alerta.** `cobre` é a marca e a ação principal; `ambar` é exclusivo da fila e da hora atual, o que precisa de atenção agora. O resto é neutro.
- **Letra forte para o que importa.** Títulos e números do dia em Big Shoulders maiúscula; o restante em Barlow, legível e discreta.
- **Canto vivo.** Raios pequenos (`raio-sm`, `raio-md`); pílula só em selos de status.
- **A barbearia em primeiro lugar.** Na página pública de agendamento, a marca do cliente vem na frente; o BarberTime assina pequeno no rodapé.

## Voz e textos

- Português do Brasil, direto, de balcão: "Confirmar horário", "Encaixar", "Marcar falta". Verbo no infinitivo nos botões.
- Tratamento por "você" com o cliente final; sem gírias forçadas e sem emoji na interface.
- Rótulos, títulos e botões em maiúsculas (a fonte faz isso pela classe; escreva o texto normal).
- Horários sempre em 24 h (`10:20`), datas curtas (`Sáb, 8/11`), dinheiro como `R$ 1.284,00`.
- Erros dizem o que houve e o que fazer: "Esse horário acabou de ser ocupado. Escolha outro abaixo."

## Cores

| Papel              | Tokens                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------- |
| Chão e superfícies | `concreto` (fundo), `placa` (cartões e campos), `placa-funda` (faixas e cabeçalhos)     |
| Texto              | `grafite` (principal), `grafite-suave` (secundário)                                     |
| Linhas             | `linha` (divisórias e grade), `linha-forte` (bordas de controles, 3:1)                  |
| Marca e ação       | `cobre`, `cobre-escuro` (hover), `cobre-suave` (seleção), `sobre-cobre` (texto em cima) |
| Fila e agora       | `ambar` com `sobre-ambar` por cima; nunca `ambar` como texto                            |
| Informação         | `aco` e `aco-suave` (pendente, assinante em listas)                                     |
| Estados            | `sucesso`/`sucesso-suave`, `perigo`/`perigo-suave`, sempre com palavra ou ícone junto   |
| Foco               | `foco`: anel sólido de 2px com 2px de afastamento                                       |

- Todo par de texto da tabela tem contraste mínimo de 4,5:1 nos dois temas; bordas de controle e foco, 3:1.
- Tema escuro é grafite (não preto puro); o cobre clareia e passa a receber texto `sobre-cobre` escuro.
- Sucesso (verde) e perigo (vermelho) diferem também em claridade e sempre vêm com texto; nunca use só a cor para separar estados.

## Tipografia

- **Big Shoulders** (`--font-display`), 800, maiúsculas: estilos `display`, `titulo`, `subtitulo`. Nasceu da sinalização urbana de Chicago e dá o tom de placa de oficina. Use em títulos de tela, nomes de coluna da agenda e números grandes; nunca em parágrafos.
- **Barlow** (`--font-sans`): estilos `corpo-lg`, `corpo`, `corpo-sm`, `rotulo`, `botao`. Inspirada em placas de estrada; toda a interface usa ela.
- **IBM Plex Mono** (`--font-mono`), 500: estilos `hora` e `valor`. Horários, preços, totais e comissões, com algarismos tabulares para alinhar em coluna.
- No produto, as fontes são servidas pelo próprio app (ADR 0003). Fallbacks: Barlow Condensed/Arial Narrow, Segoe UI/system-ui, Consolas/monospace.

## Espaço, raio e elevação

- Grade de 4px: `esp-1` 4 · `esp-2` 8 · `esp-3` 12 · `esp-4` 16 · `esp-6` 24 · `esp-8` 32 · `esp-12` 48. Margem lateral mínima de `esp-4` no celular.
- Raios: `raio-0` em faixas e grid, `raio-sm` em botões, campos e blocos, `raio-md` em cartões, `raio-pilula` só em selos.
- Uma única elevação, `sombra-placa`, para cartões e menus. O resto se separa por `linha`.
- Alvos de toque com no mínimo 44px de altura.

## Logo e iconografia

- Use os arquivos de `logos/`; o `logos/README.md` traz versões, tintas e regras. No tema claro, `barbertime-logo.svg`; no escuro, `barbertime-logo-negativo.svg`.
- Ícones de interface: Material Design Icons (`@mdi/js`, o mesmo pacote da lib de UI), estilo contornado, 20px na interface e 24px em navegação, na cor do texto ao lado.
- Fotos (barbeiros, cortes) entram cortadas em quadrado ou círculo, sem filtros; nunca como fundo atrás de texto.

## Componentes de referência

O design system publicado (link no ADR 0003) mostra `Botao`, `Selo`, `Horarios`, `BlocoAgenda` e as telas de exemplo `TelaAgenda` e `TelaAgendamentoCliente`. As classes de referência estão em `referencia-componentes.css` (`bt-*`), só como modelo visual. No código, esses padrões viram os componentes `Ds*` e os tokens de `libs/ui-tokens`, conforme a skill `design-system`: o nome de cada token aqui vira a variável CSS de mesmo nome.
