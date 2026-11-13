# MFC — My Finance Control
## Aula 04 — Software funcional + testes no terminal

Sistema acadêmico de controle financeiro pessoal para a disciplina de Testes de Software. Implementa oito requisitos funcionais e três regras de negócio consolidadas. Esta entrega corresponde ao projeto de testes descrito no chat.

## Como usar

- **Visão geral:** escolha o mês para ver receitas, despesas, saldo, gastos por categoria e situação do orçamento.
- **Lançamentos:** cadastre receitas e despesas, filtre por intervalo/tipo/categoria, edite ou exclua com confirmação.
- **Orçamento mensal:** escolha o mês e salve o limite. O sistema informa situação, percentual utilizado e valor disponível ou excedido.
- Digite valores como `1500,50` ou `1500.50`, sem separador de milhar.
- Datas futuras não são aceitas. O tipo de um lançamento existente não é editável; para corrigir o tipo, exclua e cadastre novamente.
- O resumo do período considera todos os lançamentos do intervalo, mesmo quando a listagem está filtrada por tipo ou categoria.
- Ultrapassar o orçamento gera um alerta, sem impedir novos registros.