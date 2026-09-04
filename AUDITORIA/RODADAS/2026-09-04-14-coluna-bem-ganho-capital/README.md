# Rodada 14 — coluna Bem legível na apuração de ganho de capital

## 1. Falha nomeada

Na tabela “Apuração do Ganho de Capital”, a coluna Bem fica estreita e seu
identificador quebra em até quatro linhas, enquanto as duas colunas de data
ocupam espaço além do necessário para `dd/mm/aaaa`.

Trajetória: importar AJU-01, abrir Ganhos de Capital em 1366x768 e 1280x720,
nos dois temas, e medir as larguras de cabeçalhos e as linhas ocupadas pelo
texto principal do primeiro bem.

## 2. Previsão escrita antes da mudança

- O texto principal do primeiro bem ocupará no máximo duas linhas nas quatro
  combinações de tamanho e tema.
- A coluna Bem terá pelo menos 240 px; Aquisição e Alienação terão no máximo
  120 px cada.
- As cinco colunas monetárias continuarão integralmente visíveis, sem mudança
  em textos, valores ou cálculos.

## 3. Tarefa congelada

- Fixture: `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`
- Tela: Ganhos de Capital; tabela Apuração do Ganho de Capital
- Viewports: 1366x768 e 1280x720; temas escuro e claro
- Seeds: não aplicável; trajetória determinística
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `eb42996d0a221fdf1fba1c49a03ab724db3f386d`
- Medidor: `medir-coluna-bem.py`; saídas: `antes.json` e `depois.json`

## 4. Camada causal

Somente larguras iniciais das colunas Bem, Aquisição e Alienação nessa tabela.
Posicionamento fixo das colunas monetárias, dados e cálculos ficam fora.

## 5. Decisão

**REVERTER.** Aplicar `width: 260px` ao cabeçalho Bem não mudou a largura
computada: o componente mede a tabela e depois congela cada coluna com regras
dinâmicas mais específicas. Antes e depois permaneceram idênticos: Bem com
104 px e quatro linhas, datas com 104 px, overflow de 119/205 px e cinco
colunas monetárias visíveis.

A declaração tentativa foi removida. O produto voltou integralmente ao
commit-base; ficam apenas o fixture e as saídas brutas `antes.json` e
`depois.json`. Uma nova rodada deverá fornecer a largura inicial pelo
contrato do próprio `TabelaRedimensionavel`, sem empilhar outra causa aqui.
