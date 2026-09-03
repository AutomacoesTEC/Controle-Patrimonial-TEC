import { useState, useRef, useMemo } from 'react';
import { useData } from '../store/DataContext';
import { bemZeradoSemMovimentacaoNoAno, origemResultadoRural, resultadoAtividadeRuralPeriodo } from '../store/demonstrativos';
import { formatCurrency, formatDate, formatCpfCnpj, MOVIMENTACAO_DIVIDA_TIPOS, descreverDocumentoParticipante, descreverOrigemDocumento, truncarComReticencias} from '../utils/formatters';
import BemRuralModal from '../components/BemRuralModal';
import Modal from '../components/Modal';
import AnoCalendarioModal from '../components/AnoCalendarioModal';
import MoneyInput from '../components/MoneyInput';
import DateInput from '../components/DateInput';
import MovimentacaoBemForm from '../components/MovimentacaoBemForm';
import { exportListaToXlsx, resumoMovimentacoes } from '../utils/exportXlsx';
import { primeiroCampoVazio, primeiroValorZerado, mensagemObrigatorio } from '../utils/validacao';

const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const FORM_IMOVEL_VAZIO = { nomeLocalizacao: '', area: '', participacao: '100', condicaoExploracao: '', codigoAtividade: '', cib: '', dataAquisicao: '' };
// Data vazia por padrão: o ano-calendário sai dela; pré-preencher "hoje"
// forçaria trocar de ano ao salvar num exercício de trabalho diferente.
const FORM_LANCAMENTO_VAZIO = { tipo: 'receita', data: '', valor: '', descricao: '' };
const FORM_DIVIDA_RURAL_VAZIO = { discriminacao: '', situacao_anterior: '', situacao_atual: '', valor_pago: '' };

// Mesmo critério de BensPage.jsx (ver comentário lá): um bem da Atividade Rural que já entrou no
// ano com as duas situações zeradas e nenhuma movimentação registrada NESTE ano não tem mais nada
// a conferir na declaração deste ano -- deixa de aparecer na listagem (pedido da usuária,
// 21/08/2026). O terceiro critério (sem movimentações) distingue esse caso do bem que está SENDO
// baixado justamente NESTE ano, que continua aparecendo.

export default function AtividadeRuralPage({ abaInicial, onVoltar } = {}) {
  const { state, dispatch, addToast, garantirAnoCadastro, despacharEmAno, confirmar } = useData();
  const {
    imoveisRurais, bensRurais, dividasRurais, lancamentosRurais, prejuizoRuralAcompensar, anoCalendario,
    receitasDespesasRuraisOficial, apuracaoResultadoRuralOficial, movimentacaoRebanhoOficial,
    participantesRuraisOficial,
  } = state;
  const [subView, setSubView] = useState(abaInicial || 'imoveis');

  const receitaTotal = lancamentosRurais.filter(l => l.tipo === 'receita').reduce((s, l) => s + (parseFloat(l.valor) || 0), 0);
  const despesaTotal = lancamentosRurais.filter(l => l.tipo === 'despesa').reduce((s, l) => s + (parseFloat(l.valor) || 0), 0);
  const resultadoDoAno = receitaTotal - despesaTotal;
  // De onde vem cada pedaço do resultado que o Demonstrativo usa: quais meses
  // o livro-caixa manual substituiu e quais continuam vindo da declaração
  // (ver origemResultadoRural em demonstrativos.js, achado 03).
  const periodoDoAno = anoCalendario != null
    ? { de: `${anoCalendario}-01-01`, ate: `${anoCalendario}-12-31` }
    : { de: null, ate: null };
  const oficialRural = { meses: receitasDespesasRuraisOficial, ano: anoCalendario };
  const origemRural = origemResultadoRural(lancamentosRurais, periodoDoAno.de, periodoDoAno.ate, oficialRural);
  const resultadoConsolidado = resultadoAtividadeRuralPeriodo(lancamentosRurais, periodoDoAno.de, periodoDoAno.ate, oficialRural);

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          {onVoltar && <button type="button" className="btn-voltar-dashboard" onClick={onVoltar}>← Voltar ao Dashboard</button>}
          <h2>Atividade Rural</h2>
          <p>Imóveis explorados, bens, receitas/despesas e resultado. Ficha própria da declaração, separada de Bens e Direitos.</p>
        </div>
      </div>
      <div className="page-body animate-in">
        <div className="tabs" style={{ marginBottom: '20px' }}>
          <button className={`tab ${subView === 'imoveis' ? 'active' : ''}`} onClick={() => setSubView('imoveis')}>Imóveis Explorados</button>
          <button className={`tab ${subView === 'bens' ? 'active' : ''}`} onClick={() => setSubView('bens')}>Bens da Atividade Rural</button>
          <button className={`tab ${subView === 'dividas' ? 'active' : ''}`} onClick={() => setSubView('dividas')}>Dívidas Vinculadas</button>
          <button className={`tab ${subView === 'lancamentos' ? 'active' : ''}`} onClick={() => setSubView('lancamentos')}>Receitas e Despesas</button>
          <button className={`tab ${subView === 'resultado' ? 'active' : ''}`} onClick={() => setSubView('resultado')}>Resultado</button>
          {movimentacaoRebanhoOficial.length > 0 && (
            <button className={`tab ${subView === 'rebanho' ? 'active' : ''}`} onClick={() => setSubView('rebanho')}>Movimentação do Rebanho</button>
          )}
          {participantesRuraisOficial.length > 0 && (
            <button className={`tab ${subView === 'participantes' ? 'active' : ''}`} onClick={() => setSubView('participantes')}>Participantes</button>
          )}
        </div>

        {subView === 'imoveis' && (
          <ImoveisRuraisSection
            imoveisRurais={imoveisRurais} dispatch={dispatch} addToast={addToast}
            anoCalendario={anoCalendario} garantirAnoCadastro={garantirAnoCadastro} despacharEmAno={despacharEmAno}
          />
        )}
        {subView === 'bens' && <BensRuraisSection bensRurais={bensRurais} dispatch={dispatch} addToast={addToast} anoCalendario={anoCalendario} despacharEmAno={despacharEmAno} />}
        {subView === 'dividas' && <DividasRuraisSection dividasRurais={dividasRurais} dispatch={dispatch} addToast={addToast} anoCalendario={anoCalendario} />}
        {subView === 'lancamentos' && (
          <LancamentosRuraisSection
            lancamentosRurais={lancamentosRurais} dispatch={dispatch} addToast={addToast}
            receitaTotal={receitaTotal} despesaTotal={despesaTotal} resultadoDoAno={resultadoDoAno}
            anoCalendario={anoCalendario} garantirAnoCadastro={garantirAnoCadastro} despacharEmAno={despacharEmAno}
            receitasDespesasRuraisOficial={receitasDespesasRuraisOficial}
            origemRural={origemRural} resultadoConsolidado={resultadoConsolidado}
          />
        )}
        {subView === 'resultado' && (
          <ResultadoSection
            receitaTotal={receitaTotal} despesaTotal={despesaTotal} resultadoDoAno={resultadoDoAno}
            prejuizoRuralAcompensar={prejuizoRuralAcompensar} dispatch={dispatch} addToast={addToast}
            apuracaoResultadoRuralOficial={apuracaoResultadoRuralOficial}
          />
        )}
        {subView === 'rebanho' && <RebanhoSection movimentacaoRebanhoOficial={movimentacaoRebanhoOficial} />}
        {subView === 'participantes' && <ParticipantesRuraisSection participantesRuraisOficial={participantesRuraisOficial} />}
      </div>
    </>
  );
}

