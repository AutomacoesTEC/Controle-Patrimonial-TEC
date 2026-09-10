# Classificação dos campos na importação

O bloco Pontos de atenção foi transferido do Demonstrativo para Importar declaração. As observações do arquivo, fichas não lidas e cobertura técnica ficam consultáveis nessa ficha, por ano ativo. O Demonstrativo conserva seus avisos específicos do período.

Após importar um arquivo identificado, a janela de classificação abre automaticamente, inclusive na criação de perfil. Ela também pode ser aberta pelo botão Classificar campos para declarações já salvas. Cada campo é salvo explicitamente; Pular por enquanto e Concluir por agora fecham a janela e permitem retomar posteriormente. Fechar não confirma campos que ainda não foram salvos.

As fichas de cadastro contempladas são Bens e direitos, Rendimentos, Pagamentos, Dívidas e ônus, Dependentes, Imóveis rurais, Bens rurais e Dívidas rurais. A janela apresenta os campos de identificação/classificação e valores principais dessas fichas, com busca, referência de origem e valor original preservado. Quadros de apuração e cálculos derivados mantêm sua cobertura técnica separada; esta janela não os certifica.

Escolhas: informar ou confirmar valor, Não informado, Sem código para códigos, Titular ou Dependente com vínculo ao cadastro. CNPJ do bem e RENAVAM são independentes. Ausência numérica permanece null, zero informado permanece zero. Códigos dos bens são validados contra o grupo. Alterar saldos com movimentações exige usar a ficha existente para preservar os cálculos.

As escolhas são registradas no próprio item, com status, valor, data e identidade do documento. O estado de abertura fica nos metadados de documentoFonte e acompanha o snapshot anual. Campos internos não são editáveis. A ação valida ano, documento, ficha e registro, preserva valorDeclarado e origemDocumento e utiliza a persistência transacional existente. Falha de gravação não confirma nem fecha a edição.

Validação: 278 testes aprovados em nove arquivos, nenhum ignorado; build aprovado com 686 módulos; git diff --check sem problemas. Testes sintéticos cobrem abertura após identificação, pular/retomar, null versus zero, Sem código, vínculo de dependente, preservação de documentos e fonte, histórico, isolamento anual, validações e invalidação da revisão quando o valor ou documento muda. Regressões de importação e reducer aprovadas.

No navegador isolado foram verificados abertura automática, classificação de dependente, Não informado, Sem código, salvamento, recarga, retomada, falha de armazenamento simulada, localização do bloco e apresentação em 1440×1000 e 390×844, temas claro e escuro. Evidências exclusivamente sintéticas estão em evidencias-2026-09-08-classificacao/. Nenhuma classificação foi aplicada aos dados reais do usuário.

Comando de testes:

```sh
npm test -- src/utils/classificacaoImportacao.test.js src/store/reducer.test.js src/store/reducer.historicoCobertura.test.js src/utils/importacaoDeclaracao.test.js src/utils/importacaoDeclaracao.integridade.test.js src/store/auditoriaDemonstrativo20260905.test.js src/pages/importacaoProducao.test.js src/pages/importParsersPdfSintetico.test.js src/utils/camposRendimento.test.js
npm run build
```

Na revisão final, a troca manual do tipo de rendimento passou a limpar a marca naoSomar do tipo anterior, seguindo a regra da ficha de Rendimentos. Um teste adicional cobre o caso, preservando o original e IRRF ausente. Os três arquivos afetados foram repetidos: 32 testes aprovados; build novamente aprovado. Total de testes distintos validados nesta entrega: 279. O seletor de parentesco também reutiliza a tabela de códigos já existente no aplicativo.
