# Rodada 64 — Diretório correto na instalação simplificada

## Falha e previsão

O Inno Setup memorizou no registro, para o `AppId` do CP-TEC, o diretório de
uma instalação de teste em
`Desktop\session_3f3854a4-...\installer-build\test-install`. Ao executar a
versão simplificada, `DisableDirPage=yes` esconde a escolha, mas o padrão
`UsePreviousAppDir=yes` reutiliza silenciosamente aquele caminho. A instalação
nova voltou a criar/preencher a pasta `session_*` na Área de Trabalho.

Previsão: o contrato explícito `UsePreviousAppDir=no` sobe de 0/1 para 1/1 no
instalador simplificado. Mesmo com o registro inicialmente apontando para a
pasta `session_*`, instalar o novo pacote deve registrar
`%LOCALAPPDATA%\Programs\ControlePatrimonial`; uma segunda execução deve manter
esse local correto e não recriar a pasta temporária removida.

Fixture estática fixa em `verificar-diretorio.py`, sem seeds, modelo Codex
baseado em GPT-5 (identificador exato não exposto), commit-base `af7ac8d`.
Camada causal única: resolução do diretório pelo instalador simplificado.

## Decisão

**MANTER.** O contrato passou de 0/1 para 1/1. Com o Registro do Windows
apontando para a pasta `session_*`, o instalador recompilado registrou o local
correto em `%LOCALAPPDATA%\Programs\ControlePatrimonial`. Depois de remover o
resíduo antigo, uma nova instalação não recriou a pasta (`session_recriada=0`)
e o atalho da Área de Trabalho apontou para o executável correto. A suíte de
empacotamento passou 11/11. Evidência bruta em `antes.txt` e `depois.txt`.