function ImoveisRuraisSection({ imoveisRurais, dispatch, addToast, anoCalendario, garantirAnoCadastro, despacharEmAno }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_IMOVEL_VAZIO);
  const [anoCadastro, setAnoCadastro] = useState(anoCalendario);
  const [anoModalOpen, setAnoModalOpen] = useState(false);
  const pendingActionRef = useRef(null);
  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const abrirNovo = (ano = anoCalendario) => { setEditingId(null); setForm(FORM_IMOVEL_VAZIO); setAnoCadastro(ano); setModalOpen(true); };
  const handleNovoClick = () => {
    if (anoCalendario == null) { pendingActionRef.current = abrirNovo; setAnoModalOpen(true); return; }
    abrirNovo();
  };
  const abrirEdicao = (i) => {
    setEditingId(i.id);
    setForm({ nomeLocalizacao: i.nomeLocalizacao || '', area: i.area || '', participacao: i.participacao ?? '100', condicaoExploracao: i.condicaoExploracao || '', codigoAtividade: i.codigoAtividade || '', cib: i.cib || '', dataAquisicao: i.dataAquisicao || '' });
    setModalOpen(true);
  };
  const handleSave = async (e) => {
    e.preventDefault();
    const falta = primeiroCampoVazio([['Nome e Localização', form.nomeLocalizacao]]);
    if (falta) { addToast(mensagemObrigatorio(falta), 'error'); return; }
    const payload = { ...form, area: parseFloat(form.area) || 0, participacao: parseFloat(form.participacao) || 0 };
    if (editingId) {
      dispatch({ type: 'UPDATE_IMOVEL_RURAL', payload: { ...payload, id: editingId } });
      addToast('Imóvel atualizado!', 'success');
    } else {
      const anoAlvo = await garantirAnoCadastro(anoCadastro);
      if (!anoAlvo) return;
      despacharEmAno(anoAlvo, { type: 'ADD_IMOVEL_RURAL', payload });
      addToast('Imóvel cadastrado!', 'success');
    }
    setModalOpen(false);
  };
  const handleDelete = (i) => {
    if (confirm(`Excluir "${i.nomeLocalizacao || 'este imóvel'}"?\n\nEssa ação não pode ser desfeita.`)) {
      dispatch({ type: 'DELETE_IMOVEL_RURAL', payload: i.id });
      addToast('Imóvel excluído', 'info');
    }
  };

  const handleExport = () => exportListaToXlsx(
    imoveisRurais,
    [
      ['Nome e Localização', i => i.nomeLocalizacao || ''],
      ['Área (ha)', i => i.area || 0],
      ['Participação (%)', i => i.participacao ?? 100],
      ['Condição', i => i.condicaoExploracao || ''],
      ['Código Atividade', i => i.codigoAtividade || ''],
      ['CIB', i => i.cib || ''],
      ['Data de Aquisição', i => formatDate(i.dataAquisicao)],
    ],
    'Imóveis Rurais', 'imoveis_rurais', anoCalendario
  );

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '12px' }}>
        <button className="btn btn-secondary" onClick={handleExport}>Exportar .xlsx</button>
        <button className="btn btn-primary" onClick={handleNovoClick}>＋ Novo Imóvel</button>
      </div>
      <div className="table-container">
        <table>
          <thead><tr><th>Nome e Localização</th><th>Área (ha)</th><th>Participação (%)</th><th>Condição</th><th>Código Atividade</th><th>CIB</th><th>Data Aquisição</th><th>Ações</th></tr></thead>
          <tbody>
            {imoveisRurais.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhum imóvel cadastrado.</td></tr>
            ) : imoveisRurais.map(i => (
              <tr key={i.id}>
                <td>
                  {i.nomeLocalizacao}
                  {descreverOrigemDocumento(i) && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{descreverOrigemDocumento(i)}</div>
                  )}
                </td>
                <td>{i.area}</td>
                <td>{i.participacao}</td>
                <td>{i.condicaoExploracao}</td>
                <td>{i.codigoAtividade}</td>
                <td>{i.cib}</td>
                <td>{formatDate(i.dataAquisicao)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => abrirEdicao(i)}>Editar</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(i)}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
            <div className="modal-header"><h3>{editingId ? 'Editar Imóvel' : 'Novo Imóvel'}</h3><button className="modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {!editingId && (
                  <div className="form-row">
                    <div className="form-group"><label>Ano-calendário</label><input className="form-control" type="number" value={anoCadastro} onChange={e => setAnoCadastro(e.target.value === '' ? '' : parseInt(e.target.value, 10))} /></div>
                  </div>
                )}
                <div className="form-group"><label>Nome e Localização</label><input className="form-control" value={form.nomeLocalizacao} onChange={e => upd('nomeLocalizacao', e.target.value)} placeholder="Ex: Fazenda Santa Rita, Uberaba" /></div>
                <div className="form-row">
                  <div className="form-group"><label>Área (ha)</label><input className="form-control" type="number" step="0.01" value={form.area} onChange={e => upd('area', e.target.value)} /></div>
                  <div className="form-group"><label>Participação (%)</label><input className="form-control" type="number" step="0.01" value={form.participacao} onChange={e => upd('participacao', e.target.value)} /></div>
                  <div className="form-group"><label>CIB</label><input className="form-control" value={form.cib} onChange={e => upd('cib', e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Código da Atividade</label>
                    <input className="form-control" value={form.codigoAtividade} onChange={e => upd('codigoAtividade', e.target.value)} placeholder="Código conforme a tabela da declaração" />
                  </div>
                  <div className="form-group">
                    <label>Condição de Exploração</label>
                    <input className="form-control" value={form.condicaoExploracao} onChange={e => upd('condicaoExploracao', e.target.value)} placeholder="Código conforme a tabela da declaração" />
                  </div>
                  <div className="form-group">
                    <label>Data de Aquisição</label>
                    <DateInput value={form.dataAquisicao} onChange={v => upd('dataAquisicao', v)} />
                  </div>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button></div>
            </form>
      </Modal>
      <AnoCalendarioModal
        open={anoModalOpen}
        onClose={() => setAnoModalOpen(false)}
        onConfirm={anoConfirmado => { setAnoModalOpen(false); pendingActionRef.current?.(anoConfirmado); pendingActionRef.current = null; }}
      />
    </>
  );
}

