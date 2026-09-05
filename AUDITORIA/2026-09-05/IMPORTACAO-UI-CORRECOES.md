# Defeitos encontrados na importação pelo navegador

Base de produção:9d5ac4d mais mudanças de novo bem e painel de pendências explicitadas no diff.

1. Trocar titular em ImportPage sobrescreve dependentes do resultado por[], apagando os da NOVA declaração. O reducer já substitui a coleção, não exige esvaziamento prévio. Previsão antes de mexer: o mesmo PDF AJU sintético importado sobre titular diferente preservará seus dependentes e não os do titular antigo. Evidência antes: importacao-perfis-antes.txt, cenário nomeado.
2. Perfil recém-criado apenas com nome recebe origem legada inferida na carga. A política de destino considera essa origem prova suficiente de declaração anterior; primeira importação do mesmo titular abre indevidamente conciliação. Evidência: importacao-aju-diagnostico.txt. Previsão: origem sem documento nem conteúdo fiscal não caracterizará importação anterior; snapshots históricos com rendimentos continuarão reconhecidos.

Fixtures determinísticos e sintéticos: auditar-importacao-perfis.py (PDF versionado AJU-01), destinoImportacao.test.js. Sem aleatoriedade e sem alteração de fórmula fiscal. Camada causal: decisão e payload do fluxo de importação, antes de persistir.

Decisão: MANTER. importacao-exportacao-depois.txt contém o contrato de destino aprovado; importacao-perfis-depois.txt comprova o dependente da nova declaração preservado. importacao-aju-final.txt confirma a importação inicial com7bens,2dívidas,18rendimentos,8pagamentos e1dependente.

Durante a ampliação para retificadora/histórico surgiu outro defeito de interação: selecionar o mesmo arquivo novamente na mesma montagem do input não disparava nova leitura. A primeira retificadora havia funcionado porque a ficha fora remontada pela navegação. Previsão anterior ao ajuste: limpar o valor do input depois de capturar File permitirá revisão repetida sem mudar dados até confirmar. retificadora-historico-final.txt preserva a falha; retificadora-historico-reteste.txt confirma conciliação sem duplicação, data local mantida, avanço, carga/exclusão e cancelamento sem mutação. MANTER. A tentativa anterior de excluir2026 da lista de declarações era erro do teste: ano manual não faz parte dessa lista, e o alvo correto era a declaração2025.
