# Otimizações autorizadas — execução

Autorização: “goal ultracode / ok para as otimizações. assim que terminar, faça teste de funcionalidade do app”. Escopo: OTIMIZACOES-PROPOSTAS.md. Sem alteração automática de dados reais ou promessa de certificação tributária.

## Camadas e aceite previstos, antes de implementar

1. Estado financeiro separado: hoje não há contas/extratos e o residual fiscal não prova caixa. Previsão: um fixture com abertura 110.000, transferência própria 10.000 e venda parcelada terá disponibilidade consolidada 110.000 antes do recebimento; transferência não criará renda; somente baixa financeira mudará o caixa. Estado global do perfil atravessará troca de ano, importação e backup sem entrar nos snapshots fiscais.
2. Identidade explícita: vínculos entre operação, movimento de bem, GCAP e rendimento. Previsão: vincular as duas representações da mesma venda manterá exatamente um resultado; operações distintas não serão abatidas entre si. Nenhum casamento por descrição.
3. Rotina: parcelas, referências documentais, pendências acionáveis, checklist e fechamento versionado. Previsão: contrato não será baixa; lançamento em mês fechado será recusado; reabrir exigirá motivo/responsável e preservará a versão anterior.
4. Segurança/proveniência: prévia de datas legadas, decisões rastreáveis, ensaio de backup sem tocar no perfil de trabalho. Previsão: conflitos ambíguos não serão movidos automaticamente; alteração do backup será recusada; documento externo será declarado como externo.
5. Interface/verificação: desfazer RV manual, três visões identificadas, tabelas dimensionáveis, impressão, teclado e largura reduzida. Previsão: regressões existentes continuarão passando e todos os fluxos novos terão execução funcional em perfil sintético separado.

Fixture inicial: commit 22c2477; dados sintéticos determinísticos nos testes novos (sem seeds aleatórios; relógio/IDs recebidos por parâmetro). Antes bruto: otimizacoes-suite-antes.txt. Executar cada camada com testes próprios e preservar os resultados, sem atualizar golden para ocultar divergências. Código congelado durante E2E. Relatório final registrará cobertura, limites e resultados reais.

Regimes especiais (MEI/PJ relacionada, exterior/cripto e novas regras rurais) são expansão condicionada aos perfis atendidos no documento aprovado; nenhuma nova alíquota será inventada nesta implementação de acompanhamento. Referências locais a documentos serão aceitas, sem embutir PDFs no localStorage.

## Progresso

- [x] Estado financeiro, contas, operações, parcelas e extratos.
- [x] Vínculos fiscais explícitos e não duplicação.
- [x] Três visões, projeção e data financeira.
- [x] Pendências, documentos, checklist e fechamento/reabertura.
- [x] Prévia de migração e proveniência.
- [x] Backup e ensaio de restauração.
- [x] Remoção do ajuste RV e impressão.
- [x] Suíte completa, build e testes funcionais finais.

Fechamento, evidências e o defeito corrigido no fim da rodada estão em
[OTIMIZACOES-ENTREGA.md](OTIMIZACOES-ENTREGA.md).
