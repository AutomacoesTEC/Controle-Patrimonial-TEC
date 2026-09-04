# Rodada 55 — Painel anual de IRRF

## Falha e previsão

O Dashboard mostra parcelas soltas de IRRF dentro do demonstrativo, mas não há
painel por fonte, beneficiário e tipo, nem confronto entre o crédito detalhado
e `impostoPagoTotal` do resumo. A inspeção encontra painel=false, zero linhas e
totais nulos.

Previsão: o mesmo perfil passa a produzir linhas consolidadas por fonte,
beneficiário e tipo, separando `compõe o ajuste` de retenções informativas. No
arquivo `.DBK` externo de PAULO ROBERTO, o total que compõe o ajuste deve ser
idêntico ao `impostoPagoTotal` oficial, diferença R$ 0,00. Num fixture com R$ 1
a menos, a divergência deve ser exatamente -R$ 1,00 e gerar ressalva.

Arquivo real externo `../15533646604-IRPF-A-2026-2025-ORIGI.DBK` e fixture
sintético mínimo, sem seeds, modelo Codex baseado em GPT-5 (identificador exato
não exposto), commit-base `8d990ec`; saídas `antes.txt`/`depois.txt`. Camada
causal única: observação/conferência consolidada do IRRF já existente no estado.

## Decisão

**MANTER.** O `.DBK` externo produziu duas linhas e fechou R$ 774,78 contra
R$ 774,78, diferença zero. O fixture adversarial marcou exatamente -R$ 1,00.
No navegador, o painel exibiu 16 linhas, as cinco colunas previstas, os dois
tratamentos e nenhum overflow. A AJU-01 sintética mostra ressalva porque seu
resumo contém créditos deliberadamente sem detalhe por fonte, comportamento
correto e visível. Evidência bruta em `antes.txt`/`depois.txt`.

Verificações finais: regressão com 50 arquivos e 903 testes aprovados; build
de produção aprovado com 666 módulos transformados; fixture Chromium aprovado.
