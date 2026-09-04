import { useState, useMemo, useRef } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, formatCpfCnpj, mascaraCnpj, formatDate, describeRendimentoTipo, categoriaRendimento, CATEGORIAS_RENDIMENTO, RENDIMENTO_TIPOS_CONHECIDOS, descreverOrigemDocumento, codigosDoRendimento, colunasDaFontePagadora, descreverComunicacaoNaoResidente, descreverBeneficiarioRendimento, truncarComReticencias} from '../utils/formatters';
import Modal from '../components/Modal';
import AnoCalendarioModal from '../components/AnoCalendarioModal';
import MoneyInput from '../components/MoneyInput';
import TabelaRedimensionavel from '../components/TabelaRedimensionavel';
import { exportListaToXlsx } from '../utils/exportXlsx';
import { primeiroCampoVazio, primeiroValorZerado, mensagemObrigatorio } from '../utils/validacao';
import EstadoVazio from '../components/EstadoVazio';
import BadgeOrigem from '../components/BadgeOrigem';
import { correspondeFiltroOrigem, rotuloOrigemRegistro } from '../utils/origemRegistro';

// Lista completa (26 códigos isentos + 14 de tributação exclusiva),
// conferida contra o manual oficial do programa IRPF2026 — ver
// RENDIMENTO_TIPOS_CONHECIDOS em formatters.js. Agrupada por categoria
// para o <select> não virar uma lista de 40 itens sem organização.
const TIPOS_CADASTRO_POR_CATEGORIA = Object.entries(RENDIMENTO_TIPOS_CONHECIDOS).reduce((acc, [tipo, label]) => {
  const cat = categoriaRendimento(tipo);
  (acc[cat] ||= []).push({ tipo, label });
  return acc;
}, {});

// Data vazia por padrão: o ano-calendário sai dela; pré-preencher "hoje"
// forçaria trocar de ano ao salvar num exercício de trabalho diferente.
const FORM_VAZIO = { tipo: 'tributavel_pj', cnpj_fonte: '', nome_fonte: '', beneficiario: 'Titular', valor: '', irrf: '', data: '' };

