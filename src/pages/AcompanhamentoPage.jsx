import { useState } from 'react';
import { useData } from '../store/DataContext';
import { acompanhamentoDo, caixaPeriodo, conciliarConta, limitesMes, valorParcela, fechamentoAtual, resultadoEconomicoOperacoes, formularioInicial, ajusteDoTipoDeBaixa } from '../store/acompanhamento';
import { formatCurrency, formatDate } from '../utils/formatters';
import { exportListaToXlsx } from '../utils/exportXlsx';
import TabelaRedimensionavel from '../components/TabelaRedimensionavel';
import Modal from '../components/Modal';
import { referenciasFiscais, resolverReferencia, chaveReferencia } from '../store/vinculosOperacoes';

const dinheiro = c => c == null ? 'Não informado' : formatCurrency(c / 100);
const CHECKLIST = ['contas', 'bens', 'dividas', 'rendimentos', 'impostos', 'titularidade', 'documentos'];
const TITULOS = { conta: 'Nova conta', operacao: 'Nova operação', parcela: 'Nova parcela', lancamento: 'Nova baixa financeira', extrato: 'Informar extrato', documento: 'Referência documental', avaliacao: 'Avaliação de mercado', fechar: 'Fechar mês', reabrir: 'Reabrir mês', cancelarLancamento: 'Cancelar baixa', cancelarParcela: 'Cancelar parcela', vincular: 'Vincular ficha fiscal', desvincular: 'Remover vínculo fiscal' };

