import { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { GRUPOS_BENS, CODIGOS_POR_GRUPO, formatCurrency, mascaraCnpj } from '../utils/formatters';
import SeletorCodigo from './SeletorCodigo';
import MovimentacaoBemForm from './MovimentacaoBemForm';
import Modal from './Modal';
import MoneyInput from './MoneyInput';
import { primeiroCampoVazio, mensagemObrigatorio } from '../utils/validacao';

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
  const { state, addToast, garantirAnoCadastro } = useData();
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

  // Bloco 1 ("Dados do Bem") pode ser colapsado, já que quem abre o modal
  // pra editar veio pra mexer na movimentação (Bloco 2), não nesses campos
  // de identificação — pedido da usuária. Sempre começa expandido (mesmo
  // critério do resto do formulário: ressincroniza a cada abertura, senão
  // um bem colapsado ficaria colapsado também no próximo bem aberto, sem
  // relação com o que a pessoa tinha decidido antes).
  const [bloco1Expandido, setBloco1Expandido] = useState(true);
  useEffect(() => {
    if (open) setBloco1Expandido(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const upd = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const falta = primeiroCampoVazio([['Código do Bem', form.codigo_bem], ['Discriminação', form.discriminacao]]);
    if (falta) { addToast(mensagemObrigatorio(falta), 'error'); return; }
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
            {isEditing ? (
              // Bloco 1 "Dados do Bem": todos os campos de identificação
              // reunidos num card próprio, com Dados do Imóvel/Veículo
              // JUNTO (a usuária pediu, "são os dados que constam nas
              // declarações") — antes ficavam soltos no topo e o
              // Imóvel/Veículo vinha só depois do card de movimentação.
              // Cor theme-aware (rgba do próprio --accent-primary-rgb), pra
              // diferenciar do cinza fixo do Bloco 2 (Registrar
              // Movimentação) e do azul/verde fixos dos Blocos 3/4.
              // Colapsável: quando fechado, mostra só Discriminação e
              // Situação Atual (o resumo que basta pra reconhecer o bem);
              // o resto some visualmente (`display:none`), mas continua no
              // DOM/estado — nenhum campo digitado é perdido ao recolher.
              <div style={{ background: 'rgba(var(--accent-primary-rgb),0.06)', border: '1px solid rgba(var(--accent-primary-rgb),0.18)', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Dados do Bem
                  </div>
                  <button
                    type="button" className="btn btn-sm btn-secondary"
                    onClick={() => setBloco1Expandido(v => !v)}
                  >
                    {bloco1Expandido ? 'Mostrar menos' : 'Mostrar mais'}
                  </button>
                </div>

                <div style={{ display: bloco1Expandido ? undefined : 'none' }}>
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
                      <SeletorCodigo opcoes={codigosDoGrupo} value={form.codigo_bem} onChange={v => upd('codigo_bem', v)} placeholder="Selecione ou digite o código" />
                    </div>
                    <div className="form-group">
                      <label>Beneficiário</label>
                      <select className="form-control" value={form.beneficiario} onChange={e => upd('beneficiario', e.target.value)}>
                        <option value="Titular">Titular</option>
                        <option value="Dependente">Dependente</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>Discriminação</label>
                  <textarea className="form-control" rows={3} value={form.discriminacao} onChange={e => upd('discriminacao', e.target.value)}
                    placeholder="Descrição detalhada do bem conforme declaração IRPF..." />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Situação atual (não editável aqui)</label>
                    <div className="form-control" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', fontWeight: 700 }}>{formatCurrency(liveBem.situacao_atual)}</div>
                  </div>
                </div>

                <div style={{ display: bloco1Expandido ? undefined : 'none' }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Situação anterior (não editável aqui)</label>
                      <div className="form-control" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>{formatCurrency(liveBem.situacao_anterior)}</div>
                    </div>
                    <div className="form-group">
                      <label>CNPJ</label>
                      <input className="form-control" inputMode="numeric" value={mascaraCnpj(form.cnpj)} onChange={e => upd('cnpj', mascaraCnpj(e.target.value))} placeholder="00.000.000/0000-00" />
                    </div>
                  </div>

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
              </div>
            ) : (
              <>
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
                    <SeletorCodigo opcoes={codigosDoGrupo} value={form.codigo_bem} onChange={v => upd('codigo_bem', v)} placeholder="Selecione ou digite o código" />
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
                    <input className="form-control" inputMode="numeric" value={mascaraCnpj(form.cnpj)} onChange={e => upd('cnpj', mascaraCnpj(e.target.value))} placeholder="00.000.000/0000-00" />
                  </div>
                </div>

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
              </>
            )}

            {isEditing && <MovimentacaoBemForm bem={liveBem} actionType="REGISTRAR_MOVIMENTACAO_BEM" anoCalendario={state.anoCalendario} />}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            {/* "Salvar Dados do Bem" em vez de só "Salvar" quando editando:
                nesse modo o modal também tem "Registrar movimentação"/
                "Salvar correção" (MovimentacaoBemForm), uma ação
                independente que já grava na hora, sem depender deste botão
                — sem o rótulo diferenciado, as duas pareciam a mesma coisa
                (achado real, dúvida direta da usuária sobre pra que servem
                os dois). Em "Novo Bem" não existe essa ambiguidade (o
                formulário de movimentação só aparece editando), então
                continua só "Salvar". */}
            <button type="submit" className="btn btn-primary">{isEditing ? 'Salvar Dados do Bem' : 'Salvar'}</button>
          </div>
        </form>
    </Modal>
  );
}