// Puramente informativo, igual RebanhoSection. Fica numa aba própria (não
// dentro de ImoveisRuraisSection) de propósito: um .card grande ao lado do
// .table-container dos imóveis (que tem flex:1;min-height:0 pra preencher
// o .page-body) faz o CSS espremer o table-container quase a zero de
// altura — achado real, visto com Playwright (24 imóveis somem da tela,
// tabela com offsetHeight:2px). Aba separada evita o conflito de layout
// sem mexer no CSS compartilhado.
function ParticipantesRuraisSection({ participantesRuraisOficial }) {
  // Os DOIS caminhos entregam o vínculo com o imóvel desde 24/08/2026: o PDF
  // pelo aninhamento impresso sob cada fazenda, o .DBK pela chave NR_CHAVE_AR
  // dos registros 50 e 57. A coluna só some se a importação não trouxer o
  // vínculo (declaração de um exercício cujo layout não tenha a chave, ou dado
  // cadastrado à mão), em vez de ficar vazia sem explicação.
  const temVinculo = participantesRuraisOficial.some(p => p.imovelNome);
  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <div className="card-header">
        <h3 className="card-title">Participantes dos Imóveis</h3>
        <span className="badge badge-blue" title="Lida da declaração importada, não depende de cadastro nenhum feito no app">Da declaração original</span>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 0 }}>
        {temVinculo
          ? `A declaração lista ${participantesRuraisOficial.length} participante(s) de imóveis explorados em condomínio ou parceria, com o imóvel de cada um.`
          : `A declaração lista ${participantesRuraisOficial.length} participante(s) de imóveis explorados em condomínio ou parceria, mas o arquivo importado não indica a qual imóvel cada um se refere. Confira o vínculo na declaração original.`}
      </p>
      <div className="table-container">
        <table>
          <thead><tr><th>Nome</th><th>CPF</th>{temVinculo && <th>Imóvel</th>}</tr></thead>
          <tbody>
            {participantesRuraisOficial.map((p, i) => (
              <tr key={i}>
                <td>
                  {p.nome}
                  {descreverOrigemDocumento(p) && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{descreverOrigemDocumento(p)}</div>
                  )}
                </td>
                {/* Participante estrangeiro não tem CPF, e a ficha o imprime
                    sem documento. Deixar a célula vazia faria parecer dado
                    faltando na importação. */}
                <td>
                  {(() => {
                    const doc = descreverDocumentoParticipante(p);
                    return doc.estrangeiro
                      ? <span className="badge badge-orange">{doc.texto}</span>
                      : doc.texto;
                  })()}
                </td>
                {temVinculo && <td>{p.imovelNome || '-'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BensRuraisSection({ bensRurais, dispatch, addToast, anoCalendario, despacharEmAno }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBem, setEditingBem] = useState(null);
  const [anoModalOpen, setAnoModalOpen] = useState(false);
  const pendingActionRef = useRef(null);

  const abrirNovoBem = () => { setEditingBem(null); setModalOpen(true); };
  const handleNovoClick = () => {
    if (anoCalendario == null) { pendingActionRef.current = abrirNovoBem; setAnoModalOpen(true); return; }
    abrirNovoBem();
  };

  // Filtra a lista de origem antes de qualquer total/exportação/listagem derivada dela.
  const bensRuraisVisiveis = useMemo(
    () => bensRurais.filter(b => !bemZeradoSemMovimentacaoNoAno(b)),
    [bensRurais]
  );

  const handleSave = (bemPayload, anoAlvo) => {
    if (editingBem) {
      dispatch({ type: 'UPDATE_BEM_RURAL', payload: bemPayload });
      addToast('Bem atualizado com sucesso!', 'success');
    } else {
      despacharEmAno(anoAlvo, { type: 'ADD_BEM_RURAL', payload: bemPayload });
      addToast('Bem cadastrado com sucesso!', 'success');
    }
    setModalOpen(false);
    setEditingBem(null);
  };

  const handleDelete = (bem) => {
    const nome = (bem.discriminacao || 'este bem').substring(0, 60);
    if (confirm(`EXCLUIR "${nome}"?\n\nEsse bem sai do cadastro por completo, com todo o histórico de movimentações dele. Essa ação não pode ser desfeita.`)) {
      dispatch({ type: 'DELETE_BEM_RURAL', payload: bem.id });
      addToast('Bem excluído', 'info');
    }
  };

  const totalAtual = bensRuraisVisiveis.reduce((s, b) => s + (parseFloat(b.situacao_atual) || 0), 0);

  const handleExport = () => exportListaToXlsx(
    bensRuraisVisiveis,
    [
      ['Código', b => b.codigo || ''],
      ['Discriminação', b => b.discriminacao || ''],
      ['Situação Anterior', b => b.situacao_anterior || 0],
      ['Situação Atual', b => b.situacao_atual || 0],
      ['Variação', b => (b.situacao_atual || 0) - (b.situacao_anterior || 0)],
      ['Movimentações no Ano', b => resumoMovimentacoes(b)],
    ],
    'Bens da Atividade Rural', 'bens_atividade_rural', anoCalendario
  );

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{bensRuraisVisiveis.length} {bensRuraisVisiveis.length === 1 ? 'item' : 'itens'}, total {formatCurrency(totalAtual)}</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleExport}>Exportar .xlsx</button>
          <button className="btn btn-primary" onClick={handleNovoClick}>＋ Novo Bem</button>
        </div>
      </div>
      <div className="table-container">
        <table>
          <thead><tr><th>Código</th><th>Discriminação</th><th style={{ textAlign: 'right' }}>Situação Anterior</th><th style={{ textAlign: 'right' }}>Situação Atual</th><th>Ações</th></tr></thead>
          <tbody>
            {bensRuraisVisiveis.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhum bem cadastrado.</td></tr>
            ) : bensRuraisVisiveis.map(bem => (
              <tr key={bem.id}>
                <td>{bem.codigo}</td>
                <td style={{ maxWidth: '400px' }} title={bem.discriminacao || ''}>
                  {truncarComReticencias(bem.discriminacao, 100)}
                  {descreverOrigemDocumento(bem) && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{descreverOrigemDocumento(bem)}</div>
                  )}
                </td>
                <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(bem.situacao_anterior)}</td>
                <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(bem.situacao_atual)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => { setEditingBem(bem); setModalOpen(true); }}>Editar</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(bem)}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <BemRuralModal open={modalOpen} bem={editingBem} onSave={handleSave} onClose={() => { setModalOpen(false); setEditingBem(null); }} />
      <AnoCalendarioModal
        open={anoModalOpen}
        onClose={() => setAnoModalOpen(false)}
        onConfirm={() => { setAnoModalOpen(false); pendingActionRef.current?.(); pendingActionRef.current = null; }}
      />
    </>
  );
}

