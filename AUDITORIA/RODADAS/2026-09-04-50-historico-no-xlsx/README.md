# Rodada 50 — Histórico junto ao relatório XLSX

## Falha e previsão

Ao exportar o Relatório IRPF com um bem e uma alteração de dois campos, o
arquivo gerado contém somente a aba `Relatório IRPF 2025`; a trajetória de
auditoria fica separada do artefato entregue.

Previsão: o mesmo fixture passa de uma para duas abas. A nova aba
`Histórico de Alterações` terá duas linhas, uma por campo, preservando data,
ano-calendário, descrição, campo, valor anterior e valor novo.

Fixture `verificar-historico-xlsx.test.js`, dados e relógio explícitos, sem
seeds, modelo Codex baseado em GPT-5 (identificador exato não exposto),
commit-base `452096c`; saídas `antes.txt`/`depois.txt`. Camada causal única:
ferramenta de exportação do Relatório IRPF.

## Decisão

**MANTER.** O mesmo fixture passou de uma para duas abas. A aba nova contém
exatamente as duas linhas previstas e preserva `Apto` no valor anterior e
`120` no valor novo. Evidência bruta em `antes.txt`/`depois.txt`.

Verificações finais: fixture direcionado aprovado; regressão com 44 arquivos e
893 testes aprovados; build de produção aprovado com 663 módulos transformados.
