# Rodada 13 — grade adaptativa de quatro cards

## 1. Falha nomeada

O baseline da rodada 12 mostrou que grades com quatro cards ficam em `3+1`
somente quando sua largura comporta três, mas não quatro colunas mínimas. Isso
ocorre nas quatro combinações do Relatório e nas duas de Rendimentos em
1280x720. Rendimentos em 1366x768 já cabe em `[4]` e não deve mudar.

Trajetória: importar AJU-01, abrir as duas grades em 1366x768 e 1280x720, nos
temas claro e escuro, e agrupar seus quatro filhos pela coordenada vertical.

## 2. Previsão escrita antes da mudança

- As seis combinações hoje em `3+1` passarão para `2+2`.
- As duas combinações de Rendimentos em 1366x768 permanecerão em `[4]`.
- As oito grades continuarão sem overflow horizontal, com quantidade, ordem,
  texto e valores exatamente iguais.

## 3. Tarefa congelada

- Fixture: `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`
- Grades: resumo de Rendimentos e Resumo da Declaração Importada do Relatório
- Viewports: 1366x768 e 1280x720; temas escuro e claro
- Seeds: não aplicável; trajetória determinística
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `8692d81a8c35740ae5b8cc6698f3a0c29ed97eff`
- Medidor congelado: `medir-grade.py`, que executa sem alteração o medidor da
  rodada 12; saídas: `antes.json` e `depois.json`

## 4. Camada causal

Somente a distribuição responsiva das duas grades explicitamente marcadas.
Conteúdo, paleta, dimensões mínimas e demais grades ficam fora.

## 5. Decisão

**MANTER.** As seis combinações que estavam em `3+1` passaram para
`2+2`. As duas combinações de Rendimentos em 1366x768 permaneceram em
`[4]`. As oito grades mantiveram zero overflow, quatro filhos e exatamente
os mesmos textos na mesma ordem.

A regra consulta a largura real do contêiner: atua somente entre 752 px
(mínimo para três colunas) e 1007 px (um pixel antes de caberem quatro), e
somente quando há exatamente quatro filhos. Evidência bruta pareada:
`antes.json` e `depois.json`.

Verificações de regressão:

- `npm run build`: aprovado.
- `npm test`: 37 arquivos e 872 testes aprovados.
