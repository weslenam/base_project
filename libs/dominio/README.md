# @barbertime/dominio

Regras de negócio puras, compartilhadas entre o app e a API (`scope:shared`). Sem framework, sem acesso a dados.

- `agenda.js`: horas (`paraMinutos`, `paraHora`, `fimDe`), sobreposição, horários livres, estados de agendamento e datas ISO.

```bash
pnpm nx test dominio
```