// Mesmo padrão de DividasPage.jsx, só que na coleção dividasRurais — sem o
// campo "Código" (as dívidas vinculadas à atividade rural, tanto no
// cadastro manual quanto na importação, não têm essa classificação por
// código como as dívidas comuns).
function DividasRuraisSection({ dividasRurais, dispatch, addToast, anoCalendario }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_DIVIDA_RURAL_VAZIO);

  const liveDivida = editingId ? dividasRurais.find(d => d.id === editingId) : null;
  const upd = (campo, valor) => setForm(p => ({ ...p, [campo]: valor }));

  const abrirNovo = () => { setEditingId(null); setForm(FORM_DIVIDA_RURAL_VAZIO); setModalOpen(true); };
  const abrirEdicao = (d) => {
    setEditingId(d.id);
    setForm({ discriminacao: d.discriminacao || '', situacao_anterior: '', situacao_atual: '', valor_pago: d.valor_pago || '' });
    setModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    const falta = primeiroCampoVazio([['Discriminação', form.discriminacao]]);
    if (falta) { addToast(mensagemObrigatorio(falta), 'error'); return; }
    if (editingId) {
      dispatch({ type: 'UPDATE_DIVIDA_RURAL', payload: { id: editingId, discriminacao: form.discriminacao, valor_pago: parseFloat(form.valor_pago) || 0 } });
      addToast('Dívida atualizada com sucesso!', 'success');
    } else {
      dispatch({
        type: 'ADD_DIVIDA_RURAL',
        payload: {
          discriminacao: form.discriminacao,
          situacao_anterior: parseFloat(form.situacao_anterior) || 0,
          situacao_atual: parseFloat(form.situacao_atual) || 0,
          valor_pago: parseFloat(form.valor_pago) || 0,
        },
      });
      addToast('Dívida cadastrada com sucesso!', 'success');
    }
    setModalOpen(false);
    setEditingId(null);
  };

  const handleDelete = (d) => {
    if (confirm(`EXCLUIR "${(d.discriminacao || 'esta dívida').substring(0, 60)}"?\n\nEssa ação não pode ser desfeita.`)) {
      dispatch({ type: 'DELETE_DIVIDA_RURAL', payload: d.id });
      addToast('Dívida excluída', 'info');
    }
  };

  const totalAnterior = dividasRurais.reduce((s, d) => s + (parseFloat(d.situacao_anterior) || 0), 0);
  const totalAtual = dividasRurais.reduce((s, d) => s + (parseFloat(d.situacao_atual) || 0), 0);

  const handleExport = () => exportListaToXlsx(
    dividasRurais,
    [
      ['Discriminação', d => d.discriminacao || ''],
      ['Situação Anterior', d => d.situacao_anterior || 0],
      ['Situação Atual', d => d.situacao_atual || 0],
      ['Valor Pago', d => d.valor_pago || 0],
      ['Movimentações no Ano', d => resumoMovimentacoes(d)],
    ],
    'Dívidas Vinculadas à Atividade Rural', 'dividas_atividade_rural', anoCalendario
  );

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{dividasRurais.length} {dividasRurais.length === 1 ? 'item' : 'itens'}</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleExport}>Exportar .xlsx</button>
          <button className="btn btn-primary" onClick={abrirNovo}>＋ Nova Dívida</button>
        </div>
      </div>
      <div className="table-container">
        <table>
          <thead><tr><th style={{ minWidth: '300px' }}>Discriminação</th><th style={{ textAlign: 'right' }}>Situação Anterior</th><th style={{ textAlign: 'right' }}>Situação Atual</th><th style={{ textAlign: 'right' }}>Valor Pago</th><th>Ações</th></tr></thead>
          <tbody>
            {dividasRurais.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhuma dívida cadastrada.</td></tr>
            ) : dividasRurais.map(d => (
              <tr key={d.id}>
                <td style={{ maxWidth: '400px' }} title={d.discriminacao || ''}>
                  {truncarComReticencias(d.discriminacao, 100)}
                  {descreverOrigemDocumento(d) && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{descreverOrigemDocumento(d)}</div>
                  )}
                </td>
                <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(d.situacao_anterior)}</td>
                <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(d.situacao_atual)}</td>
                <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(d.valor_pago)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => abrirEdicao(d)}>Editar</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(d)}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {dividasRurais.length > 0 && (
            <tfoot>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <td style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>TOTAIS</td>
                <td style={{ textAlign: 'right', fontWeight: 700, borderTop: '2px solid var(--border-color)' }} className="currency">{formatCurrency(totalAnterior)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, borderTop: '2px solid var(--border-color)' }} className="currency">{formatCurrency(totalAtual)}</td>
                <td style={{ borderTop: '2px solid var(--border-color)' }}></td>
                <td style={{ borderTop: '2px solid var(--border-color)' }}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="modal-header"><h3>{editingId ? 'Editar Dívida' : 'Nova Dívida'}</h3><button className="modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="form-group"><label>Discriminação</label><textarea className="form-control" value={form.discriminacao} onChange={e => upd('discriminacao', e.target.value)} /></div>
            {editingId && liveDivida ? (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Saldo em 31/12 Anterior (não editável aqui)</label>
                    <div className="form-control" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>{formatCurrency(liveDivida.situacao_anterior)}</div>
                  </div>
                  <div className="form-group">
                    <label>Saldo atual (muda por movimentação)</label>
                    <div className="form-control" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', fontWeight: 700 }}>{formatCurrency(liveDivida.situacao_atual)}</div>
                  </div>
                  <div className="form-group"><label>Valor Pago no Ano</label><MoneyInput value={form.valor_pago} onChange={v => upd('valor_pago', v)} /></div>
                </div>
                <MovimentacaoBemForm
                  bem={liveDivida}
                  actionType="REGISTRAR_MOVIMENTACAO_DIVIDA_RURAL"
                  tipos={MOVIMENTACAO_DIVIDA_TIPOS}
                  tipoInicial="amortizacao"
                  anoCalendario={anoCalendario}
                />
              </>
            ) : (
              <div className="form-row">
                <div className="form-group"><label>Situação 31/12 Anterior</label><MoneyInput value={form.situacao_anterior} onChange={v => upd('situacao_anterior', v)} /></div>
                <div className="form-group"><label>Situação 31/12 Atual</label><MoneyInput value={form.situacao_atual} onChange={v => upd('situacao_atual', v)} /></div>
                <div className="form-group"><label>Valor Pago no Ano</label><MoneyInput value={form.valor_pago} onChange={v => upd('valor_pago', v)} /></div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">{editingId ? 'Salvar Dados da Dívida' : 'Salvar'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function LancamentosRuraisSection({
  lancamentosRurais, dispatch, addToast, receitaTotal, despesaTotal, resultadoDoAno,
  anoCalendario, garantirAnoCadastro, despacharEmAno, receitasDespesasRuraisOficial = [],
  origemRural = { temOficial: false, mesesSubstituidos: [], mesesOficiaisMantidos: [] },
  resultadoConsolidado = 0,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_LANCAMENTO_VAZIO);
  const [anoModalOpen, setAnoModalOpen] = useState(false);
  const pendingActionRef = useRef(null);
  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  // Ano-calendário = ano da DATA do lançamento (campo separado tirado em
  // 03/09/2026). Lê os 4 primeiros caracteres do <input type="date">.
  const anoCadastro = /^\d{4}-\d{2}-\d{2}$/.test(form.data || '') ? Number(form.data.slice(0, 4)) : anoCalendario;

  const abrirNovo = () => { setEditingId(null); setForm(FORM_LANCAMENTO_VAZIO); setModalOpen(true); };
  const handleNovoClick = () => {
    if (anoCalendario == null) { pendingActionRef.current = abrirNovo; setAnoModalOpen(true); return; }
    abrirNovo();
  };
  const abrirEdicao = (l) => {
    setEditingId(l.id);
    setForm({ tipo: l.tipo, data: l.data || '', valor: l.valor, descricao: l.descricao || '' });
    setModalOpen(true);
  };
  const handleSave = async (e) => {
    e.preventDefault();
    const falta = primeiroCampoVazio([['Data', form.data], ['Descrição', form.descricao]])
      || primeiroValorZerado([['Valor', form.valor]]);
    if (falta) { addToast(mensagemObrigatorio(falta), 'error'); return; }
    const payload = { ...form, valor: parseFloat(form.valor) || 0 };
    if (editingId) {
      dispatch({ type: 'UPDATE_LANCAMENTO_RURAL', payload: { ...payload, id: editingId } });
      addToast('Lançamento atualizado!', 'success');
    } else {
      const anoAlvo = await garantirAnoCadastro(anoCadastro);
      if (!anoAlvo) return;
      despacharEmAno(anoAlvo, { type: 'ADD_LANCAMENTO_RURAL', payload });
      addToast('Lançamento cadastrado!', 'success');
    }
    setModalOpen(false);
  };
  const handleDelete = (l) => {
    if (confirm(`Excluir este lançamento (${formatCurrency(l.valor)})?\n\nEssa ação não pode ser desfeita.`)) {
      dispatch({ type: 'DELETE_LANCAMENTO_RURAL', payload: l.id });
      addToast('Lançamento excluído', 'info');
    }
  };

  const ordenados = [...lancamentosRurais].sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  const handleExport = () => exportListaToXlsx(
    ordenados,
    [
      ['Data', l => formatDate(l.data)],
      ['Tipo', l => (l.tipo === 'receita' ? 'Receita' : 'Despesa')],
      ['Descrição', l => l.descricao || ''],
      ['Valor', l => l.valor || 0],
    ],
    'Receitas e Despesas Rural', 'receitas_despesas_rural', anoCalendario
  );

  const totalReceitaOficial = receitasDespesasRuraisOficial.reduce((s, m) => s + m.receitaBruta, 0);
  const totalDespesaOficial = receitasDespesasRuraisOficial.reduce((s, m) => s + m.despesaCusteioInvestimento, 0);

  return (
    <>
      {receitasDespesasRuraisOficial.length > 0 && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h3 className="card-title">Receitas e Despesas Mensais</h3>
            <span className="badge badge-blue" title="Lida da declaração importada (.DBK ou PDF), não depende de lançamento nenhum feito no app">Da declaração original</span>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Mês</th><th style={{ textAlign: 'right' }}>Receita Bruta</th><th style={{ textAlign: 'right' }}>Despesa de Custeio/Investimento</th></tr></thead>
              <tbody>
                {receitasDespesasRuraisOficial.map(m => (
                  <tr key={m.mes}>
                    <td>{NOMES_MES[m.mes - 1] || m.mes}</td>
                    <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(m.receitaBruta)}</td>
                    <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(m.despesaCusteioInvestimento)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <td style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>TOTAL</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, borderTop: '2px solid var(--border-color)' }} className="currency">{formatCurrency(totalReceitaOficial)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, borderTop: '2px solid var(--border-color)' }} className="currency">{formatCurrency(totalDespesaOficial)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      {/* ACHADO 03 da auditoria de 24/08/2026. Estes três cards mostram o
          LIVRO-CAIXA MANUAL, e ficavam logo abaixo da tabela dos doze meses
          importados, sem dizer isso. O resultado era uma tela que se
          contradizia: "Resultado do Ano R$ 0,00 / Lucro" impresso embaixo de
          uma apuração que fecha em prejuízo de meio milhão. E, como qualquer
          lançamento manual descartava os doze meses inteiros, o número que o
          Dashboard usava mudava junto, sem aviso.
          Agora a precedência é por mês (ver resultadoAtividadeRuralPeriodo) e
          o card diz de onde vem cada pedaço. */}
      {origemRural.temOficial && (
        <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: '16px', fontSize: '12.5px' }}>
          {origemRural.mesesSubstituidos.length === 0 ? (
            <>Os cards abaixo somam só os lançamentos que você cadastrou à mão. Enquanto um mês não tiver lançamento manual, o Demonstrativo usa o mês correspondente da tabela acima, vinda da declaração.</>
          ) : origemRural.anoInteiroManual ? (
            <>Há lançamento manual sem data, então o Demonstrativo usa o livro-caixa manual para o ano inteiro e ignora a tabela acima. Informe a data dos lançamentos para voltar à substituição mês a mês.</>
          ) : (
            <>O Demonstrativo usa o seu livro-caixa em {origemRural.mesesSubstituidos.length === 1 ? 'um mês' : `${origemRural.mesesSubstituidos.length} meses`} ({origemRural.mesesSubstituidos.map(m => NOMES_MES[m - 1]).join(', ')}) e mantém a apuração da declaração nos outros {origemRural.mesesOficiaisMantidos.length}.</>
          )}
        </div>
      )}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card blue">
          <div className="stat-info"><h3>{formatCurrency(receitaTotal)}</h3><p>Receita Bruta Total {origemRural.temOficial && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(livro-caixa manual)</span>}</p></div>
        </div>
        <div className="stat-card orange">
          <div className="stat-info"><h3>{formatCurrency(despesaTotal)}</h3><p>Despesa de Custeio/Investimento {origemRural.temOficial && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(livro-caixa manual)</span>}</p></div>
        </div>
        <div className="stat-card green">
          <div className="stat-info">
            <h3>{formatCurrency(resultadoDoAno)}</h3>
            <p>Resultado do Ano {origemRural.temOficial && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(livro-caixa manual)</span>}</p>
            <span className={`stat-change ${resultadoDoAno >= 0 ? 'positive' : 'negative'}`}>{resultadoDoAno >= 0 ? 'Lucro' : 'Prejuízo'}</span>
          </div>
        </div>
      </div>
      {origemRural.temOficial && (
        <div style={{ marginBottom: '20px', fontSize: '13px' }}>
          <b>Resultado que o Demonstrativo usa neste ano: {formatCurrency(resultadoConsolidado)}</b>
          <span style={{ color: 'var(--text-secondary)' }}> (livro-caixa manual onde existe, apuração da declaração no resto)</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '12px' }}>
        <button className="btn btn-secondary" onClick={handleExport}>Exportar .xlsx</button>
        <button className="btn btn-primary" onClick={handleNovoClick}>＋ Novo Lançamento</button>
      </div>
      <div className="table-container">
        <table>
          <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th style={{ textAlign: 'right' }}>Valor</th><th>Ações</th></tr></thead>
          <tbody>
            {ordenados.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhum lançamento cadastrado.</td></tr>
            ) : ordenados.map(l => (
              <tr key={l.id}>
                <td>{formatDate(l.data)}</td>
                <td><span className={`badge badge-${l.tipo === 'receita' ? 'blue' : 'orange'}`}>{l.tipo === 'receita' ? 'Receita' : 'Despesa'}</span></td>
                <td>{l.descricao}</td>
                <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(l.valor)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => abrirEdicao(l)}>Editar</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(l)}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
            <div className="modal-header"><h3>{editingId ? 'Editar Lançamento' : 'Novo Lançamento'}</h3><button className="modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label>Tipo</label>
                    <select className="form-control" value={form.tipo} onChange={e => upd('tipo', e.target.value)}>
                      <option value="receita">Receita</option>
                      <option value="despesa">Despesa de Custeio/Investimento</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Data</label>
                    <input className="form-control" type="date" value={form.data} onChange={e => upd('data', e.target.value)} />
                  </div>
                  <div className="form-group"><label>Valor</label><MoneyInput value={form.valor} onChange={v => upd('valor', v)} /></div>
                </div>
                <div className="form-group"><label>Descrição</label><input className="form-control" value={form.descricao} onChange={e => upd('descricao', e.target.value)} placeholder="Ex: venda de milho, adubo, combustível..." /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button></div>
            </form>
      </Modal>
      <AnoCalendarioModal
        open={anoModalOpen}
        onClose={() => setAnoModalOpen(false)}
        onConfirm={anoConfirmado => { setAnoModalOpen(false); pendingActionRef.current?.(anoConfirmado); pendingActionRef.current = null; }}
      />
    </>
  );
}

