import { coberturaTemporal } from '../store/auditoriaDemonstrativo';
import { resumirImportacao } from '../utils/importacaoDeclaracao';
import { registrosClassificaveis } from '../utils/classificacaoImportacao';
import { useData } from '../store/DataContext';

const rotulos = { parcial: 'Cobertura em conferência', erro: 'Erro de extração', nao_suportada: 'Ficha não estruturada', completa: 'Conferida', vazia: 'Vazia', ausente: 'Não impressa' };
export default function PontosAtencaoImportacao() {
  const { state, dispatchPersistido, addToast } = useData();
  const resumo = resumirImportacao(state);
  const registros = registrosClassificaveis(state);
  const datas = coberturaTemporal(state, state.anoCalendario + '-01-01', state.anoCalendario + '-12-31');
  const fichas = { bens: 'Bens e Direitos', dividas: 'Dívidas e Ônus', dividasRurais: 'Dívidas rurais', rendimentos: 'Rendimentos', pagamentos: 'Pagamentos', pagamentosDiversos: 'Despesas gerais' };
  const escolhas = registros.reduce((s, r) => s + r.pendentes, 0);
  const avisos = state.avisosImportacao || [];
  const naoLidas = state.fichasNaoLidasComConteudo || [];
  const semRenda = state.origemAnoAtual === 'importacao' && !state.importFormato && state.bens?.length > 0 && !state.rendimentos?.length;
  if (!state.documentoFonte && !registros.length && !resumo.fichas.length && !avisos.length && !naoLidas.length) return null;
  const abrir = async () => {
    try { await dispatchPersistido({type: 'ABRIR_CLASSIFICACAO_IMPORTACAO', payload: true}); }
    catch (e) { addToast(e.message, 'error'); }
  };
  return <section className="card" aria-labelledby="importacao-pontos-titulo" style={{marginBottom: 24}}>
    <div className="card-header"><div><h3 id="importacao-pontos-titulo">Pontos de atenção e classificação</h3><p>Ano-calendário {state.anoCalendario}. Consulte as observações do arquivo e retome suas escolhas.</p></div><button className="btn btn-primary" onClick={abrir}>Classificar campos</button></div>
    <p><strong>{escolhas} escolhas disponíveis</strong> em {registros.length} registros de cadastro. Você pode informar valores, selecionar códigos e titularidade ou marcar Não informado. Campos opcionais vazios não são erros.</p>
    {semRenda && <p>Esta importação antiga possui bens e nenhum rendimento. Confira o arquivo e reimporte ou cadastre os rendimentos na ficha correspondente.</p>}
    {!!naoLidas.length && <p>Fichas com conteúdo não importado: {naoLidas.join(', ')}. Confira o documento e cadastre os valores nas fichas correspondentes, ou importe o arquivo eletrônico da mesma declaração.</p>}
    {!datas.completa && <details className="import-review-details"><summary>Datas e posições anuais a complementar ({datas.itens.length})</summary><p>Estas observações ficam disponíveis aqui para você retomar a complementação do arquivo. Uma posição anual não informa quando cada movimentação aconteceu e não representa, por si só, erro de importação.</p><p>Use Classificar campos para complementar o cadastro. Para detalhar alterações de saldo, registre os movimentos na ficha indicada; em rendimentos e pagamentos, informe e confirme a data efetiva quando conhecida.</p><div className="table-wrapper"><table><thead><tr><th>Ficha</th><th>Registro</th><th>O que complementar</th></tr></thead><tbody>{datas.itens.map((r,i) => <tr key={r.campo + ':' + r.id + ':' + i}><td>{fichas[r.campo] || r.campo}</td><td>{r.descricao || r.id}</td><td>{r.motivo}</td></tr>)}</tbody></table></div></details>}
    {!!avisos.length && <details><summary>Observações da importação ({avisos.length})</summary><ul>{avisos.map((a, i) => <li key={i}>{typeof a === 'string' ? a : a.mensagem || a.descricao || a.codigo || 'Observação do arquivo'}</li>)}</ul></details>}
    {!!resumo.fichas.length && <details className="import-review-details"><summary>Cobertura técnica das fichas: {resumo.alertas.length} em conferência ou com limitação</summary><p>A classificação manual complementa o cadastro. Ela não conclui a auditoria do importador. Em caso de erro ou ficha não estruturada, confira o arquivo original antes de usar seus totais.</p><div className="import-review-fichas">{resumo.fichas.map(f => <div className="import-review-ficha" key={f.id}><div><strong>{f.titulo || f.id}</strong>{f.motivo && <small>{f.motivo}</small>}</div><span className={'badge ' + (f.estado === 'erro' ? 'badge-red' : 'badge-blue')}>{f.derivado ? 'Derivada dos meses' : rotulos[f.estado] || f.estado}</span></div>)}</div></details>}
  </section>;
}
