import { useState, useMemo } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, formatCpfCnpj, formatDate, describeRendimentoTipo, categoriaRendimento, CATEGORIAS_RENDIMENTO, RENDIMENTO_TIPOS_CONHECIDOS } from '../utils/formatters';
import Modal from '../components/Modal';

// Lista completa (26 códigos isentos + 14 de tributação exclusiva),
// conferida contra o manual oficial do programa IRPF2026 — ver
// RENDIMENTO_TIPOS_CONHECIDOS em formatters.js. Agrupada por categoria
// para o <select> não virar uma lista de 40 itens sem organização.
const TIPOS_CADASTRO_POR_CATEGORIA = Object.entries(RENDIMENTO_TIPOS_CONHECIDOS).reduce((acc, [tipo, label]) => {
  const cat = categoriaRendimento(tipo);
  (acc[cat] ||= []).push({ tipo, label });
  return acc;
}, {});

const FORM_VAZIO = { tipo: 'tributavel_pj', cnpj_fonte: '', nome_fonte: '', beneficiario: 'Titular', valor: '', irrf: '', data: new Date().toISOString().slice(0, 10) };

export default function RendimentosPage() {
  const { state, dispatch, addToast } = useData();
  const { rendimentos } = state;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const abrirNovo = () => { setEditingId(null); setForm(FORM_VAZIO); setModalOpen(true); };
  const abrirEdicao = (r) => {
    setEditingId(r.id);
    setForm({ tipo: r.tipo, cnpj_fonte: r.cnpj_fonte || '', nome_fonte: r.nome_fonte || '', beneficiario: r.beneficiario || 'Titular', valor: r.valor, irrf: r.irrf || '', data: r.data || new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    const payload = { ...form, valor: parseFloat(form.valor) || 0, irrf: parseFloat(form.irrf) || 0 };
    if (editingId) {
      dispatch({ type: 'UPDATE_RENDIMENTO', payload: { ...payload, id: editingId } });
      addToast('Rendimento atualizado!', 'success');
    } else {
      dispatch({ type: 'ADD_RENDIMENTO', payload });
      addToast('Rendimento cadastrado!', 'success');
    }
    setModalOpen(false);
  };

  const handleDelete = (r) => {
    const nome = r.nome_fonte || describeRendimentoTipo(r.tipo);
    if (confirm(`Excluir o rendimento "${nome}" (${formatCurrency(r.valor)})?\n\nEssa ação não pode ser desfeita.`)) {
      dispatch({ type: 'DELETE_RENDIMENTO', payload: r.id });
      addToast('Rendimento excluído', 'info');
    }
  };

  const porCategoria = useMemo(() => {
    const grupos = { tributavel: [], isento: [], exclusivo: [], outro: [] };
    for (const r of rendimentos) grupos[categoriaRendimento(r.tipo)].push(r);
    return grupos;
  }, [rendimentos]);

  const totalPorCategoria = (lista) => lista.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
  const totalIRRF = rendimentos.reduce((s, r) => s + (parseFloat(r.irrf) || 0), 0);

  return (
    <>
      <div className="page-header">
        <div className="page-header-left"><h2>Rendimentos</h2><p>{rendimentos.length} registros no ano-calendário {state.anoCalendario}</p></div>
        <div className="page-header-actions"><button className="btn btn-primary" onClick={abrirNovo}>＋ Novo Rendimento</button></div>
      </div>
      <div className="page-body animate-in">
        {rendimentos.length === 0 ? (
          <div className="empty-state">
            <h3>Nenhum rendimento cadastrado</h3>
            <p>Importe uma declaração .DBK ou clique em "Novo Rendimento".</p>
          </div>
        ) : (
          <>
            <div className="stats-grid" style={{ marginBottom: '24px' }}>
              {Object.entries(CATEGORIAS_RENDIMENTO).map(([key, meta]) => {
                const lista = porCategoria[key];
                if (lista.length === 0) return null;
                return (
                  <div key={key} style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{meta.label}</div>
                    <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(totalPorCategoria(lista))}</div>
                    <span className={`badge badge-${meta.cor}`}>{lista.length} {lista.length === 1 ? 'registro' : 'registros'}</span>
                  </div>
                );
              })}
              <div style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ fontSize: '11px', color: 'var(--accent-danger)', textTransform: 'uppercase', fontWeight: 600 }}>IRRF retido no total</div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(totalIRRF)}</div>
              </div>
            </div>

            {Object.entries(CATEGORIAS_RENDIMENTO).map(([key, meta]) => {
              const lista = porCategoria[key];
              if (lista.length === 0) return null;
              return (
                <div className="card" style={{ marginBottom: '16px' }} key={key}>
                  <div className="card-header">
                    <h3 className="card-title">{meta.label}</h3>
                    <span className={`badge badge-${meta.cor}`}>{formatCurrency(totalPorCategoria(lista))}</span>
                  </div>
                  <div className="table-container">
                    <table>
                      <thead><tr><th>Tipo</th><th>Data</th><th>CNPJ Fonte</th><th>Nome Fonte Pagadora</th><th>Beneficiário</th><th style={{ textAlign: 'right' }}>Valor</th><th style={{ textAlign: 'right' }}>IRRF</th><th>Ações</th></tr></thead>
                      <tbody>
                        {lista.map(r => (
                          <tr key={r.id}>
                            <td>{describeRendimentoTipo(r.tipo)}</td>
                            <td>{formatDate(r.data)}</td>
                            <td>{formatCpfCnpj(r.cnpj_fonte)}</td>
                            <td>{(r.nome_fonte || '').substring(0, 50)}</td>
                            <td>{r.beneficiario}</td>
                            <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(r.valor)}</td>
                            <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(r.irrf)}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button className="btn btn-sm btn-secondary" onClick={() => abrirEdicao(r)}>Editar</button>
                                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r)}>Excluir</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
            <div className="modal-header"><h3>{editingId ? 'Editar Rendimento' : 'Novo Rendimento'}</h3><button className="modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label>Tipo</label>
                    <select className="form-control" value={form.tipo} onChange={e => upd('tipo', e.target.value)}>
                      {Object.entries(CATEGORIAS_RENDIMENTO).map(([cat, meta]) => {
                        const opcoes = TIPOS_CADASTRO_POR_CATEGORIA[cat];
                        if (!opcoes || opcoes.length === 0) return null;
                        return (
                          <optgroup key={cat} label={meta.label}>
                            {opcoes.map(({ tipo, label }) => <option key={tipo} value={tipo}>{label}</option>)}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>
                  <div className="form-group"><label>Beneficiário</label>
                    <select className="form-control" value={form.beneficiario} onChange={e => upd('beneficiario', e.target.value)}>
                      <option>Titular</option><option>Dependente</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>CNPJ Fonte Pagadora</label><input className="form-control" value={form.cnpj_fonte} onChange={e => upd('cnpj_fonte', e.target.value)} /></div>
                  <div className="form-group"><label>Nome Fonte Pagadora</label><input className="form-control" value={form.nome_fonte} onChange={e => upd('nome_fonte', e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Data</label><input className="form-control" type="date" value={form.data} onChange={e => upd('data', e.target.value)} /></div>
                  <div className="form-group"><label>Valor</label><input className="form-control" type="number" step="0.01" value={form.valor} onChange={e => upd('valor', e.target.value)} /></div>
                  <div className="form-group"><label>IRRF</label><input className="form-control" type="number" step="0.01" value={form.irrf} onChange={e => upd('irrf', e.target.value)} /></div>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button></div>
            </form>
      </Modal>
    </>
  );
}
