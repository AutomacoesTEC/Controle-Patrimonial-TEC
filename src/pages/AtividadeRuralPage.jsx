import { useState } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import BemRuralModal from '../components/BemRuralModal';
import Modal from '../components/Modal';

const FORM_IMOVEL_VAZIO = { nomeLocalizacao: '', area: '', participacao: '100', condicaoExploracao: '', codigoAtividade: '', cib: '' };
const FORM_LANCAMENTO_VAZIO = { tipo: 'receita', data: new Date().toISOString().slice(0, 10), valor: '', descricao: '' };

export default function AtividadeRuralPage() {
  const { state, dispatch, addToast } = useData();
  const { imoveisRurais, bensRurais, lancamentosRurais, prejuizoRuralAcompensar } = state;
  const [subView, setSubView] = useState('imoveis');

  const receitaTotal = lancamentosRurais.filter(l => l.tipo === 'receita').reduce((s, l) => s + (parseFloat(l.valor) || 0), 0);
  const despesaTotal = lancamentosRurais.filter(l => l.tipo === 'despesa').reduce((s, l) => s + (parseFloat(l.valor) || 0), 0);
  const resultadoDoAno = receitaTotal - despesaTotal;

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Atividade Rural</h2>
          <p>Imóveis explorados, bens, receitas/despesas e resultado. Ficha própria da declaração, separada de Bens e Direitos.</p>
        </div>
      </div>
      <div className="page-body animate-in">
        <div className="tabs" style={{ marginBottom: '20px' }}>
          <button className={`tab ${subView === 'imoveis' ? 'active' : ''}`} onClick={() => setSubView('imoveis')}>Imóveis Explorados</button>
          <button className={`tab ${subView === 'bens' ? 'active' : ''}`} onClick={() => setSubView('bens')}>Bens da Atividade Rural</button>
          <button className={`tab ${subView === 'lancamentos' ? 'active' : ''}`} onClick={() => setSubView('lancamentos')}>Receitas e Despesas</button>
          <button className={`tab ${subView === 'resultado' ? 'active' : ''}`} onClick={() => setSubView('resultado')}>Resultado</button>
        </div>

        {subView === 'imoveis' && <ImoveisRuraisSection imoveisRurais={imoveisRurais} dispatch={dispatch} addToast={addToast} />}
        {subView === 'bens' && <BensRuraisSection bensRurais={bensRurais} dispatch={dispatch} addToast={addToast} />}
        {subView === 'lancamentos' && (
          <LancamentosRuraisSection
            lancamentosRurais={lancamentosRurais} dispatch={dispatch} addToast={addToast}
            receitaTotal={receitaTotal} despesaTotal={despesaTotal} resultadoDoAno={resultadoDoAno}
          />
        )}
        {subView === 'resultado' && (
          <ResultadoSection
            receitaTotal={receitaTotal} despesaTotal={despesaTotal} resultadoDoAno={resultadoDoAno}
            prejuizoRuralAcompensar={prejuizoRuralAcompensar} dispatch={dispatch} addToast={addToast}
          />
        )}
      </div>
    </>
  );
}

