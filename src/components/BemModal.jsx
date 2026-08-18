import { useState } from 'react';
import { useData } from '../store/DataContext';
import { GRUPOS_BENS, CODIGOS_IMOVEL, CODIGOS_VEICULO, formatCurrency, formatDate, MOVIMENTACAO_TIPOS } from '../utils/formatters';

export default function BemModal({ bem, onSave, onClose }) {
  const { state, dispatch, addToast } = useData();
  const isEditing = !!bem;
  // O valor atual muda por movimentação, não pelo formulário principal —
  // sempre ler do estado vivo, não do snapshot capturado na abertura do
  // modal, senão salvar o formulário depois de uma movimentação desfaria o
  // efeito dela.
  const liveBem = isEditing ? (state.bens.find(b => b.id === bem.id) || bem) : null;

  const [movTipo, setMovTipo] = useState('venda_parcial');
  const [movValor, setMovValor] = useState('');
  const [movData, setMovData] = useState(new Date().toISOString().slice(0, 10));
  const [movDescricao, setMovDescricao] = useState('');

  const handleRegistrarMovimentacao = () => {
    const valor = parseFloat(movValor) || 0;
    if (!['venda_total', 'baixa'].includes(movTipo) && valor <= 0) {
      alert('Informe um valor maior que zero para essa movimentação.');
      return;
    }
    dispatch({
      type: 'REGISTRAR_MOVIMENTACAO_BEM',
      payload: { bemId: bem.id, movimentacao: { tipo: movTipo, valor, data: movData, descricao: movDescricao } },
    });
    addToast('Movimentação registrada.', 'success');
    setMovValor('');
    setMovDescricao('');
  };

  const [form, setForm] = useState(bem || {
    grupo: '01',
    codigo_bem: '',
    discriminacao: '',
    situacao_anterior: '',
    situacao_atual: '',
    localizacao: '105',
    cnpj: '',
    inscricao_municipal: '',
    cib: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    uf: '',
    municipio: '',
    cep: '',
    registrado_cartorio: 'Sim',
    matricula: '',
    nome_cartorio: '',
    area_total: '',
    data_aquisicao: '',
    renavam: '',
    beneficiario: 'Titular',
  });

  const upd = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      // Em edição, o valor só muda por movimentação registrada (abaixo);
      // salvar o formulário principal não pode reverter isso, então usa o
      // valor vivo do estado, não o que o formulário carregava na abertura.
      situacao_anterior: isEditing ? liveBem.situacao_anterior : (parseFloat(form.situacao_anterior) || 0),
      situacao_atual: isEditing ? liveBem.situacao_atual : (parseFloat(form.situacao_atual) || 0),
      movimentacoes: isEditing ? liveBem.movimentacoes : undefined,
    });
  };

  const isImovel = form.grupo === '01';
  const isVeiculo = form.grupo === '02';
  const isParticipacao = form.grupo === '03';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <h3>{bem ? 'Editar Bem' : 'Novo Bem ou Direito'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label>Grupo</label>
                <select className="form-control" value={form.grupo} onChange={e => upd('grupo', e.target.value)}>
                  {GRUPOS_BENS.map(g => <option key={g.codigo} value={g.codigo}>{g.codigo} - {g.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Código do Bem</label>
                {isImovel ? (
                  <select className="form-control" value={form.codigo_bem} onChange={e => upd('codigo_bem', e.target.value)}>
                    <option value="">Selecione...</option>
                    {CODIGOS_IMOVEL.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} - {c.nome}</option>)}
                  </select>
                ) : isVeiculo ? (
                  <select className="form-control" value={form.codigo_bem} onChange={e => upd('codigo_bem', e.target.value)}>
                    <option value="">Selecione...</option>
                    {CODIGOS_VEICULO.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} - {c.nome}</option>)}
                  </select>
                ) : (
                  <input className="form-control" value={form.codigo_bem} onChange={e => upd('codigo_bem', e.target.value)} placeholder="Ex: 01, 02, 99" />
                )}
              </div>
              <div className="form-group">
                <label>Beneficiário</label>
                <select className="form-control" value={form.beneficiario} onChange={e => upd('beneficiario', e.target.value)}>
                  <option value="Titular">Titular</option>
                  <option value="Dependente">Dependente</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Discriminação</label>
              <textarea className="form-control" rows={3} value={form.discriminacao} onChange={e => upd('discriminacao', e.target.value)}
                placeholder="Descrição detalhada do bem conforme declaração IRPF..." />
            </div>

            {isEditing ? (
              <div className="form-row">
                <div className="form-group">
                  <label>Situação anterior (não editável aqui)</label>
                  <div className="form-control" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>{formatCurrency(liveBem.situacao_anterior)}</div>
                </div>
                <div className="form-group">
                  <label>Situação atual (não editável aqui)</label>
                  <div className="form-control" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', fontWeight: 700 }}>{formatCurrency(liveBem.situacao_atual)}</div>
                </div>
                <div className="form-group">
                  <label>CNPJ</label>
                  <input className="form-control" value={form.cnpj} onChange={e => upd('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
                </div>
              </div>
            ) : (
              <div className="form-row">
                <div className="form-group">
                  <label>Situação em 31/12 (Ano Anterior)</label>
                  <input className="form-control" type="number" step="0.01" value={form.situacao_anterior} onChange={e => upd('situacao_anterior', e.target.value)} placeholder="0,00" />
                </div>
                <div className="form-group">
                  <label>Situação em 31/12 (Ano Atual)</label>
                  <input className="form-control" type="number" step="0.01" value={form.situacao_atual} onChange={e => upd('situacao_atual', e.target.value)} placeholder="0,00" />
                </div>
                <div className="form-group">
                  <label>CNPJ</label>
                  <input className="form-control" value={form.cnpj} onChange={e => upd('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
                </div>
              </div>
            )}

            {isEditing && (
              <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                  Registrar movimentação
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 0, marginBottom: '12px' }}>
                  Vendeu parte, vendeu tudo, comprou mais, fez uma benfeitoria? Registre aqui: o valor atual do bem é recalculado a partir da movimentação, e fica guardado o motivo de cada mudança de valor.
                </p>
                <div className="form-row">
                  <div className="form-group">
                    <label>Tipo de movimentação</label>
                    <select className="form-control" value={movTipo} onChange={e => setMovTipo(e.target.value)}>
                      {Object.entries(MOVIMENTACAO_TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', marginBottom: 0 }}>
                      {MOVIMENTACAO_TIPOS[movTipo].ajuda}
                    </p>
                  </div>
                  <div className="form-group">
                    <label>Data</label>
                    <input className="form-control" type="date" value={movData} onChange={e => setMovData(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>{movTipo === 'ajuste' ? 'Novo valor' : 'Valor da movimentação'}</label>
                    <input
                      className="form-control" type="number" step="0.01" value={movValor}
                      onChange={e => setMovValor(e.target.value)}
                      placeholder="0,00"
                      disabled={movTipo === 'venda_total' || movTipo === 'baixa'}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Descrição da movimentação</label>
                  <input className="form-control" value={movDescricao} onChange={e => setMovDescricao(e.target.value)} placeholder="Ex: venda de 1/3 do imóvel para fulano, reforma da cozinha..." />
                </div>
                <button type="button" className="btn btn-sm btn-primary" onClick={handleRegistrarMovimentacao}>
                  ✅ Registrar movimentação
                </button>

                {(liveBem.movimentacoes || []).length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Movimentações já registradas
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {[...liveBem.movimentacoes].reverse().map(m => (
                        <div key={m.id} style={{ fontSize: '12px', padding: '8px 10px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                          <strong>{MOVIMENTACAO_TIPOS[m.tipo]?.label || m.tipo}</strong>
                          {' '}em {formatDate(m.data)}
                          {m.valor > 0 && <>, {formatCurrency(m.valor)}</>}
                          {m.descricao && <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{m.descricao}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isImovel && (
              <>
                <div style={{ padding: '8px 0 4px', fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Dados do Imóvel
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Inscrição Municipal (IPTU)</label><input className="form-control" value={form.inscricao_municipal} onChange={e => upd('inscricao_municipal', e.target.value)} /></div>
                  <div className="form-group"><label>CIB (Rural)</label><input className="form-control" value={form.cib} onChange={e => upd('cib', e.target.value)} /></div>
                  <div className="form-group"><label>Data Aquisição</label><input className="form-control" type="date" value={form.data_aquisicao} onChange={e => upd('data_aquisicao', e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Logradouro</label><input className="form-control" value={form.logradouro} onChange={e => upd('logradouro', e.target.value)} /></div>
                  <div className="form-group"><label>Número</label><input className="form-control" value={form.numero} onChange={e => upd('numero', e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Bairro</label><input className="form-control" value={form.bairro} onChange={e => upd('bairro', e.target.value)} /></div>
                  <div className="form-group"><label>UF</label><input className="form-control" value={form.uf} onChange={e => upd('uf', e.target.value)} maxLength={2} /></div>
                  <div className="form-group"><label>Município</label><input className="form-control" value={form.municipio} onChange={e => upd('municipio', e.target.value)} /></div>
                  <div className="form-group"><label>CEP</label><input className="form-control" value={form.cep} onChange={e => upd('cep', e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Matrícula</label><input className="form-control" value={form.matricula} onChange={e => upd('matricula', e.target.value)} /></div>
                  <div className="form-group"><label>Cartório</label><input className="form-control" value={form.nome_cartorio} onChange={e => upd('nome_cartorio', e.target.value)} /></div>
                  <div className="form-group"><label>Área Total</label><input className="form-control" value={form.area_total} onChange={e => upd('area_total', e.target.value)} placeholder="Ex: 640,0 m²" /></div>
                </div>
              </>
            )}

            {isVeiculo && (
              <>
                <div style={{ padding: '8px 0 4px', fontSize: '12px', fontWeight: 600, color: 'var(--accent-success)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Dados do Veículo
                </div>
                <div className="form-row">
                  <div className="form-group"><label>RENAVAM</label><input className="form-control" value={form.renavam} onChange={e => upd('renavam', e.target.value)} /></div>
                  <div className="form-group"><label>Data Aquisição</label><input className="form-control" type="date" value={form.data_aquisicao} onChange={e => upd('data_aquisicao', e.target.value)} /></div>
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">💾 Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}