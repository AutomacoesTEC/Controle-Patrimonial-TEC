import { describe, it, expect } from 'vitest';
import { demonstrativoPeriodo } from './consultaPeriodo';
import { initialState, reducer } from './reducer';
import { saldosQueAtravessam } from './saldosCompensaveis';
import { montarPainelIrrf } from './painelIrrf';
import { acompanhamentoVazio, aplicarAcompanhamento } from './acompanhamento';
import { painelFinanceiro, classeFinanceira, pontePatrimonial, parcelasDeclaradas, coberturaTemporal } from './auditoriaDemonstrativo';
import { planilhasDemonstrativo } from '../utils/exportDemonstrativo';
const base = () => ({...initialState, anoCalendario:2025, historico:{}, acompanhamento:acompanhamentoVazio()});
const fixture = () => ({...base(),bens:[{id:1,grupo:'02',beneficiario:'Titular',situacao_anterior:10000,situacao_atual:0,discriminacao:'VEICULO VENDIDO EM 27/11/2025 POR R$ 8.000,00 COM APURACAO DE PERDA DE R$ 2.000,00.'}]});
describe('regressões da auditoria do Demonstrativo',()=>{
 it('perda explicitamente datada entra em novembro e soma mensal fecha com ano',()=>{
   const s=fixture(); const anual=demonstrativoPeriodo(s,'2025-01-01','2025-12-31');
   expect(demonstrativoPeriodo(s,'2025-11-01','2025-11-30').ganhos.total).toBe(-2000);
   let total=0;for(let m=1;m<=12;m++){const mm=String(m).padStart(2,'0'); const fim=new Date(Date.UTC(2025,m,0)).getUTCDate();total+=demonstrativoPeriodo(s,'2025-'+mm+'-01','2025-'+mm+'-'+fim).saldoDeCaixa;}
   expect(total).toBeCloseTo(anual.saldoDeCaixa,2);
 });
 it('movimento manual da mesma venda não repete perda da descrição',()=>{
   const s=fixture();s.bens[0].movimentacoes=[{id:3,data:'2025-11-27',tipo:'venda_total',valor:10000,valorVenda:8000}];
   expect(demonstrativoPeriodo(s,'2025-11-01','2025-11-30').ganhos.total).toBe(-2000);
 });
 it('não transforma descrição sem venda em perda presumida',()=>{
   const s=fixture();s.bens[0].discriminacao='VEICULO';expect(demonstrativoPeriodo(s,'2025-11-01','2025-11-30').ganhos.total).toBe(0);
 });
 it('transporte rural lê saldo oficial e respeita decisão manual inclusive zero',()=>{
   const s={prejuizoRuralAcompensar:0,apuracaoResultadoRuralOficial:{saldoPrejuizoExercicioSeguinte:500}};
   expect(saldosQueAtravessam(s)[0].valor).toBe(500);
   expect(saldosQueAtravessam({...s,prejuizoRuralAjustadoManualmente:true})).toEqual([]);
 });
 it('imposto ausente não é convertido em zero; zero explícito continua zero',()=>{
   expect(montarPainelIrrf({impostoDevido:null}).impostoDevido).toBeNull();
   expect(montarPainelIrrf({impostoDevido:{impostoDevidoTotal:0}}).impostoDevido).toBe(0);
 });
 it('crédito fora do grupo05 é distinguido sem alterar o bem; manual prevalece',()=>{
   const b={grupo:'99',discriminacao:'JUROS DE CAPITAL PROPRIO A RECEBER'};
   expect(classeFinanceira(b).classe).toBe('credito');expect(b.classeFinanceira).toBeUndefined();
   expect(classeFinanceira({...b,classeFinanceira:'restrito'}).classe).toBe('restrito');
 });
 it('ponte inclui variações importadas, sem inventar datas ou movimentos',()=>{
   const s=fixture();const p=pontePatrimonial(s,'bens','2025-01-01','2025-12-31');expect(p[0].variacao).toBe(-10000);expect(p[0].movimentos).toEqual([]);
   expect(coberturaTemporal(s,'2025-01-01','2025-12-31').completa).toBe(false);
 });
 it('caixa não soma posição fiscal, renda anual ou parcelas previstas',()=>{
   const s=fixture();s.rendimentos=[{valor:99999,data:'2025-12-31',tipo:'isento_09'}];s.acompanhamento.contas=[{id:'c',pessoa:'titular',disponivel:true,dataAbertura:'2024-12-31',saldoInicial:10000}];
   s.acompanhamento.parcelas=[{id:'p',vencimento:'2025-01-15',sentido:'entrada',principal:99900,juros:0,taxas:0,imposto:0}];
   expect(painelFinanceiro(s,'2025-01-01','2025-12-31').final).toBe(10000);
 });
 it('contas próprias eliminam transferência; renda e consumo entram uma vez',()=>{
   const s=base();s.acompanhamento.contas=['a','b'].map(id=>({id,pessoa:'titular',disponivel:true,dataAbertura:'2024-12-31',saldoInicial:10000}));
   s.acompanhamento.lancamentos=[{id:1,tipo:'transferencia',contaId:'a',destinoId:'b',valor:2000,data:'2025-01-02'},{id:2,tipo:'entrada',contaId:'a',valor:5000,data:'2025-01-03',categoriaFluxo:'renda'},{id:3,tipo:'saida',contaId:'b',valor:1000,data:'2025-01-04',categoriaFluxo:'consumo'}];
   const f=painelFinanceiro(s,'2025-01-01','2025-01-31');expect(f.final).toBe(24000);expect(f.transferencias).toBe(0);expect(f.externos).toHaveLength(2);expect(f.categorias.find(c=>c.id==='renda').valor).toBe(5000);expect(f.coberturaDocumental).toBe(0);expect(f.gapContas).toBeNull();
 });
 it('zero movimentos não apresenta cobertura100% nem caixa comprovado',()=>{
   const f=painelFinanceiro(base(),'2025-01-01','2025-01-31');expect(f.coberturaDocumental).toBeNull();expect(f.extratosCompletos).toBe(false);expect(f.contas).toBe(0);
 });
 it('baixa cancelada é excluída; documento pertence à operação certa',()=>{
   const s=base();s.acompanhamento.contas=[{id:'c',pessoa:'titular',disponivel:true,dataAbertura:'2024-12-31',saldoInicial:0}];s.acompanhamento.operacoes=[{id:'o',descricao:'Venda',vinculos:[]}];s.acompanhamento.documentos=[{id:'d',operacaoId:'o',referencia:'contrato'}];s.acompanhamento.lancamentos=[{id:1,tipo:'entrada',contaId:'c',operacaoId:'o',data:'2025-01-02',valor:100,categoriaFluxo:'realizacao'},{id:2,tipo:'entrada',contaId:'c',data:'2025-01-02',valor:200,canceladoEm:'agora'}];
   const f=painelFinanceiro(s,'2025-01-01','2025-01-31');expect(f.final).toBe(100);expect(f.coberturaDocumental).toBe(100);
 });
 it('parcela declarada e baixa vinculada ficam lado a lado, sem nova entrada',()=>{
   const s=base();s.apuracaoGanhoCapital=[{id:1,bem:'Carro',valorAlienacao:1000,parcelas:[{data:'2025-03-01',valorRecebido:400}]}];s.acompanhamento.operacoes=[{id:'o',descricao:'Carro',vinculos:[{ref:{ano:2025,campo:'apuracaoGanhoCapital',id:1}}]}];s.acompanhamento.lancamentos=[{id:1,operacaoId:'o',tipo:'entrada',data:'2025-03-01',valor:40000}];
   const p=parcelasDeclaradas(s,'2025-01-01','2025-12-31')[0];expect(p.recebidoDeclarado).toBe(400);expect(p.baixas).toBe(400);expect(p.diferencaContratoParcelas).toBe(600);
 });
 it('exportação mensal inclui só lançamentos do período e resumo completo',()=>{
   const s=base();s.rendimentos=[{id:1,tipo:'isento_09',valor:100,data:'2025-11-10'},{id:2,tipo:'isento_09',valor:300,data:'2025-12-31'}];const de='2025-11-01',ate='2025-11-30';const demo=demonstrativoPeriodo(s,de,ate);
   const folhas=planilhasDemonstrativo({state:s,de,ate,pessoa:'Todos',demo,financeiro:painelFinanceiro(s,de,ate),cobertura:coberturaTemporal(s,de,ate),painelIrrf:montarPainelIrrf(s),saldos:[]});
   expect(folhas.find(f=>f.nome==='rendimentos').linhas).toHaveLength(1);expect(folhas.find(f=>f.nome==='Conciliação patrimonial').linhas.at(-1).Valor).toBe(demo.saldoDeCaixa);expect(folhas[0].linhas[0].De).toBe(de);
 });
});