function ImoveisRuraisSection({ imoveisRurais, dispatch, addToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_IMOVEL_VAZIO);
  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const abrirNovo = () => { setEditingId(null); setForm(FORM_IMOVEL_VAZIO); setModalOpen(true); };
  const abrirEdicao = (i) => {
    setEditingId(i.id);
    setForm({ nomeLocalizacao: i.nomeLocalizacao || '', area: i.area || '', participacao: i.participacao ?? '100', condicaoExploracao: i.condicaoExploracao || '', codigoAtividade: i.codigoAtividade || '', cib: i.cib || '' });
    setModalOpen(true);
  };
  const handleSave = (e) => {
    e.preventDefault();
    const payload = { ...form, area: parseFloat(form.area) || 0, participacao: parseFloat(form.participacao) || 0 };
    if (editingId) {
      dispatch({ type: 'UPDATE_IMOVEL_RURAL', payload: { ...payload, id: editingId } });
      addToast('Imóvel atualizado!', 'success');
    } else {
      dispatch({ type: 'ADD_IMOVEL_RURAL', payload });
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

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button className="btn btn-primary" onClick={abrirNovo}>＋ Novo Imóvel</button>
      </div>
      <div className="table-container">
        <table>
          <thead><tr><th>Nome e Localização</th><th>Área (ha)</th><th>Participação (%)</th><th>Condição</th><th>Código Atividade</th><th>CIB</th><th>Ações</th></tr></thead>
          <tbody>
            {imoveisRurais.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhum imóvel cadastrado.</td></tr>
            ) : imoveisRurais.map(i => (
              <tr key={i.id}>
                <td>{i.nomeLocalizacao}</td>
                <td>{i.area}</td>
                <td>{i.participacao}</td>
                <td>{i.condicaoExploracao}</td>
                <td>{i.codigoAtividade}</td>
                <td>{i.cib}</td>
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
                <div className="form-group"><label>Nome e Localização</label><input className="form-control" value={form.nomeLocalizacao} onChange={e => upd('nomeLocalizacao', e.target.value)} placeholder="Ex: nome da fazenda, Cidade Exemplo" /></div>
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
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Código da Atividade e Condição de Exploração ficam como número livre: não temos essas duas tabelas conferidas em fonte oficial ainda, então preencha com o código que você já usa na declaração.
                </p>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button></div>
            </form>
      </Modal>
    </>
  );
}

function BensRuraisSection({ bensRurais, dispatch, addToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBem, setEditingBem] = useState(null);

  const handleSave = (bemPayload) => {
    if (editingBem) {
      dispatch({ type: 'UPDATE_BEM_RURAL', payload: bemPayload });
      addToast('Bem atualizado com sucesso!', 'success');
    } else {
      dispatch({ type: 'ADD_BEM_RURAL', payload: bemPayload });
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

  const totalAtual = bensRurais.reduce((s, b) => s + (parseFloat(b.situacao_atual) || 0), 0);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{bensRurais.length} itens, total {formatCurrency(totalAtual)}</p>
        <button className="btn btn-primary" onClick={() => { setEditingBem(null); setModalOpen(true); }}>＋ Novo Bem</button>
      </div>
      <div className="table-container">
        <table>
          <thead><tr><th>Código</th><th>Discriminação</th><th style={{ textAlign: 'right' }}>Situação Anterior</th><th style={{ textAlign: 'right' }}>Situação Atual</th><th>Ações</th></tr></thead>
          <tbody>
            {bensRurais.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhum bem cadastrado.</td></tr>
            ) : bensRurais.map(bem => (
              <tr key={bem.id}>
                <td>{bem.codigo}</td>
                <td style={{ maxWidth: '400px' }}>{(bem.discriminacao || '').substring(0, 100)}</td>
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
    </>
  );
}

function LancamentosRuraisSection({ lancamentosRurais, dispatch, addToast, receitaTotal, despesaTotal, resultadoDoAno }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_LANCAMENTO_VAZIO);
  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const abrirNovo = () => { setEditingId(null); setForm(FORM_LANCAMENTO_VAZIO); setModalOpen(true); };
  const abrirEdicao = (l) => {
    setEditingId(l.id);
    setForm({ tipo: l.tipo, data: l.data || '', valor: l.valor, descricao: l.descricao || '' });
    setModalOpen(true);
  };
  const handleSave = (e) => {
    e.preventDefault();
    const payload = { ...form, valor: parseFloat(form.valor) || 0 };
    if (editingId) {
      dispatch({ type: 'UPDATE_LANCAMENTO_RURAL', payload: { ...payload, id: editingId } });
      addToast('Lançamento atualizado!', 'success');
    } else {
      dispatch({ type: 'ADD_LANCAMENTO_RURAL', payload });
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

  return (
    <>
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card blue">
          <div className="stat-info"><h3>{formatCurrency(receitaTotal)}</h3><p>Receita Bruta Total</p></div>
        </div>
        <div className="stat-card orange">
          <div className="stat-info"><h3>{formatCurrency(despesaTotal)}</h3><p>Despesa de Custeio/Investimento</p></div>
        </div>
        <div className="stat-card green">
          <div className="stat-info">
            <h3>{formatCurrency(resultadoDoAno)}</h3>
            <p>Resultado do Ano</p>
            <span className={`stat-change ${resultadoDoAno >= 0 ? 'positive' : 'negative'}`}>{resultadoDoAno >= 0 ? 'Lucro' : 'Prejuízo'}</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button className="btn btn-primary" onClick={abrirNovo}>＋ Novo Lançamento</button>
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
                  <div className="form-group"><label>Data</label><input className="form-control" type="date" value={form.data} onChange={e => upd('data', e.target.value)} /></div>
                  <div className="form-group"><label>Valor</label><input className="form-control" type="number" step="0.01" value={form.valor} onChange={e => upd('valor', e.target.value)} /></div>
                </div>
                <div className="form-group"><label>Descrição</label><input className="form-control" value={form.descricao} onChange={e => upd('descricao', e.target.value)} placeholder="Ex: venda de milho, adubo, combustível..." /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button></div>
            </form>
      </Modal>
    </>
  );
}

function ResultadoSection({ receitaTotal, despesaTotal, resultadoDoAno, prejuizoRuralAcompensar, dispatch, addToast }) {
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
            <input className="form-control" type="number" step="0.01" value={valorCompensar} onChange={e => setValorCompensar(e.target.value)} placeholder="0,00" disabled={prejuizoRuralAcompensar >= 0} />
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
