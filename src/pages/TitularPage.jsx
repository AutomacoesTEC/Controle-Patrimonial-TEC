import { anoDaDataCadastro } from '../utils/dataCadastro';
import { useState, useEffect, useRef } from 'react';
import { useData } from '../store/DataContext';
import { formatCpfCnpj, mascaraCpf, formatDate, describeRelacaoDependencia, textoOficialRelacaoDependencia, descreverOrigemDocumento, CODIGOS_DEPENDENCIA } from '../utils/formatters';
import Modal from '../components/Modal';
import SeletorCodigo from '../components/SeletorCodigo';
import DateInput from '../components/DateInput';
import TabelaRedimensionavel from '../components/TabelaRedimensionavel';
import { primeiroCampoVazio, mensagemObrigatorio } from '../utils/validacao';

const FORM_DEPENDENTE_VAZIO = { data: '', nome: '', cpf: '', dataNascimento: '', parentesco: '' };

// Titular e dependentes são por ano-calendário (como o resto da
// declaração): mudar de ano na sidebar troca de titular/dependentes junto
// (ver snapshotYear/blankYear no reducer). Import continua sendo o jeito
// mais rápido de preencher isso, mas nem toda situação começa por um
// arquivo — daí esta tela para cadastrar ou corrigir à mão.
export default function TitularPage() {
  const { state, dispatch, addToast, garantirAnoCadastro, despacharEmAno, confirmar } = useData();
  const { contribuinte, dependentes, anoCalendario } = state;

  const [formTitular, setFormTitular] = useState({ data: contribuinte?.data || '', nome: contribuinte?.nome || '', cpf: contribuinte?.cpf || '' });
  useEffect(() => {
    setFormTitular({ data: contribuinte?.data || '', nome: contribuinte?.nome || '', cpf: contribuinte?.cpf || '' });
  }, [contribuinte, anoCalendario]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formDependente, setFormDependente] = useState(FORM_DEPENDENTE_VAZIO);
  const anoCadastro = formDependente.data ? anoDaDataCadastro(formDependente.data) : state.anoCalendario;
  const updDependente = (f, v) => setFormDependente(p => ({ ...p, [f]: v }));
  const simNao = (v) => v === true ? 'Sim' : v === false ? 'Não' : '-';
  const enderecoCompleto = contribuinte
    ? [contribuinte.logradouro, contribuinte.numero, contribuinte.complemento, contribuinte.bairro,
      contribuinte.municipio, contribuinte.uf, contribuinte.cep].filter(Boolean).join(', ')
    : '';

  const salvarTitular = async () => {
    const ano = formTitular.data ? anoDaDataCadastro(formTitular.data) : anoCalendario;
    // Sem esta guarda, salvar o formulário vazio disparava SET_CONTRIBUINTE
    // com nome e CPF em branco e APAGAVA o titular que a importação tinha
    // preenchido.
    const falta = primeiroCampoVazio([['Nome Completo', formTitular.nome]]);
    if (falta) { addToast(mensagemObrigatorio(falta), 'error'); return; }
    const anoAlvo = await garantirAnoCadastro(ano);
    if (!anoAlvo) return;
    despacharEmAno(anoAlvo, { type: 'SET_CONTRIBUINTE', payload: { data: formTitular.data, nome: formTitular.nome.trim(), cpf: formTitular.cpf.replace(/\D/g, '') } });
    addToast('Titular atualizado!', 'success');
  };
  const handleSalvarTitular = (e) => {
    e.preventDefault();
    salvarTitular();
  };

  const abrirNovoDependente = (ano = anoCalendario) => { setEditingId(null); setFormDependente(FORM_DEPENDENTE_VAZIO); setModalOpen(true); };
  const handleNovoDependenteClick = () => {
    abrirNovoDependente();
  };
  const abrirEdicaoDependente = (d) => {
    setEditingId(d.id);
    setFormDependente({ data: d.data || '', nome: d.nome || '', cpf: d.cpf || '', dataNascimento: d.dataNascimento || '', parentesco: d.parentesco || '' });
    setModalOpen(true);
  };

  const handleSalvarDependente = async (e) => {
    e.preventDefault();
    // Achado na auditoria de 21/08/2026: sem validação, o dependente entrava
    // com nome vazio e o Histórico registrava "Cadastrou dependente: (sem
    // descrição)".
    const falta = primeiroCampoVazio([['Nome Completo', formDependente.nome]]);
    if (falta) { addToast(mensagemObrigatorio(falta), 'error'); return; }
    if (editingId) {
      const anoAlvo = await garantirAnoCadastro(anoCadastro);
      if (!anoAlvo) return;
      despacharEmAno(anoAlvo, { type: 'UPDATE_DEPENDENTE', payload: { ...formDependente, id: editingId } });
      addToast('Dependente atualizado!', 'success');
    } else {
      const anoAlvo = await garantirAnoCadastro(anoCadastro);
      if (!anoAlvo) return;
      despacharEmAno(anoAlvo, { type: 'ADD_DEPENDENTE', payload: formDependente });
      addToast('Dependente cadastrado!', 'success');
    }
    setModalOpen(false);
  };

  const handleExcluirDependente = async (d) => {
    if (await confirmar({ titulo: 'Excluir este dependente?', textoConfirmar: 'Excluir', perigo: true, texto: `O dependente "${d.nome || 'sem nome'}" será removido desta declaração.\n\nEssa ação não pode ser desfeita.` })) {
      dispatch({ type: 'DELETE_DEPENDENTE', payload: d.id });
      addToast('Dependente excluído', 'info');
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Titular e Dependentes</h2>
        </div>
      </div>
      <div className="page-body animate-in">
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header"><h3 className="card-title">Titular</h3></div>
          <form onSubmit={handleSalvarTitular}>
            <div className="titular-form-grid">
              <div className="form-group titular-form-nome">
                <label htmlFor="titular-nome">Nome Completo</label>
                <input id="titular-nome" className="form-control" value={formTitular.nome} onChange={e => setFormTitular(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do titular" />
              </div>
              <div className="form-group">
                <label htmlFor="titular-cpf">CPF</label>
                <input id="titular-cpf" className="form-control" inputMode="numeric" value={mascaraCpf(formTitular.cpf)} onChange={e => setFormTitular(p => ({ ...p, cpf: mascaraCpf(e.target.value) }))} placeholder="000.000.000-00" />
              </div>
              <div className="form-group"><label htmlFor="titular-data">Data do cadastro</label><input id="titular-data" className="form-control" type="date" min="0001-01-01" max="9999-12-31" required={!contribuinte} value={formTitular.data || ''} onChange={e => setFormTitular(p => ({ ...p, data: e.target.value }))} /></div>
            </div>
            <div className="titular-form-actions">
              <button type="submit" className="btn btn-primary">Salvar Titular</button>
            </div>
          </form>
        </div>

        {contribuinte && (contribuinte.dataNascimento || contribuinte.logradouro || contribuinte.ocupacaoCodigo) && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header"><h3 className="card-title">Dados cadastrais importados da declaração</h3></div>
            <dl className="titular-dados-grid">
              {[
                ['Data de nascimento', formatDate(contribuinte.dataNascimento)],
                ['Raça/Cor', contribuinte.racaCor || contribuinte.racaCorCodigo],
                ['Possui cônjuge', simNao(contribuinte.possuiConjuge)],
                ['CPF do cônjuge', formatCpfCnpj(contribuinte.cpfConjuge)],
                ['Endereço', enderecoCompleto, true],
                ['E-mail', contribuinte.email],
                ['Telefone/Celular', [contribuinte.telefone, contribuinte.celular].filter(Boolean).join(' / ')],
                ['Natureza da ocupação', [contribuinte.naturezaOcupacaoCodigo, contribuinte.naturezaOcupacaoDescricao].filter(Boolean).join(' - '), true],
                ['Ocupação principal', [contribuinte.ocupacaoCodigo, contribuinte.ocupacaoDescricao].filter(Boolean).join(' - '), true],
                ['Tipo de declaração', contribuinte.tipoDeclaracao || contribuinte.tipoDeclaracaoCodigo],
                ['Retificadora', simNao(contribuinte.retificadora)],
                ['Recibo anterior', contribuinte.reciboUltimaDeclaracao],
                ['Doença grave/deficiência', simNao(contribuinte.doencaDeficiencia)],
                ['Era residente no exterior e passou a ser residente no Brasil', simNao(contribuinte.retornoPais)],
                ['Houve alteração de dados cadastrais', simNao(contribuinte.alteracaoDadosCadastrais)],
              ].map(([rotulo, valor, linhaInteira]) => (
                <div key={rotulo} className={linhaInteira ? 'titular-dado-amplo' : undefined}>
                  <dt>{rotulo}</dt>
                  <dd>{valor || '-'}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Dependentes</h3>
            <button className="btn btn-primary" onClick={handleNovoDependenteClick}>＋ Novo Dependente</button>
          </div>
          <TabelaRedimensionavel persistKey="titular-dependentes" stickyRightColumns={1}>
            <table className="tabela-acoes-fixas">
              <thead><tr><th>Nome</th><th>CPF</th><th>Data de Nascimento</th><th>Relação de Dependência</th><th>Raça/Cor</th><th>Mora com o titular</th><th>Contato</th><th>Ações</th></tr></thead>
              <tbody>
                {dependentes.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhum dependente cadastrado.</td></tr>
                ) : dependentes.map(d => (
                  <tr key={d.id}>
                    <td>
                      {d.nome}
                      {descreverOrigemDocumento(d) && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{descreverOrigemDocumento(d)}</div>
                      )}
                    </td>
                    <td>{formatCpfCnpj(d.cpf)}</td>
                    <td>{formatDate(d.dataNascimento)}</td>
                    {/* O código sozinho não permite conferir nada: a dedução
                        por dependente depende da relação. A descrição é a da
                        tabela oficial do programa da Receita, e o texto legal
                        completo fica na dica do mouse. */}
                    <td title={textoOficialRelacaoDependencia(d.parentesco) || undefined}>
                      {d.parentesco}
                      {describeRelacaoDependencia(d.parentesco) && (
                        <span style={{ color: 'var(--text-muted)' }}>{` - ${describeRelacaoDependencia(d.parentesco)}`}</span>
                      )}
                    </td>
                    <td>{d.racaCor || d.racaCorCodigo || '-'}</td>
                    <td>{simNao(d.moraComTitular)}</td>
                    <td style={{ fontSize: '12px' }}>
                      {d.email && <div>{d.email}</div>}
                      {(d.dddCelular || d.celular) && <div>{[d.dddCelular && `(${d.dddCelular})`, d.celular].filter(Boolean).join(' ')}</div>}
                      {!d.email && !d.celular && '-'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => abrirEdicaoDependente(d)}>Editar</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleExcluirDependente(d)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRedimensionavel>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="modal-header"><h3>{editingId ? 'Editar Dependente' : 'Novo Dependente'}</h3><button className="modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
        <form onSubmit={handleSalvarDependente}>
          <div className="modal-body">
            <div className="form-group"><label>Data do cadastro</label><input className="form-control" type="date" min="0001-01-01" max="9999-12-31" required={!editingId} value={formDependente.data || ''} onChange={e => updDependente('data', e.target.value)} /></div>
            <div className="form-group"><label>Nome Completo</label><input className="form-control" value={formDependente.nome} onChange={e => updDependente('nome', e.target.value)} /></div>
            <div className="form-row">
              <div className="form-group"><label>CPF</label><input className="form-control" inputMode="numeric" value={mascaraCpf(formDependente.cpf)} onChange={e => updDependente('cpf', mascaraCpf(e.target.value))} placeholder="000.000.000-00" /></div>
              <div className="form-group"><label>Data de Nascimento</label><DateInput value={formDependente.dataNascimento} onChange={v => updDependente('dataNascimento', v)} /></div>
            </div>
            <div className="form-group">
              <label>Relação de Dependência</label>
              <SeletorCodigo opcoes={CODIGOS_DEPENDENCIA} value={formDependente.parentesco} onChange={v => updDependente('parentesco', v)} placeholder="Selecione ou digite o código" />
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button></div>
        </form>
      </Modal>
    </>
  );
}