describe('persistência dos complementos manuais',()=>{
 it('compensação usa saldo oficial, transporta saldo ajustado uma vez e preserva histórico',()=>{
   let s={...base(),apuracaoResultadoRuralOficial:{saldoPrejuizoExercicioSeguinte:500},receitasDespesasRuraisOficial:[{mes:1,receitaBruta:0,despesaCusteioInvestimento:500}]};
   s=reducer(s,{type:'AJUSTAR_PREJUIZO_RURAL',payload:100});expect(s.prejuizoRuralAcompensar).toBe(-400);
   s=reducer(s,{type:'ROLLOVER_ANO',payload:2026});expect(s.prejuizoRuralAcompensar).toBe(-400);expect(s.prejuizoRuralAjustadoManualmente).toBe(false);
   s=reducer(s,{type:'SWITCH_ANO',payload:2025});expect(s.prejuizoRuralAjustadoManualmente).toBe(true);expect(saldosQueAtravessam(s)[0].valor).toBe(400);
 });
 it('classificação de baixa existente altera categoria sem repetir movimento ou saldo',()=>{
   const s=base();s.acompanhamento.contas=[{id:'c',pessoa:'titular',dataAbertura:'2024-12-31',saldoInicial:0,disponivel:true}];s.acompanhamento.lancamentos=[{id:'l',contaId:'c',data:'2025-01-01',tipo:'entrada',valor:10000}];
   const n=aplicarAcompanhamento(s,{comando:'classificarLancamento',id:'l',categoriaFluxo:'nao_renda'},{id:'evt',agora:'2025-02-01'});
   expect(n.acompanhamento.lancamentos).toHaveLength(1);expect(n.acompanhamento.lancamentos[0].valor).toBe(10000);expect(painelFinanceiro(n,'2025-01-01','2025-01-31').categorias.find(c=>c.id==='nao_renda').valor).toBe(10000);
   expect(()=>aplicarAcompanhamento(s,{comando:'classificarLancamento',id:'l',categoriaFluxo:'consumo'},{id:'err',agora:'2025-02-01'})).toThrow(/incompatível/);
 });
 it('data efetiva confirmada remove pendência sem mudar valor',()=>{
   const s=base();s.rendimentos=[{id:1,data:'2025-12-31',valor:100,origemDocumento:{pagina:1},dataEfetivaConfirmada:true}];expect(coberturaTemporal(s,'2025-01-01','2025-12-31').completa).toBe(true);
 });
});
