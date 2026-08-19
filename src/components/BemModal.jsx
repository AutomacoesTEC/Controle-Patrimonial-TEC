import { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { GRUPOS_BENS, CODIGOS_POR_GRUPO, formatCurrency } from '../utils/formatters';
import MovimentacaoBemForm from './MovimentacaoBemForm';
import Modal from './Modal';
import MoneyInput from './MoneyInput';

const FORM_VAZIO = {
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
};

export default function BemModal({ open, bem, onSave, onClose }) {
  const { state, garantirAnoCadastro } = useData();
  const isEditing = !!bem;
  // O valor atual muda por movimentação, não pelo formulário principal —
  // sempre ler do estado vivo, não do snapshot capturado na abertura do
  // modal, senão salvar o formulário depois de uma movimentação desfaria o
  // efeito dela.
  const liveBem = isEditing ? (state.bens.find(b => b.id === bem.id) || bem) : null;

  const [form, setForm] = useState(bem || FORM_VAZIO);
  // Ressincroniza a cada abertura (o modal fica montado o tempo todo, só
  // alterna `open`) — sem isso, o formulário guardava o que ficou do
  // cadastro/edição anterior: abrir "Novo Bem" de novo mostrava valores do
  // bem anterior, e editar um bem diferente logo depois de editar outro
  // podia mostrar os dados do primeiro por um instante. Mesmo raciocínio da
  // correção do ano-calendário abaixo.
  useEffect(() => {
    if (open) setForm(bem || FORM_VAZIO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bem]);

  // Só faz sentido pra registro novo: um bem editado já pertence ao ano
  // ativo, mover ele de ano não é o que esse campo resolve. Ressincroniza a
  // cada abertura (o modal fica montado o tempo todo, só alterna `open`) —
  // sem isso, o valor inicial (capturado só na 1ª montagem) ficava
  // desatualizado depois de qualquer virada de ano, e salvar disparava uma
  // troca de ano indevida pro valor velho.
  const [anoCadastro, setAnoCadastro] = useState(() => state.anoCalendario);
  useEffect(() => {
    if (open && !isEditing) setAnoCadastro(state.anoCalendario);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const upd = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isEditing && !garantirAnoCadastro(anoCadastro)) return;
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
  const codigosDoGrupo = CODIGOS_POR_GRUPO[form.grupo] || [];

  return (
    <Modal open={open} onClose={onClose} style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <h3>{bem ? 'Editar Bem' : 'Novo Bem ou Direito'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {!isEditing && (
              <div className="form-row">
                <div className="form-group">
                  <label>Ano-calendário</label>
                  <input
                    className="form-control" type="number"
                    value={anoCadastro} onChange={e => setAnoCadastro(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  />
                </div>
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label>Grupo</label>
                <select
                  className="form-control" value={form.grupo}
                  onChange={e => setForm(prev => ({ ...prev, grupo: e.target.value, codigo_bem: '' }))}
                >
                  {GRUPOS_BENS.map(g => <option key={g.codigo} value={g.codigo}>{g.codigo} - {g.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Código do Bem</label>
                <select className="form-control" value={form.codigo_bem} onChange={e => upd('codigo_bem', e.target.value)}>
                  <option value="">Selecione...</option>
                  {codigosDoGrupo.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} - {c.nome}</option>)}
                </select>
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
                  <MoneyInput value={form.situacao_anterior} onChange={v => upd('situacao_anterior', v)} />
                </div>
                <div className="form-group">
                  <label>Situação em 31/12 (Ano Atual)</label>
                  <MoneyInput value={form.situacao_atual} onChange={v => upd('situacao_atual', v)} />
                </div>
                <div className="form-group">
                  <label>CNPJ</label>
                  <input className="form-control" value={form.cnpj} onChange={e => upd('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
                </div>
              </div>
            )}

            {isEditing && <MovimentacaoBemForm bem={liveBem} actionType="REGISTRAR_MOVIMENTACAO_BEM" />}

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
            <button type="submit" className="btn btn-primary">Salvar</button>
          </div>
        </form>
    </Modal>
  );
}