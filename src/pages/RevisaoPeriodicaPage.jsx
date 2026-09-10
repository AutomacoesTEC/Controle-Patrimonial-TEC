import ConferenciaAplicacoes from '../components/ConferenciaAplicacoes';
import { useState } from 'react';
import { useData } from '../store/DataContext';
import { pendenciasPeriodicas, previaDatasLegadas } from '../store/revisaoPeriodica';
import { referenciasFiscais, chaveReferencia } from '../store/vinculosOperacoes';
import { ensaiarBackup } from '../store/ensaioBackup';
import { exportListaToXlsx } from '../utils/exportXlsx';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import TabelaRedimensionavel from '../components/TabelaRedimensionavel';
import Modal from '../components/Modal';

export default function RevisaoPeriodicaPage({ onNavigate }) {
  const { state, dispatchPersistido, dispatch, confirmar, exportarPerfilAtual, addToast } = useData();
  const [mes, setMes] = useState(`${state.anoCalendario || new Date().getFullYear()}-12`);
  const [selecionada, setSelecionada] = useState(null);
  const [responsavel, setResponsavel] = useState('');
  const [decisao, setDecisao] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [senha, setSenha] = useState('');
  const [resultadoBackup, setResultadoBackup] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const pendencias = pendenciasPeriodicas(state, mes);
  const planos = previaDatasLegadas(state);
  const referencias = referenciasFiscais(state);
  const ultimoEnsaio = state.acompanhamento?.revisoes?.filter(r => r.origem.startsWith('backup:')).at(-1);
  const revisadas = referencias.filter(r => r.item.valorDeclarado || r.item.ajustesLocaisRetificadora?.length || r.item.origem === 'manual');
  const executar = async fn => { setOcupado(true); setErro(''); try { await fn(); } catch (e) { setErro(e.message); } finally { setOcupado(false); } };
  const parecer = async e => { e.preventDefault(); await executar(async () => { await dispatchPersistido({ type: 'ACOMPANHAMENTO', payload: { comando: 'revisao', origem: selecionada.id, decisao, responsavel } }); setSelecionada(null); addToast('Parecer registrado. A pendência só desaparece quando a causa é resolvida.', 'success'); }); };
  const migrar = plano => executar(async () => {
    if (!responsavel.trim()) throw new Error('Informe o responsável na seção de prévia antes de migrar.');
    const nome = await exportarPerfilAtual();
    if (!await confirmar({ titulo: 'Aplicar esta migração individual?', texto: `Backup exportado: ${nome}. Confirme que guardou o arquivo.\n\n${plano.rotulo}\nData: ${plano.data}\nOrigem ${plano.anoOrigem} → destino ${plano.anoDestino}.\n\nAnos seguintes: ${plano.anosFuturos.map(a => `${a.ano}: ${a.tratamento}`).join('; ')}.\nUma cópia dos anos envolvidos será preservada no perfil.`, textoConfirmar: 'Confirmar backup e migrar' })) return;
    await dispatchPersistido({ type: 'MIGRAR_DATA_LEGADA', payload: { origem: plano.origem, antes: plano.antes, responsavel, backupConfirmado: true } });
    addToast('Movimento migrado. Confira o destino e as aberturas futuras.', 'success');
  });
  const ensaiar = () => executar(async () => {
    if (!arquivo) throw new Error('Selecione um arquivo de backup.');
    if (!responsavel.trim()) throw new Error('Informe o responsável para registrar o ensaio.');
    const resultado = await ensaiarBackup(await arquivo.text(), senha);
    setResultadoBackup(resultado); setSenha('');
    await dispatchPersistido({ type: 'ACOMPANHAMENTO', payload: { comando: 'revisao', origem: `backup:${resultado.hash}`, responsavel, decisao: JSON.stringify(resultado) } });
  });
  const exportar = () => exportListaToXlsx(pendencias, [['Origem', p => p.id], ['Tipo', p => p.tipo], ['Pendência', p => p.descricao], ['Ficha para tratamento', p => p.acao], ['Pareceres', p => p.pareceres.map(r => `${r.criadoEm} ${r.responsavel}: ${r.decisao}`).join('\n')]], 'Pendências', 'revisao_periodica', Number(mes.slice(0, 4)), { dadosRelatorio: state });
  return <>
    <div className="page-header"><h2>Revisão e pendências</h2><div className="page-header-actions"><button className="btn btn-secondary" onClick={exportar}>Exportar revisão e fichas</button><button className="btn btn-secondary" onClick={() => window.print()}>Imprimir</button></div></div>
    <div className="page-body acomp-page">
      {erro && <p role="alert" className="acomp-erro">{erro}</p>}
      <label className="form-group">Mês de revisão<input type="month" value={mes} onChange={e => { if (/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(e.target.value)) setMes(e.target.value); }} /></label>
      <p>Pendências até o fim do mês, incluindo anos anteriores disponíveis. Pareceres não apagam a causa nem atestam cobertura tributária integral. Use “Abrir ficha” para tratar o registro indicado; confira o ano e a identificação.</p>
      <TabelaRedimensionavel persistKey="revisao-pendencias"><table><thead><tr><th>Tipo</th><th>Origem / pendência</th><th>Pareceres registrados</th><th>Ações</th></tr></thead><tbody>{pendencias.map(p => <tr key={p.id}><td>{p.tipo}</td><td>{p.descricao}</td><td>{p.pareceres.map(r => <p key={r.id}>{formatDateTime(r.criadoEm)} - {r.responsavel}: {r.decisao}</p>)}</td><td><div className="acomp-acoes"><button className="btn btn-sm btn-secondary" onClick={() => { setSelecionada(p); setDecisao(''); setErro(''); }}>Registrar parecer</button><button className="btn btn-sm btn-secondary" onClick={() => { if (p.ref && p.ref.ano !== state.anoCalendario) dispatch({ type: 'SWITCH_ANO', payload: p.ref.ano }); onNavigate?.(p.acao); }}>Abrir ficha</button></div></td></tr>)}{!pendencias.length && <tr><td colSpan="4">Nenhuma pendência detectada pelas regras automatizadas. Ainda é necessária a revisão humana do checklist.</td></tr>}</tbody></table></TabelaRedimensionavel>
      <ConferenciaAplicacoes state={state} mes={mes} />
      <section className="card acomp-card"><h3>Prévia de dados antigos fora do ano da data</h3><p>Nenhuma migração automática na abertura. Movimentos só podem ser transferidos individualmente, com backup e vínculo exato de continuidade. Declarações de destino importadas e correspondências ambíguas exigem revisão manual. Datas de pagamento de DAA não mudam seu ano fiscal.</p><label className="form-group">Responsável pela revisão<input value={responsavel} onChange={e => setResponsavel(e.target.value)} /></label>
        <TabelaRedimensionavel persistKey="revisao-migracoes"><table><thead><tr><th>Registro</th><th>Origem → destino</th><th>Impacto / impedimento</th><th>Ações</th></tr></thead><tbody>{planos.map(p => <tr key={p.origem}><td>{p.rotulo} ; {p.data}</td><td>{p.anoOrigem} → {p.anoDestino}</td><td>{p.impedimento || p.anosFuturos.map(a => `${a.ano}: ${a.tratamento}`).join('; ') || 'Sem anos posteriores cadastrados'}</td><td><button className="btn btn-sm btn-secondary" disabled={ocupado || !!p.impedimento} onClick={() => migrar(p)}>Exportar backup e migrar</button></td></tr>)}{!planos.length && <tr><td colSpan="4">Nenhuma data fora do ano detectada nos registros suportados.</td></tr>}</tbody></table></TabelaRedimensionavel>
        <p>Migrações preservadas: {(state.migracoesDados || []).length}. As cópias anteriores estão no backup integral do perfil.</p>
      </section>
      <section className="card acomp-card"><h3>Proveniência: declaração, alterações locais e retificadora</h3><p>O conteúdo declarado original não é substituído pela referência financeira. Clique em um registro para comparar todos os campos. Decisões ficam no histórico de pareceres.</p>
        <TabelaRedimensionavel persistKey="revisao-proveniencia"><table><thead><tr><th>Ficha / registro</th><th>Origem</th><th>Saldo / valor atual</th><th>Ações</th></tr></thead><tbody>{revisadas.map(r => <tr key={chaveReferencia(r.ref)}><td>{r.rotulo}</td><td>{r.item.origem || 'Legado'}{r.item.ajustesLocaisRetificadora?.length ? ' ; conflito de retificadora preservado' : ''}</td><td>{formatCurrency(r.item.situacao_atual ?? r.item.valor ?? r.item.valor_pago ?? 0)}</td><td><button className="btn btn-sm btn-secondary" onClick={() => { setSelecionada({ id: `proveniencia:${chaveReferencia(r.ref)}`, descricao: r.rotulo, comparacao: { declarado: r.item.valorDeclarado ?? 'Sem cópia individual; consultar documento-fonte', atual: r.item, ajustes: r.item.ajustesLocaisRetificadora || [] } }); setDecisao(''); }}>Comparar e registrar decisão</button></td></tr>)}</tbody></table></TabelaRedimensionavel>
      </section>
      <section className="card acomp-card"><h3>Ensaio periódico do backup</h3><p>Último ensaio registrado: {ultimoEnsaio?.criadoEm || 'Nenhum - ensaio recomendado antes do fechamento e mensalmente'}. Confere integridade e senha, restaura em perfil descartável em memória e relê o que foi gravado. Não substitui nenhum perfil, não testa falha física de disco e não comprova os arquivos externos referenciados.</p>
        <label className="form-group">Arquivo de backup .cptec.json<input type="file" accept=".json" onChange={e => { setArquivo(e.target.files[0] || null); setResultadoBackup(null); }} /></label><label className="form-group">Senha do backup (se protegido)<input type="password" autoComplete="off" value={senha} onChange={e => setSenha(e.target.value)} /></label><button className="btn btn-secondary" disabled={ocupado || !arquivo} onClick={ensaiar}>{ocupado ? 'Verificando…' : 'Testar restauração sem substituir perfil'}</button>
        {resultadoBackup && <p role="status">Backup relido com sucesso: {resultadoBackup.anos.join(', ')}; {resultadoBackup.contas} contas, {resultadoBackup.lancamentos} baixas. {resultadoBackup.documentosExternos} referências documentais; os arquivos externos não estão incluídos. Integridade: {resultadoBackup.hash}.</p>}
      </section>
    </div>
    <Modal open={!!selecionada} onClose={() => { if (!ocupado) setSelecionada(null); }}><form onSubmit={parecer}><div className="modal-header"><h3>Revisão do registro</h3><button type="button" className="btn btn-secondary" onClick={() => setSelecionada(null)}>Fechar</button></div><div className="modal-body acomp-form"><p>{selecionada?.descricao}</p>{selecionada?.comparacao && <pre className="acomp-comparacao">{JSON.stringify(selecionada.comparacao, null, 2)}</pre>}{erro && <p role="alert">{erro}</p>}<label className="form-group">Responsável<input required value={responsavel} onChange={e => setResponsavel(e.target.value)} /></label><label className="form-group">Decisão / providência<textarea required value={decisao} onChange={e => setDecisao(e.target.value)} /></label><p>Registrar parecer não altera valores declarados nem elimina pendências que ainda tenham causa presente.</p></div><div className="modal-footer"><button type="submit" className="btn btn-primary" disabled={ocupado}>Salvar parecer</button></div></form></Modal>
  </>;
}
