# Subauditoria de cadastros, datas e metadados

## Reclassificação de rendimento — previsão anterior à correção

Falha observada: abrir RRA importado marcado `naoSomar: true`, trocar seu tipo para PJ e salvar preserva a marca de duplicidade exclusiva do RRA. O lançamento reclassificado desaparece dos totais. O formulário copia o registro completo e o reducer mescla os campos.

Fixture fixa: registro sintético id 7, RRA de 1.000, IRRF zero, tipo alterado para PJ. Teste `src/utils/camposRendimento.test.js`. Sem aleatoriedade. Antes da correção foi extraída a montagem do payload para função pura mantendo o mesmo comportamento da tela. Saída `rendimento-reclassificacao-antes.txt`: falha esperada `true` versus `false`; dois controles passam.

Previsão: apenas quando o tipo efetivamente mudar, desativar a marca derivada `naoSomar` permitirá somar os 1.000; editar o mesmo tipo manterá a proteção contra duplicidade. Os três testes deverão passar. Proveniência/documento devem permanecer preservados. Camada alterada: normalização dos metadados do formulário; nenhuma fórmula tributária.

Decisão **MANTER**: `rendimento-reclassificacao-depois.txt` registra 3/3 testes passando. Antes: 1 falha e 2 controles passando; depois: reclassificação volta a contribuir 1.000, edição do mesmo RRA continua contribuindo zero e normalização numérica/proveniência permanecem preservadas. Sem commit nesta subauditoria, conforme coordenação do trabalho. A integração mecânica da validação de data em RendimentosPage pertence à rodada de limites executada pelo agente principal.

## Outros achados encaminhados ao agente principal

- `garantirAnoCadastro` não valida ano finito/faixa antes de confirmar. `estadoNoAno` percorre os anos intermediários; inputs de data sem máximo aceitam anos extremos. Não foram disparados loops extensos. Validar também a reconstrução de saldo durante digitação, antes do submit.
- Datas com ano superior a quatro dígitos são truncadas por `slice(0,4)` em algumas fichas e rejeitadas pelo regex com fallback ao ano ativo em outras. Unificar parsing e limites.
- Novo bem com aquisição em 2026 aceita situação anterior de 100 e atual de 100. Isso inventa patrimônio prévio à aquisição. Proposta não invasiva: novo cadastro datado de aquisição inicia situação anterior zero; manter saldos de abertura importados e edições existentes. Para inclusão de patrimônio antigo, usar processo explícito de ajuste de saldo inicial, não fingir aquisição no ano atual. Nenhuma fórmula precisa mudar.
- Alterar data de aquisição histórica em bem/imóvel ou data cadastral da dívida usa UPDATE no ano ativo. Não mover estoque inteiro apenas porque se corrige metadado histórico; movimentos financeiros têm suas próprias datas e destino.
- Seletores anuais restantes encontrados: consulta de relatórios/ganhos e competência mensal RV. Não se encontrou seletor anual em inclusão/edição de rendimento, pagamento, doação, bem, dívida ou lançamento rural.

Escopo: inspeção estática e teste puro do payload da reclassificação; interação de navegador e reducer interanual foram atribuídos a outros auditores. Achados não equivalem a ensaio visual completo de todas as fichas.