function ResultadoSection({ receitaTotal, despesaTotal, resultadoDoAno, prejuizoRuralAcompensar, dispatch, addToast, apuracaoResultadoRuralOficial }) {
  const [valorCompensar, setValorCompensar] = useState('');

  const compensar = () => {
    const v = parseFloat(valorCompensar) || 0;
    if (v <= 0) { alert('Informe um valor maior que zero.'); return; }
    if (v > -prejuizoRuralAcompensar) { alert(`Você só tem ${formatCurrency(-prejuizoRuralAcompensar)} de prejuízo disponível para compensar.`); return; }
    dispatch({ type: 'AJUSTAR_PREJUIZO_RURAL', payload: v });
    addToast('Prejuízo compensado.', 'success');
    setValorCompensar('');
  };

  return (
    <>
      {apuracaoResultadoRuralOficial && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h3 className="card-title">Apuração do Resultado Oficial</h3>
            <span className="badge badge-blue" title="Lida da declaração importada (.DBK ou PDF), não depende de lançamento nenhum feito no app">Da declaração original</span>
          </div>
          {/* A opção pela forma de apuração muda o resultado tributável: pelo
              resultado do livro-caixa, ou pelo limite de 20% da receita bruta.
              Sem ela na tela, os números abaixo não se explicam. */}
          {apuracaoResultadoRuralOficial.opcaoApuracao && (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 0 }}>
              Opção pela forma de apuração do resultado: <strong>{apuracaoResultadoRuralOficial.opcaoApuracao}</strong>
            </p>
          )}
          <div className="stats-grid" style={{ marginBottom: 0 }}>
            <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Receita Bruta Total</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(apuracaoResultadoRuralOficial.receitaBrutaTotal)}</div>
            </div>
            <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Despesa Total</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(apuracaoResultadoRuralOficial.despesaTotal)}</div>
            </div>
            <div style={{ padding: '16px', background: apuracaoResultadoRuralOficial.resultado >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Resultado</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(apuracaoResultadoRuralOficial.resultado)}</div>
            </div>
            <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Prejuízo de Exercícios Anteriores</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(apuracaoResultadoRuralOficial.saldoPrejuizoExercicioAnterior)}</div>
            </div>
            <div style={{ padding: '16px', background: 'rgba(59,130,246,0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div style={{ fontSize: '11px', color: 'var(--accent-primary)', textTransform: 'uppercase', fontWeight: 600 }}>Resultado Tributável</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{formatCurrency(apuracaoResultadoRuralOficial.resultadoTributavel)}</div>
            </div>
            <div style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Prejuízo a Compensar no Ano Seguinte</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(apuracaoResultadoRuralOficial.saldoPrejuizoExercicioSeguinte)}</div>
            </div>
            {apuracaoResultadoRuralOficial.limite20PctReceitaBruta > 0 && (
              <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Limite de 20% da Receita Bruta</div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(apuracaoResultadoRuralOficial.limite20PctReceitaBruta)}</div>
              </div>
            )}
            {apuracaoResultadoRuralOficial.compensacaoPrejuizoAnterior > 0 && (
              <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Compensação de Prejuízo no Ano</div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(apuracaoResultadoRuralOficial.compensacaoPrejuizoAnterior)}</div>
              </div>
            )}
            {apuracaoResultadoRuralOficial.adiantamentoVendaFutura > 0 && (
              <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Adiantamento de Venda Futura Recebido no Ano</div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(apuracaoResultadoRuralOficial.adiantamentoVendaFutura)}</div>
              </div>
            )}
            {apuracaoResultadoRuralOficial.adiantamentoAnosAnteriores > 0 && (
              <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Adiantamento de Anos Anteriores</div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(apuracaoResultadoRuralOficial.adiantamentoAnosAnteriores)}</div>
              </div>
            )}
            {apuracaoResultadoRuralOficial.resultadoNaoTributavel > 0 && (
              <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Resultado Não Tributável</div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(apuracaoResultadoRuralOficial.resultadoNaoTributavel)}</div>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header"><h3 className="card-title">Apuração do Resultado</h3></div>
        <div className="stats-grid" style={{ marginBottom: 0 }}>
          <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Receita Bruta Total</div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(receitaTotal)}</div>
          </div>
          <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Despesa de Custeio/Investimento</div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(despesaTotal)}</div>
          </div>
          <div style={{ padding: '16px', background: resultadoDoAno >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Resultado do Ano</div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(resultadoDoAno)}</div>
          </div>
          <div style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Saldo de Prejuízo a Compensar</div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(prejuizoRuralAcompensar)}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="card-title">Compensar prejuízo de anos anteriores</h3></div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Prejuízo da atividade rural pode ser compensado com lucro de anos seguintes, sem limite de valor por ano (regra da atividade rural, diferente de renda variável). Informe aqui quanto você decidiu compensar neste ano-calendário; o saldo disponível é mostrado acima.
        </p>
        <div className="form-row" style={{ alignItems: 'end' }}>
          <div className="form-group">
            <label>Valor a compensar</label>
            <MoneyInput value={valorCompensar} onChange={setValorCompensar} disabled={prejuizoRuralAcompensar >= 0} />
          </div>
          <div className="form-group">
            <button type="button" className="btn btn-primary" onClick={compensar} disabled={prejuizoRuralAcompensar >= 0}>Compensar</button>
          </div>
        </div>
        {prejuizoRuralAcompensar >= 0 && <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Não há prejuízo acumulado para compensar.</p>}
      </div>
    </>
  );
}

