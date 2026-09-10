import { useState } from 'react';
import { useData } from '../store/DataContext';
import Modal from './Modal';
import { descreverOrigemDocumento } from '../utils/formatters';
import { rotuloTitularidade } from '../store/titularidade';
import { FICHAS_CLASSIFICACAO, registrosClassificaveis, classificacaoVigente, assinaturaFonte, opcoesClassificacao, valorAusente, valorDoCampo } from '../utils/classificacaoImportacao';

const texto = valor => valorAusente(valor) ? 'Não informado' : typeof valor === 'boolean' ? (valor ? 'Sim' : 'Não') : String(valor);
function CampoClassificacao({ registro, campo, state, ocupado, onSalvar }) {
  const { item, colecao } = registro;
  const salvo = classificacaoVigente(state, item, campo.chave);
  const [modo, setModo] = useState(salvo?.estado || (valorAusente(valorDoCampo(item, campo.chave)) ? 'nao_informado' : 'informado'));
  const [valor, setValor] = useState(valorDoCampo(item, campo.chave) ?? '');
  const [dependenteId, setDependenteId] = useState(item.dependenteId ?? state.dependentes?.find(d => String(d.cpf || '').replace(/\D/g, '') === String(item.cpf_beneficiario || item.cpf_dependente || '').replace(/\D/g, ''))?.id ?? '');
  const opcoes = opcoesClassificacao(colecao, campo.chave, item);
  const atual = salvo?.estado === 'sem_codigo' ? 'Sem código' : campo.tipo === 'pessoa' ? rotuloTitularidade(item, state.dependentes) : texto(item[campo.chave]);
  return <form className="classificacao-campo" onSubmit={e => { e.preventDefault(); onSalvar(campo.chave, modo, valor, dependenteId); }}>
    <div className="classificacao-campo-titulo"><strong>{campo.rotulo}</strong><span className="badge badge-blue">{salvo ? 'Classificado por você' : 'Sem revisão manual'}</span></div>
    <small>Atual: {atual}</small>
    {item.valorDeclarado && <small>Na importação: {campo.tipo === 'pessoa' ? rotuloTitularidade(item.valorDeclarado, state.dependentes) : texto(item.valorDeclarado[campo.chave])}</small>}
    <div className="classificacao-controles">
      <select aria-label={'Classificação de ' + campo.rotulo} className="form-control" value={modo} disabled={ocupado} onChange={e => setModo(e.target.value)}>
        <option value="informado">Informar / confirmar valor</option><option value="nao_informado">Não informado</option>
        {campo.tipo === 'codigo' && <option value="sem_codigo">Sem código</option>}
      </select>
      {modo === 'informado' && (campo.tipo === 'pessoa' ? <>
        <select className="form-control" aria-label="Titular ou dependente" value={valor} disabled={ocupado} onChange={e => setValor(e.target.value)} required><option value="">Selecione</option><option>Titular</option><option>Dependente</option></select>
        {valor === 'Dependente' && <select className="form-control" aria-label="Dependente do registro" value={dependenteId} disabled={ocupado} onChange={e => setDependenteId(e.target.value)} required><option value="">Selecione o dependente</option>{(state.dependentes || []).map(d => <option key={d.id} value={d.id}>{d.nome} {d.cpf ? '(' + d.cpf + ')' : ''}</option>)}</select>}
        {valor === 'Dependente' && !state.dependentes?.length && <small>Cadastre o dependente em Titular e Dependentes e retome aqui.</small>}
      </> : campo.tipo === 'booleano' ? <select className="form-control" aria-label={campo.rotulo} value={String(valor)} disabled={ocupado} onChange={e => setValor(e.target.value)} required><option value="">Selecione</option><option value="true">Sim</option><option value="false">Não</option></select>
      : opcoes.length ? <select className="form-control" aria-label={campo.rotulo} value={valor} disabled={ocupado} onChange={e => setValor(e.target.value)} required><option value="">Selecione</option>{!opcoes.some(o => o.codigo === valor) && valor !== '' && <option value={valor}>{valor} (valor importado)</option>}{opcoes.map(o => <option key={o.codigo} value={o.codigo}>{o.codigo} - {o.nome}</option>)}</select>
      : <input className="form-control" aria-label={campo.rotulo} type={campo.tipo === 'data' ? 'date' : campo.tipo === 'numero' ? 'number' : 'text'} step="any" value={valor} disabled={ocupado} onChange={e => setValor(e.target.value)} required />)}
      <button className="btn btn-primary btn-sm" disabled={ocupado} type="submit">Salvar campo</button>
    </div>
  </form>;
}