function Tabela({ id, colunas, linhas }) {
  return <TabelaRedimensionavel persistKey={id}><table><thead><tr>{colunas.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{linhas.length ? linhas.map((l, i) => <tr key={i}>{l.map((v, j) => <td key={j}>{v}</td>)}</tr>) : <tr><td colSpan={colunas.length}>Nenhum registro neste recorte.</td></tr>}</tbody></table></TabelaRedimensionavel>;
}

export default function AcompanhamentoPage() {
  const { state, dispatchPersistido, addToast } = useData();
  const a = acompanhamentoDo(state);
  const referencias = referenciasFiscais(state);
  const [aba, setAba] = useState('caixa');
  const [mes, setMes] = useState(`${state.anoCalendario || new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [pessoa, setPessoa] = useState('todos');
  const [operacao, setOperacao] = useState('');
  const [comandoModal, setModal] = useState(null);
  const modal = comandoModal === 'editarConta' ? 'conta' : comandoModal === 'editarOperacao' ? 'operacao' : comandoModal;
  const [form, setForm] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [de, ate] = limitesMes(mes);
  const resumo = caixaPeriodo(a, de, ate, pessoa);
  const pessoas = [...new Map([
    ['titular', 'Titular'],
    ...[...(state.dependentes || []), ...Object.values(state.historico || {}).flatMap(h => h.dependentes || [])].map(d => [String(d.cpf || '').replace(/\D/g, '') || `id:${d.id}`, `Dependente: ${d.nome}`]),
    ...a.contas.filter(c => c.pessoa !== 'titular').map(c => [c.pessoa, `Dependente: ${c.pessoa}`]),
  ].reverse()).entries()].reverse();
  const nomePessoa = id => pessoas.find(p => p[0] === id)?.[1] || id;
  const nomeConta = id => a.contas.find(c => c.id === id)?.nome || '-';
  const nomeOperacao = id => a.operacoes.find(o => o.id === id)?.descricao || 'Sem vínculo';
  const ops = a.operacoes.filter(o => pessoa === 'todos' || o.pessoa === pessoa);
  const parcelas = a.parcelas.filter(p => (!operacao || p.operacaoId === operacao) && ops.some(o => o.id === p.operacaoId));
  const abrir = (comando, valores = {}) => {
    setErro(''); setForm(formularioInicial(comando, valores, { pessoa, mes, operacao })); setModal(comando);
  };
  const salvar = async e => {
    e.preventDefault(); setOcupado(true); setErro('');
    try {
      const type = modal === 'vincular' ? 'VINCULAR_OPERACAO' : modal === 'desvincular' ? 'DESVINCULAR_OPERACAO' : 'ACOMPANHAMENTO';
      await dispatchPersistido({ type, payload: { ...form, comando: comandoModal, ...(modal === 'vincular' ? { ref: referencias.find(r => chaveReferencia(r.ref) === form.referenciaFiscal)?.ref } : {}) } });
      setModal(null); addToast('Registro salvo no acompanhamento financeiro.', 'success');
    } catch (err) { setErro(err.message); }
    finally { setOcupado(false); }
  };
  const campo = (nome, rotulo, tipo = 'text', opcoes, aoMudar) => <label className="form-group" key={nome}><span>{rotulo}</span>{tipo === 'select' ? <select aria-label={rotulo} required value={form[nome] || ''} onChange={e => setForm(f => ({ ...f, [nome]: e.target.value, ...(aoMudar ? aoMudar(e.target.value) : {}) }))}><option value="">Selecione</option>{opcoes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select> : <input aria-label={rotulo} required type={tipo} step={tipo === 'number' ? '0.01' : undefined} value={form[nome] ?? ''} onChange={e => setForm(f => ({ ...f, [nome]: e.target.value }))} />}</label>;
  const camposPessoa = () => campo('pessoa', 'Titular ou dependente', 'select', pessoas);
  const camposConta = (key = 'contaId', label = 'Conta') => campo(key, label, 'select', a.contas.map(c => [c.id, `${c.nome} - ${nomePessoa(c.pessoa)}`]));
  const camposOperacao = () => campo('operacaoId', 'Operação', 'select', a.operacoes.map(o => [o.id, `${o.descricao} - ${nomePessoa(o.pessoa)}`]));
  const exportar = () => exportListaToXlsx(a.lancamentos.filter(l => l.data >= de && l.data <= ate && (pessoa === 'todos' || a.contas.find(c => c.id === l.contaId)?.pessoa === pessoa || a.contas.find(c => c.id === l.destinoId)?.pessoa === pessoa)), [
    ['ID', l => l.id], ['Data financeira', l => l.data], ['Registrado em', l => l.criadoEm], ['Conta', l => nomeConta(l.contaId)], ['Destino', l => nomeConta(l.destinoId)], ['Tipo', l => l.tipo], ['Descrição', l => l.descricao], ['Contraparte', l => l.contraparte], ['Operação', l => nomeOperacao(l.operacaoId)], ['Valor', l => l.valor / 100], ['Cancelado em', l => l.canceladoEm || ''],
  ], 'Razão financeiro', 'acompanhamento', Number(mes.slice(0, 4)));
  const botoes = (itens) => <div className="acomp-acoes">{itens.map(([rotulo, fn]) => <button key={rotulo} className="btn btn-sm btn-secondary" onClick={fn}>{rotulo}</button>)}</div>;
  const contasVisiveis = a.contas.filter(c => pessoa === 'todos' || c.pessoa === pessoa);
  return <>
    <div className="page-header"><h2>Acompanhamento financeiro</h2><div className="page-header-actions"><button className="btn btn-secondary" onClick={exportar}>Exportar razão .xlsx</button><button className="btn btn-secondary" onClick={() => window.print()}>Imprimir</button></div></div>
    <div className="page-body acomp-page">
      <p>Caixa registrado por contas e extratos. Não altera a declaração nem substitui a diferença de conciliação fiscal. Contratos e parcelas não são recebimentos.</p>
      <div className="acomp-filtros"><label>Mês de consulta<input type="month" value={mes} onChange={e => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value) && !e.target.value.startsWith('0000')) setMes(e.target.value); }} /></label><label>Titularidade<select aria-label="Titularidade" value={pessoa} onChange={e => setPessoa(e.target.value)}><option value="todos">Saldo geral</option>{pessoas.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label></div>
      <nav className="acomp-tabs" aria-label="Visões do acompanhamento">{[['caixa', 'Caixa e contas'], ['operacoes', 'Operações e parcelas'], ['conciliacao', 'Conciliação'], ['fechamento', 'Fechamento'], ['economico', 'Patrimônio econômico']].map(([v, t]) => <button key={v} className={`btn ${aba === v ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={aba === v} onClick={() => setAba(v)}>{t}</button>)}</nav>
      {aba === 'caixa' && <>
        <section className="card acomp-card"><h3>Disponibilidade financeira registrada - {mes}</h3><p>Saldo inicial: {dinheiro(resumo.inicial)} ; Aberturas no período: {dinheiro(resumo.aberturas)} ; Entradas: {dinheiro(resumo.entradas)} ; Saídas: {dinheiro(resumo.saidas)} ; Transferências líquidas no recorte: {dinheiro(resumo.transferencias)}</p><p><strong>Saldo final registrado: {resumo.contas ? dinheiro(resumo.final) : 'Sem contas disponíveis cadastradas'}</strong></p><p>Fluxo previsto ainda sem baixa: {dinheiro(resumo.projetado)}. Somente contas marcadas como disponíveis compõem este saldo; sua comprovação depende dos extratos.</p></section>
        {botoes([['Nova conta', () => abrir('conta')], ['Nova baixa financeira', () => abrir('lancamento')], ['Transferência entre contas', () => abrir('lancamento', { tipo: 'transferencia' })]])}
        <Tabela id="acomp-contas" colunas={['Conta', 'Titularidade', 'Abertura', 'Saldo na abertura', 'Disponível', 'Ações']} linhas={contasVisiveis.map(c => [c.nome, nomePessoa(c.pessoa), formatDate(c.dataAbertura), dinheiro(c.saldoInicial), c.disponivel ? 'Sim' : 'Não', botoes([['Editar conta', () => abrir('editarConta', { ...c, saldoInicial: c.saldoInicial / 100 })]])])} />
        <h3>Movimentação no mês (inclui cancelados para auditoria)</h3>
        <Tabela id="acomp-movimentos" colunas={['Data financeira', 'Conta / destino', 'Descrição / contraparte', 'Operação', 'Tipo', 'Valor', 'Ações']} linhas={a.lancamentos.filter(l => l.data >= de && l.data <= ate && (pessoa === 'todos' || contasVisiveis.some(c => c.id === l.contaId || c.id === l.destinoId))).map(l => [formatDate(l.data), `${nomeConta(l.contaId)}${l.destinoId ? ` → ${nomeConta(l.destinoId)}` : ''}`, `${l.descricao} / ${l.contraparte}`, nomeOperacao(l.operacaoId), l.canceladoEm ? `Cancelado: ${l.motivoCancelamento}` : l.tipo, dinheiro(l.valor), !l.canceladoEm && botoes([['Cancelar baixa', () => abrir('cancelarLancamento', { id: l.id })]])])} />
      </>}
      {aba === 'operacoes' && <>
        {botoes([['Nova operação', () => abrir('operacao')], ['Nova parcela', () => abrir('parcela')], ['Referência documental', () => abrir('documento')], ['Vincular ficha fiscal', () => abrir('vincular')]])}
        <label className="form-group">Operação em foco<select aria-label="Operação em foco" value={operacao} onChange={e => setOperacao(e.target.value)}><option value="">Todas as operações</option>{ops.map(o => <option key={o.id} value={o.id}>{o.descricao}</option>)}</select></label>
        <Tabela id="acomp-operacoes" colunas={['ID / descrição', 'Titularidade', 'Fato econômico', 'Ano fiscal', 'Registrado em', 'Tipo', 'Ações']} linhas={ops.filter(o => !operacao || o.id === operacao).map(o => [`${o.id} ; ${o.descricao}`, nomePessoa(o.pessoa), formatDate(o.dataEconomica), o.anoFiscal, o.criadoEm, o.tipo, botoes([['Editar operação', () => abrir('editarOperacao', { ...o, precoContrato: o.precoContrato == null ? '' : o.precoContrato / 100, custoBaixado: o.custoBaixado == null ? '' : o.custoBaixado / 100, despesasVenda: o.despesasVenda == null ? '' : o.despesasVenda / 100 })]])])} />
        <h3>Uma operação, várias representações fiscais</h3><p>Selecione o movimento de venda, a apuração GCAP e o rendimento correspondentes. O vínculo é explícito e não altera o documento importado. A importação sozinha não cria recebimentos no razão financeiro. Registros legados não vinculados ainda usam a conciliação agregada e exigem revisão.</p>
        <Tabela id="acomp-vinculos" colunas={['Operação', 'Ficha / ano', 'Registro', 'Proveniência', 'Ações']} linhas={ops.filter(o => !operacao || o.id === operacao).flatMap(o => (o.vinculos || []).map(v => [o.descricao, `${v.ref.campo} / ${v.ref.ano}`, referencias.find(r => chaveReferencia(r.ref) === chaveReferencia(v.ref))?.rotulo || 'Referência não encontrada - revisar após importação', resolverReferencia(state, v.ref) ? 'Vínculo local sobre dado fiscal preservado' : 'Pendente', botoes([['Remover vínculo', () => abrir('desvincular', { operacaoId: o.id, vinculoId: v.id })]])]))} />
        <h3>Cronograma de parcelas</h3><p>Principal/amortização, juros, taxas e imposto são componentes separados. Cadastre impostos retidos como saída própria, quando não compuserem o pagamento ao beneficiário. Cada parcela exige baixa; desdobre pagamentos parciais em parcelas antes da baixa.</p>
        <Tabela id="acomp-parcelas" colunas={['Operação', 'Vencimento', 'Sentido', 'Principal / amortização', 'Juros', 'Taxas', 'Imposto', 'Total', 'Situação', 'Ações']} linhas={parcelas.map(p => { const baixa = a.lancamentos.find(l => l.parcelaId === p.id && !l.canceladoEm); return [nomeOperacao(p.operacaoId), formatDate(p.vencimento), p.sentido, dinheiro(p.principal), dinheiro(p.juros), dinheiro(p.taxas), dinheiro(p.imposto), dinheiro(valorParcela(p)), p.canceladoEm ? 'Cancelada' : baixa ? `Liquidada ${formatDate(baixa.data)}` : p.vencimento < ate ? 'Pendente até o fim do mês' : 'Prevista', !p.canceladoEm && !baixa && botoes([['Dar baixa', () => abrir('lancamento', { parcelaId: p.id, operacaoId: p.operacaoId, valor: valorParcela(p) / 100, tipo: p.sentido, descricao: nomeOperacao(p.operacaoId) })], ['Cancelar parcela', () => abrir('cancelarParcela', { id: p.id })]])]; })} />
        <h3>Comprovantes - referências externas</h3><p>O backup inclui estas referências, não os arquivos apontados. Guarde os documentos em pasta própria e copie essa pasta junto com o backup. Caminhos são texto; o navegador não abre arquivos arbitrários do computador.</p>
        <Tabela id="acomp-documentos" colunas={['Operação', 'Documento', 'Referência local', 'Registrado em']} linhas={a.documentos.filter(d => !operacao || d.operacaoId === operacao).map(d => [nomeOperacao(d.operacaoId), d.descricao, d.referencia, d.criadoEm])} />
      </>}
      {aba === 'conciliacao' && <>
        {botoes([['Informar extrato', () => abrir('extrato')]])}
        <p>A diferença é saldo calculado menos saldo do extrato. Extrato ausente permanece desconhecido. Abertura dentro do mês representa o saldo na data inicial informada, não em 01/01.</p>
        {contasVisiveis.filter(c => c.dataAbertura <= ate).map(c => { const r = conciliarConta(a, c.id, mes); return <section className="card acomp-card" key={c.id}><h3>{c.nome} - {nomePessoa(c.pessoa)}</h3><p>Abertura: {dinheiro(r.inicial)} ; Entradas: {dinheiro(r.entradas)} ; Saídas: {dinheiro(r.saidas)} ; Calculado: {dinheiro(r.calculado)} ; Extrato: {dinheiro(r.extrato?.saldo)} ; <strong>Diferença: {dinheiro(r.diferenca)}</strong></p><p>Referência: {r.extrato?.referencia || 'Extrato pendente'}</p><Tabela id={`extrato-${c.id}`} colunas={['Data', 'Descrição', 'Contraparte', 'Efeito no saldo']} linhas={r.movimentos.map(l => [formatDate(l.data), l.descricao, l.contraparte, dinheiro(l.efeito)])} /></section>; })}
      </>}
      {aba === 'fechamento' && <>
        <p>Fechamento financeiro exige extratos conciliados e revisão humana do checklist. Bloqueia alterações financeiras que afetem este mês e os posteriores fechados. Não congela a declaração importada; retificações fiscais precisam de nova revisão.</p>
        <p>Situação de {mes}: {fechamentoAtual(a, mes)?.status || 'Em aberto'}</p>
        {botoes([[fechamentoAtual(a, mes)?.status === 'fechado' ? 'Reabrir mês' : 'Fechar mês', () => abrir(fechamentoAtual(a, mes)?.status === 'fechado' ? 'reabrir' : 'fechar')]])}
        <Tabela id="acomp-fechamentos" colunas={['Mês', 'Versão', 'Situação', 'Responsável', 'Data', 'Parecer / motivo']} linhas={a.fechamentos.map(f => [f.mes, f.versao, f.status, f.responsavel, f.criadoEm, f.observacoes || f.motivo])} />
      </>}
      {aba === 'economico' && <>
        {(() => { const r = resultadoEconomicoOperacoes(a, de, ate, pessoa); return <section className="card acomp-card"><h3>Resultado econômico das vendas em {mes}</h3><p>Preço do contrato menos custo baixado e despesas da venda: {dinheiro(r.total)} ({r.completas} operações completas; {r.incompletas} sem base suficiente). Não é recebimento, ganho tributável apurado nem valor de imposto. Importações posteriores não substituem os componentes locais da operação.</p></section>; })()}
        <p>Visão opcional de mercado, sem alteração do custo fiscal. Total parcial: apenas bens avaliados, uma avaliação mais recente por referência até o fim do mês. Não representa patrimônio líquido integral nem deduz dívidas.</p>
        {botoes([['Avaliação de mercado', () => abrir('avaliacao')]])}
        {(() => { const ultimas = [...a.avaliacoes].filter(v => v.data <= ate && (pessoa === 'todos' || v.pessoa === pessoa)).sort((x, y) => x.data.localeCompare(y.data)); const lista = [...new Map(ultimas.map(v => [`${v.pessoa}:${v.chaveBem}`, v])).values()]; return <><p>Total parcial de mercado: {lista.length ? dinheiro(lista.reduce((s, v) => s + v.valor, 0)) : 'Sem avaliações'}</p><Tabela id="acomp-mercado" colunas={['Referência', 'Bem', 'Titularidade', 'Data', 'Mercado', 'Fonte']} linhas={lista.map(v => [v.chaveBem, v.descricao, nomePessoa(v.pessoa), formatDate(v.data), dinheiro(v.valor), v.fonte])} /></>; })()}
      </>}
    </div>
    <Modal open={modal != null} onClose={() => { if (!ocupado) setModal(null); }}><form onSubmit={salvar}><div className="modal-header"><h3>{TITULOS[modal]}</h3><button type="button" className="btn btn-secondary" disabled={ocupado} onClick={() => setModal(null)}>Fechar</button></div><div className="modal-body acomp-form">
      {erro && <p role="alert" className="acomp-erro">{erro}</p>}
      {modal === 'conta' && <>{campo('nome', 'Nome da conta')}{camposPessoa()}{campo('dataAbertura', 'Data do saldo de abertura', 'date')}{campo('saldoInicial', 'Saldo de abertura (R$)', 'number')}<label><input type="checkbox" checked={form.disponivel} onChange={e => setForm(f => ({ ...f, disponivel: e.target.checked }))} /> Compõe disponibilidade imediata (não marcar créditos ou investimentos sem liquidez)</label></>}
      {modal === 'operacao' && <>{campo('descricao', 'Descrição da operação')}{campo('tipo', 'Tipo da operação', 'select', [['venda', 'Venda'], ['compra', 'Compra'], ['divida', 'Dívida'], ['rendimento', 'Rendimento'], ['imposto', 'Imposto'], ['outro', 'Outro']])}{camposPessoa()}{campo('dataEconomica', 'Data do fato econômico', 'date')}{form.tipo === 'venda' && <>{campo('precoContrato', 'Preço total do contrato (R$)', 'number')}{campo('custoBaixado', 'Custo baixado (R$)', 'number')}{campo('despesasVenda', 'Despesas da venda / corretagem (R$)', 'number')}</>}<p>O ano fiscal inicial será o da data. Vínculos com fichas preservam o ano fiscal de cada representação, inclusive pagamentos posteriores. O resultado econômico não apura tributos; as parcelas e baixas têm valores e datas próprios.</p></>}
      {modal === 'parcela' && <>{camposOperacao()}{campo('vencimento', 'Data prevista de pagamento / recebimento', 'date')}{campo('sentido', 'Sentido', 'select', [['entrada', 'Receber'], ['saida', 'Pagar']])}{campo('principal', 'Principal / amortização (R$)', 'number')}{campo('juros', 'Juros (R$)', 'number')}{campo('taxas', 'Taxas (R$)', 'number')}{campo('imposto', 'Imposto incluído no total pago (R$)', 'number')}</>}
      {modal === 'lancamento' && <>{campo('tipo', 'Tipo de baixa', 'select', [['entrada', 'Entrada'], ['saida', 'Saída'], ['transferencia', 'Transferência própria']], valor => ajusteDoTipoDeBaixa('lancamento', valor))}{camposConta()}{form.tipo === 'transferencia' && camposConta('destinoId', 'Conta de destino')}{campo('data', 'Data efetiva de pagamento / recebimento', 'date')}{campo('valor', 'Valor efetivo (R$)', 'number')}{campo('descricao', 'Descrição da baixa')}{form.tipo !== 'transferencia' && <>{campo('contraparte', 'Contraparte (pagador / recebedor)')}<label className="form-group">Operação vinculada (opcional)<select value={form.operacaoId || ''} onChange={e => setForm(f => ({ ...f, operacaoId: e.target.value }))}><option value="">Sem vínculo - ficará pendente</option>{a.operacoes.map(o => <option key={o.id} value={o.id}>{o.descricao}</option>)}</select></label></>}{form.parcelaId && <p>Baixa integral da parcela selecionada. O total e a operação serão validados ao salvar.</p>}</>}
      {modal === 'extrato' && <>{camposConta()}{campo('mes', 'Mês do extrato', 'month')}{campo('saldo', 'Saldo final do extrato (R$)', 'number')}{campo('referencia', 'Referência local do extrato')}</>}
      {modal === 'documento' && <>{camposOperacao()}{campo('descricao', 'Descrição do documento')}{campo('referencia', 'Caminho ou referência local do documento')}<p>Somente a referência será incluída no backup. O arquivo continua externo.</p></>}
      {modal === 'vincular' && <>{camposOperacao()}{campo('referenciaFiscal', 'Registro fiscal (ano, ficha e identificação)', 'select', referencias.map(r => [chaveReferencia(r.ref), r.rotulo]))}<p>Confirme que se trata da mesma operação econômica. Vínculos não são deduzidos por descrição ou coincidência de valores.</p></>}
      {modal === 'desvincular' && campo('motivo', 'Motivo da remoção do vínculo')}
      {modal === 'avaliacao' && <>{campo('chaveBem', 'Referência estável do bem (usar a mesma nas reavaliações)')}{campo('descricao', 'Descrição do bem')}{camposPessoa()}{campo('data', 'Data da avaliação', 'date')}{campo('valor', 'Valor de mercado (R$)', 'number')}{campo('fonte', 'Fonte / laudo da avaliação')}</>}
      {(modal === 'fechar' || modal === 'reabrir') && <>{campo('mes', 'Mês', 'month')}{campo('responsavel', 'Responsável')}{modal === 'fechar' ? <>{CHECKLIST.map(k => <label key={k}><input type="checkbox" checked={!!form.checklist?.[k]} onChange={e => setForm(f => ({ ...f, checklist: { ...f.checklist, [k]: e.target.checked } }))} /> Revisei {k}</label>)}{campo('observacoes', 'Parecer sobre pendências e aprovação')}</> : campo('motivo', 'Motivo da reabertura')}</>}
      {(modal === 'cancelarLancamento' || modal === 'cancelarParcela') && <>{campo('motivo', 'Motivo do cancelamento')}<p>O registro será preservado na auditoria. Para corrigir, cancele e cadastre novamente.</p></>}
    </div><div className="modal-footer"><button type="button" className="btn btn-secondary" disabled={ocupado} onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar'}</button></div></form></Modal>
  </>;
}