export default function RendimentosPage() {
  const { state, dispatch, addToast, garantirAnoCadastro, despacharEmAno, confirmar } = useData();
  const { rendimentos } = state;
  // Aba por categoria (mesmo padrão de BensPage: "Todos" + uma por grupo) —
  // pedido da usuária pra não ficar uma lista contínua de cards empilhados.
  const [categoriaFilter, setCategoriaFilter] = useState('all');
  const [origemFilter, setOrigemFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [anoModalOpen, setAnoModalOpen] = useState(false);
  const pendingActionRef = useRef(null);
  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  // Ano-calendário = ano da DATA do rendimento (campo separado tirado em
  // 03/09/2026). Lê os 4 primeiros caracteres do <input type="date">.
  const anoCadastro = /^\d{4}-\d{2}-\d{2}$/.test(form.data || '') ? Number(form.data.slice(0, 4)) : state.anoCalendario;

  const abrirNovo = () => { setEditingId(null); setForm(FORM_VAZIO); setModalOpen(true); };
  const handleNovoClick = () => {
    if (state.anoCalendario == null) { pendingActionRef.current = abrirNovo; setAnoModalOpen(true); return; }
    abrirNovo();
  };
  const abrirEdicao = (r) => {
    setEditingId(r.id);
    setForm({ tipo: r.tipo, cnpj_fonte: r.cnpj_fonte || '', nome_fonte: r.nome_fonte || '', beneficiario: r.beneficiario || 'Titular', valor: r.valor, irrf: r.irrf || '', data: r.data || '' });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const falta = primeiroCampoVazio([['Tipo', form.tipo], ['Nome Fonte Pagadora', form.nome_fonte]])
      || primeiroValorZerado([['Valor', form.valor]]);
    if (falta) { addToast(mensagemObrigatorio(falta), 'error'); return; }
    const payload = { ...form, valor: parseFloat(form.valor) || 0, irrf: parseFloat(form.irrf) || 0 };
    if (editingId) {
      dispatch({ type: 'UPDATE_RENDIMENTO', payload: { ...payload, id: editingId } });
      addToast('Rendimento atualizado!', 'success');
    } else {
      const anoAlvo = await garantirAnoCadastro(anoCadastro);
      if (!anoAlvo) return;
      despacharEmAno(anoAlvo, { type: 'ADD_RENDIMENTO', payload });
      addToast('Rendimento cadastrado!', 'success');
    }
    setModalOpen(false);
  };

  const handleDelete = async (r) => {
    const nome = r.nome_fonte || describeRendimentoTipo(r.tipo);
    if (await confirmar({ titulo: 'Excluir este rendimento?', textoConfirmar: 'Excluir', perigo: true, texto: `O rendimento "${nome}" (${formatCurrency(r.valor)}) será removido.\n\nEssa ação não pode ser desfeita.` })) {
      dispatch({ type: 'DELETE_RENDIMENTO', payload: r.id });
      addToast('Rendimento excluído', 'info');
    }
  };

  const rendimentosOrigem = useMemo(() => rendimentos.filter(r => correspondeFiltroOrigem(r, origemFilter)), [rendimentos, origemFilter]);
  const porCategoria = useMemo(() => {
    const grupos = { tributavel: [], isento: [], exclusivo: [], outro: [] };
    for (const r of rendimentosOrigem) grupos[categoriaRendimento(r.tipo)].push(r);
    return grupos;
  }, [rendimentosOrigem]);

  const totalPorCategoria = (lista) => lista.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
  const totalIRRF = rendimentosOrigem.reduce((s, r) => s + (parseFloat(r.irrf) || 0), 0);

  const filtrados = categoriaFilter === 'all' ? rendimentosOrigem : porCategoria[categoriaFilter];

  const handleExport = () => exportListaToXlsx(
    rendimentosOrigem,
    [
      ['Origem', r => rotuloOrigemRegistro(r)],
      ['Tipo', r => describeRendimentoTipo(r.tipo)],
      ['Data', r => formatDate(r.data)],
      ['CNPJ Fonte', r => formatCpfCnpj(r.cnpj_fonte)],
      ['Nome Fonte Pagadora', r => r.nome_fonte || ''],
      ['Beneficiário', r => r.beneficiario || 'Titular'],
      ['CPF do dependente', r => formatCpfCnpj(r.cpf_dependente) || ''],
      ['Valor', r => r.valor || 0],
      ['IRRF', r => r.irrf || 0],
      // As três colunas restantes da ficha de pessoa jurídica. Só ela as tem,
      // então ficam zeradas nas demais linhas — mas sem elas a planilha
      // exportada esconderia o 13º salário e a previdência oficial que a tela
      // mostra. Ver colunasDaFontePagadora.
      ['Contribuição previdenciária oficial', r => r.contribuicaoPrevidenciaria || 0],
      ['13º salário (tributação exclusiva)', r => r.decimoTerceiro || 0],
      ['IRRF sobre o 13º salário', r => r.irrfDecimoTerceiro || 0],
    ],
    'Rendimentos', 'rendimentos', state.anoCalendario
  );

  return (
    <>
      <div className="page-header">
        <div className="page-header-left"><h2>Rendimentos</h2><p>{rendimentos.length} registro(s){state.anoCalendario != null ? ` no ano-calendário ${state.anoCalendario}` : ''}</p></div>
        <div className="page-header-actions">
          <select className="form-control filtro-origem" aria-label="Filtrar por origem" value={origemFilter} onChange={e => setOrigemFilter(e.target.value)}><option value="all">Todas as origens</option><option value="importacao">Declaração</option><option value="manual">Manual</option></select>
          <button className="btn btn-secondary" onClick={handleExport}>Exportar .xlsx</button>
          <button className="btn btn-primary" onClick={handleNovoClick}>＋ Novo Rendimento</button>
        </div>
      </div>
      <div className="page-body animate-in">
        {rendimentos.length === 0 ? (
          <EstadoVazio titulo="Nenhum rendimento cadastrado" contexto="Cadastre o primeiro rendimento ou importe uma declaração para preencher esta ficha." acao="Cadastrar primeiro rendimento" onAcao={handleNovoClick} />
        ) : (
          <>
            <div className="grade-quatro-contexto">
              <div className="stats-grid stats-grid-quatro" style={{ marginBottom: '24px' }}>
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
            </div>

            <div className="tabs" style={{ marginBottom: '20px' }}>
              <button className={`tab ${categoriaFilter === 'all' ? 'active' : ''}`} onClick={() => setCategoriaFilter('all')}>Todos</button>
              {Object.entries(CATEGORIAS_RENDIMENTO).map(([key, meta]) => {
                if (porCategoria[key].length === 0) return null;
                return (
                  <button key={key} className={`tab ${categoriaFilter === key ? 'active' : ''}`} onClick={() => setCategoriaFilter(key)}>
                    {meta.label} ({porCategoria[key].length})
                  </button>
                );
              })}
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">{categoriaFilter === 'all' ? 'Todos os Rendimentos' : CATEGORIAS_RENDIMENTO[categoriaFilter].label}</h3>
                <span className={`badge badge-${categoriaFilter === 'all' ? 'blue' : CATEGORIAS_RENDIMENTO[categoriaFilter].cor}`}>{formatCurrency(totalPorCategoria(filtrados))}</span>
              </div>
              <TabelaRedimensionavel persistKey="rendimentos" stickyRightColumns={3}>
                <table className="tabela-acoes-fixas">
                  <thead><tr><th>Tipo</th><th>Data</th><th>CNPJ Fonte</th><th>Nome Fonte Pagadora</th><th>Beneficiário</th><th style={{ textAlign: 'right' }}>Valor</th><th style={{ textAlign: 'right' }}>IRRF</th><th>Ações</th></tr></thead>
                  <tbody>
                    {filtrados.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhum rendimento nesta categoria.</td></tr>
                    ) : filtrados.map(r => (
                      <tr key={r.id}>
                        <td>
                          {describeRendimentoTipo(r.tipo)}
                          {/* O número que a pessoa procura na ficha em PAPEL. Ele
                              diverge do código interno do arquivo desde que a Lei
                              14.754/2023 e os prêmios de loteria renumeraram a
                              ficha de tributação exclusiva. Ver codigosDoRendimento. */}
                          {(() => {
                            const c = codigosDoRendimento(r);
                            if (!c) return null;
                            return (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Linha {c.naFichaImpressa} da ficha impressa
                                {c.divergem && (
                                  <span title="O arquivo da declaração grava um código interno diferente do número impresso na ficha. Os dois estão certos: procure pelo número impresso no papel.">
                                    {` (código ${c.interno} no arquivo)`}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td>{formatDate(r.data)}</td>
                        <td>{formatCpfCnpj(r.cnpj_fonte)}</td>
                        <td title={r.nome_fonte || ''}>
                          {truncarComReticencias(r.nome_fonte, 50)}
                          <div><BadgeOrigem item={r} /></div>
                          {descreverComunicacaoNaoResidente(r) && (
                            <div style={{ fontSize: '11px', color: 'var(--accent-warning)' }} title="A partir dessa data a fonte pagadora deixa de aplicar a tabela do residente. Não é a mesma data da caracterização da condição de não residente, que fica no quadro da saída definitiva.">
                              {descreverComunicacaoNaoResidente(r)}
                            </div>
                          )}
                          {descreverOrigemDocumento(r) && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{descreverOrigemDocumento(r)}</div>
                          )}
                        </td>
                        <td>
                          {(() => {
                            const b = descreverBeneficiarioRendimento(r, state.dependentes);
                            return (
                              <>
                                {b.rotulo}
                                {b.detalhe && (
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{b.detalhe}</div>
                                )}
                              </>
                            );
                          })()}
                        </td>
                        <td style={{ textAlign: 'right' }} className="currency">
                          {formatCurrency(r.valor)}
                          {/* As outras colunas da ficha de pessoa jurídica.
                              Ficam sob o valor, e não em colunas próprias,
                              porque só a ficha de PJ as tem: como coluna,
                              ficariam vazias em toda a tabela. Cada uma diz o
                              que é ao passar o mouse, para o 13º não ser
                              somado ao valor da linha. Ver
                              colunasDaFontePagadora. */}
                          {colunasDaFontePagadora(r).map(c => (
                            <div key={c.chave} title={c.nota} style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
                              {c.rotulo}: {formatCurrency(c.valor)}
                            </div>
                          ))}
                        </td>
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
              </TabelaRedimensionavel>
            </div>
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
                  <div className="form-group"><label>CNPJ Fonte Pagadora</label><input className="form-control" inputMode="numeric" placeholder="00.000.000/0000-00" value={mascaraCnpj(form.cnpj_fonte)} onChange={e => upd('cnpj_fonte', mascaraCnpj(e.target.value))} /></div>
                  <div className="form-group"><label>Nome Fonte Pagadora</label><input className="form-control" value={form.nome_fonte} onChange={e => upd('nome_fonte', e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Data</label>
                    <input className="form-control" type="date" value={form.data} onChange={e => upd('data', e.target.value)} />
                  </div>
                  <div className="form-group"><label>Valor</label><MoneyInput value={form.valor} onChange={v => upd('valor', v)} /></div>
                  <div className="form-group"><label>IRRF</label><MoneyInput value={form.irrf} onChange={v => upd('irrf', v)} /></div>
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