// Nomes das espécies só são conhecidos com confiança para o código "01"
// (Bovinos e bufalinos, o único confirmado contra uma declaração real —
// ver HANDOFF-2026-08-20.md); qualquer outro código aparece cru na tela em
// vez de arriscar uma tradução inventada para um código nunca visto.
const ESPECIE_REBANHO_NOME = { '01': 'Bovinos e bufalinos' };
// O nome da espécie agora vem IMPRESSO na própria declaração (o parser o lê
// junto com as seis colunas). A tabela acima fica como retaguarda para o
// caminho .DBK, que só traz o código.
const nomeDaEspecie = (m) => m.especieNome || ESPECIE_REBANHO_NOME[m.especieCodigo] || `Espécie (código ${m.especieCodigo})`;
const formatCabecas = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Puramente informativo (igual impostoDevido/apuracaoGanhoCapital): mostra
// o que a PRÓPRIA declaração apurou, sem cadastro manual equivalente no
// app hoje.
function RebanhoSection({ movimentacaoRebanhoOficial }) {
  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <div className="card-header">
        <h3 className="card-title">Movimentação do Rebanho</h3>
        <span className="badge badge-blue" title="Lida da declaração importada, pelo PDF ou pelo arquivo .DBK, e não depende de lançamento nenhum feito no app">Da declaração original</span>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Espécie</th>
              <th style={{ textAlign: 'right' }}>Estoque Inicial</th>
              <th style={{ textAlign: 'right' }}>Aquisições</th>
              <th style={{ textAlign: 'right' }}>Nascimentos</th>
              <th style={{ textAlign: 'right' }}>Consumo e Perdas</th>
              <th style={{ textAlign: 'right' }}>Vendas</th>
              <th style={{ textAlign: 'right' }}>Estoque Final</th>
            </tr>
          </thead>
          <tbody>
            {movimentacaoRebanhoOficial.map((m, i) => (
              <tr key={i}>
                <td>
                  {nomeDaEspecie(m)}
                  {descreverOrigemDocumento(m) && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{descreverOrigemDocumento(m)}</div>
                  )}
                </td>
                <td style={{ textAlign: 'right' }} className="currency">{formatCabecas(m.estoqueInicial)}</td>
                <td style={{ textAlign: 'right' }} className="currency">{formatCabecas(m.aquisicoes)}</td>
                <td style={{ textAlign: 'right' }} className="currency">{formatCabecas(m.nascimentos)}</td>
                <td style={{ textAlign: 'right' }} className="currency">{formatCabecas(m.consumoPerdas)}</td>
                <td style={{ textAlign: 'right' }} className="currency">{formatCabecas(m.vendas)}</td>
                <td style={{ textAlign: 'right' }} className="currency">{formatCabecas(m.estoqueFinal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