export default function ClassificacaoImportacaoModal() {
  const { state, dispatchPersistido, addToast } = useData();
  const [ficha, setFicha] = useState('');
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const registros = registrosClassificaveis(state);
  const filtrados = registros.filter(r => (!ficha || r.colecao === ficha) && r.nome.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')));
  const chave = r => r.colecao + ':' + r.item.id;
  const atual = filtrados.find(r => chave(r) === selecionado) || filtrados[0];
  const fechar = async () => {
    if (ocupado) return;
    setOcupado(true);
    try { await dispatchPersistido({type: 'ABRIR_CLASSIFICACAO_IMPORTACAO', payload: false}); setErro(''); setMensagem(''); }
    catch (e) { setErro(e.message); }
    finally { setOcupado(false); }
  };
  const salvar = async (campo, estado, valor, dependenteId) => {
    setOcupado(true); setErro(''); setMensagem('');
    try {
      await dispatchPersistido({type: 'CLASSIFICAR_CAMPO_IMPORTADO', payload: {
        colecao: atual.colecao, id: atual.item.id, campo, estado, valor, dependenteId,
        anoCalendario: state.anoCalendario, fonte: assinaturaFonte(state), atualizadoEm: new Date().toISOString(),
      }});
      setMensagem('Campo salvo. Você pode continuar ou retomar depois.');
      addToast('Classificação salva.', 'success');
    } catch (e) { setErro(e.message); }
    finally { setOcupado(false); }
  };
  return <Modal open={!!state.documentoFonte?.revisaoManualAberta} onClose={fechar} style={{maxWidth: '1100px', width: 'calc(100vw - 32px)', height: 'min(900px, 90vh)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
    <div className="modal-header classificacao-header"><div><h3>Classificar campos da declaração</h3><p className="import-review-subtitle">Ano-calendário {state.anoCalendario}. Cada campo salvo fica disponível em Importar declaração.</p></div><button className="modal-close" disabled={ocupado} aria-label="Fechar classificação" onClick={fechar}>✕</button></div>
    <div className="modal-body classificacao-body">
      <p>Confira os valores extraídos, escolha os códigos e a titularidade ou marque Não informado. Os valores originais permanecem no histórico. Campos opcionais vazios não significam erro de importação.</p>
      <p><strong>{registros.reduce((s, r) => s + r.pendentes, 0)} escolhas disponíveis</strong> em {registros.length} registros de cadastro. As escolhas manuais não alteram a comprovação técnica das fichas.</p>
      {erro && <p role="alert" className="classificacao-erro">{erro}</p>}
      {mensagem && <p role="status">{mensagem}</p>}
      <div className="classificacao-filtros"><label>Ficha<select aria-label="Ficha" className="form-control" value={ficha} onChange={e => {setFicha(e.target.value); setSelecionado('');}}><option value="">Todas as fichas</option>{Object.entries(FICHAS_CLASSIFICACAO).map(([k, d]) => <option key={k} value={k}>{d.rotulo}</option>)}</select></label><label>Buscar registro<input aria-label="Buscar registro" className="form-control" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Descrição ou nome" /></label></div>
      <div className="classificacao-layout">
        <nav className="classificacao-registros" aria-label="Registros para classificar">{filtrados.map((r, i) => <button className={atual === r ? 'selecionado' : ''} key={chave(r)} disabled={ocupado} onClick={() => {setSelecionado(chave(r)); setErro(''); setMensagem('');}}><small>{r.ficha} ({i + 1})</small><strong>{r.nome}</strong><small>{r.pendentes ? r.pendentes + ' escolhas disponíveis' : 'Sem escolhas pendentes'}</small></button>)}</nav>
        <section className="classificacao-editor" aria-label="Campos do registro">{atual ? <><h4>{atual.nome}</h4><p>{descreverOrigemDocumento(atual.item) || 'Referência de origem não disponível neste registro.'}</p>{atual.campos.map(c => <CampoClassificacao key={chave(atual) + ':' + c.chave + ':' + JSON.stringify(atual.item.classificacaoManual?.[c.chave])} registro={atual} campo={c} state={state} ocupado={ocupado} onSalvar={salvar} />)}</> : <p>Nenhum registro encontrado. Você pode retomar a classificação após importar uma declaração.</p>}</section>
      </div>
    </div>
    <div className="modal-footer classificacao-footer"><small>Salve cada campo antes de sair. O restante pode ficar para depois.</small><button className="btn btn-secondary" disabled={ocupado} onClick={fechar}>Pular por enquanto</button><button className="btn btn-primary" disabled={ocupado} onClick={fechar}>Concluir por agora</button></div>
  </Modal>;
}
