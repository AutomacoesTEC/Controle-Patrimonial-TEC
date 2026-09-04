# Rodada 23 — checklist assistido do Saldo de Caixa

## 1. Falha nomeada

Se 2024 apurou R$ 2.032,33 de imposto a restituir e 2025 não tem rendimento
isento de restituição (código 25), o Dashboard mostra somente o Saldo de
Caixa. A pessoa precisa lembrar sozinha de conferir se recebeu e deixou de
lançar essa origem de recursos.

Trajetória: executar `classificacaoSaldo.test.js` com dois anos e comparar a
lista de conferência gerada sem e com o rendimento isento correspondente.

## 2. Previsão escrita antes da mudança

- Sem o lançamento, surgirá uma pendência de restituição no valor exato de
  R$ 2.032,33, com destino Rendimentos.
- Com `isento_25` de R$ 2.032,33, essa pendência desaparecerá.
- As pendências já calculadas de alienação e aplicação entrarão no mesmo
  checklist, sem duplicar cálculos.
- O Saldo de Caixa permanecerá idêntico: o checklist apenas orienta.

## 3. Tarefa congelada

- Fixture: `src/store/classificacaoSaldo.test.js`
- Anos: 2024 e 2025
- Valor de restituição: R$ 2.032,33
- Seeds: não aplicável; objetos literais determinísticos
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `a557e81`
- Saídas brutas: `antes.txt` e `depois.txt`

## 4. Camada causal

Somente verificação assistida: produzir e exibir perguntas de conferência a
partir do estado. Nenhum dado ou total é corrigido automaticamente. A tolerância
configurável do selo "fecha" é outra camada e fica para a próxima rodada.

## 5. Decisão

**MANTER.** O fixture passou de módulo ausente para 3/3: a restituição de
R$ 2.032,33 aparece pelo valor exato e some quando o código 25 a cobre; dívida,
alienação e aplicação entram pela ordem prevista; `saldoDeCaixa` não é
alterado. No navegador, a linha exibiu R$ 2.032,33, levou a Rendimentos e não
criou overflow. Evidência bruta: `antes.txt` e `depois.txt`.

Os diagnósticos de alienação sem preço e aplicação sem rendimento deixaram as
notas dispersas e passaram ao checklist único. O aviso diferente de venda de
ano anterior foi preservado junto a Ganhos e Perdas. A tolerância configurável
não foi tocada.

## 6. Verificação

- Fixture puro: 3/3 testes aprovados.
- Navegador: 1 checklist, valor R$ 2.032,33, destino Rendimentos e 0 px de
  overflow horizontal.
- `npm test`: 41 arquivos e 885 testes aprovados.
- `npm run build`: aprovado.
