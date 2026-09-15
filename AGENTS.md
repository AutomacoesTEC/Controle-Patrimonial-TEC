# Controle Patrimonial — orientações do projeto

## Escopo e leitura

Este repositório contém o aplicativo React/Vite e a entrada desktop PyWebView (`main.py`, `desktop_api.py`). O diretório pai reúne material auxiliar e declarações; ele não é a raiz Git deste aplicativo.

Preserve alterações preexistentes e arquivos não versionados. Em operações que possam sobrescrever, excluir ou reprocessar artefatos, verifique o alvo e a autorização. Consulte apenas a documentação necessária à tarefa:

- Importação PDF/DBK: `src/pages/importParsers.js`, `src/irpf/`, testes correspondentes e documentos pertinentes em `AUDITORIA/`. Use `LAYOUT-DBK-OFICIAL.md` e o layout primário do diretório pai conforme o registro investigado.
- Conciliação e movimentações: `src/store/`, chamadas das telas e critérios documentados em `AUDITORIA/ESTUDO-VARIACAO-PATRIMONIAL-E-SALDOS-COMPENSAVEIS.md` quando aplicáveis.
- Interface: `DESIGN.md` e os componentes afetados. Desktop/empacotamento: `main.py`, `desktop_api.py` e testes correspondentes.
- Quando a tarefa recorrer a handoffs, `COMANDO-FABLE.md`, `RELATORIO-FABLE.md` ou ao briefing do diretório pai, consulte o trecho relevante e confronte-o com o código atual. Esses materiais são registros ou tarefas específicas; não constituem autorização permanente nem evidência atual de aprovação.

Instruções em `node_modules` pertencem às bibliotecas. Não promova suas habilidades a regras gerais do aplicativo nem edite dependências instaladas para ajustar o comportamento dos agentes. Uma atualização de dependência deve ser explícita, reproduzível e validada pelo fluxo do projeto.

## Dados e critérios de evidência

Ao lidar com dados do usuário, preserve entradas PDF/DBK/TXT, lançamentos manuais, histórico e arquivos de trabalho. Não regrave declarações originais nem transmita dados para serviços externos por iniciativa própria. Use dados sintéticos quando cobrirem o caso; se um teste precisar ler dados reais, verifique antes que o conjunto de amostras está autorizado.

Em importação e retificadora, verifique preservação de dados, identidade, duplicidade e conciliação. Ausência de um campo ou diferença aritmética não comprova venda, baixa ou quitação. Registre informação não suportada e mantenha a proveniência necessária ao reprocessamento.

Ao avaliar resultados fiscais, trate um teste verde como confirmação apenas do comportamento testado, não como prova de correção fiscal ou cobertura completa. Conclusões fiscais exigem fonte aplicável, vigência e evidência. Diferencie extração, integração às telas, cálculo e cobertura. Uma ressalva permanece pendente; não apresente aprovação parcial como aprovação integral.

## Validação proporcional

Para mudanças no código, execute os comandos pertinentes na raiz deste repositório:

- Alteração de lógica: `npm test -- <arquivo-de-teste>` com o caminho real dos testes afetados. Amplie quando a mudança cruzar importação, estado ou cálculo.
- Alteração que afete o aplicativo ou sua integração: `npm run build` e testes pertinentes.
- Declaração de cobertura integral de importação: `npm run test:full` (define `IRPF_FIXTURES_REQUIRED=1`), com `IRPF_FIXTURES_DIR` apontando para o conjunto autorizado e os PDFs sintéticos requeridos em `output/pdf/`. Confira falhas e testes ignorados. Fixtures ausentes são impedimento dessa validação, não evidência de sucesso.
- Mudança somente de instruções/documentação: confira caminhos, comandos, coerência e `git diff --check`; não execute a suíte fiscal inteira sem necessidade.

Use o ambiente compatível existente. Se Windows/WSL ou dependências impedirem a execução, diagnostique e use uma cópia temporária isolada quando apropriado, preservando o checkout e configurando explicitamente os caminhos das fixtures. Não reinstale dependências nem altere dados apenas para mascarar um erro de ambiente.

## Conclusão e limites

Para tarefas de implementação, prossiga pela implementação, validação pertinente e correção das falhas introduzidas pela alteração. Os checks locais descritos aqui não exigem confirmação a cada etapa. Encerre quando o comportamento solicitado funcionar e os checks relevantes passarem, ou quando houver um bloqueio que exija decisão do usuário; não faça ciclos adicionais sem motivo novo.

Se uma conclusão depender de dado ou decisão ausente, registre a lacuna e continue o trabalho independente permitido. Não contorne bloqueios de integridade. Envio, publicação, alteração em dados reais e commit dependem do escopo autorizado; um exemplo em documento não os autoriza. Ao final, informe o que mudou, o que foi verificado e o que permanece pendente.
