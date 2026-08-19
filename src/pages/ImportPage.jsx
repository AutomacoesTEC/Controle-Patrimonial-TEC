import { useState, useRef } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, formatCpfCnpj } from '../utils/formatters';
import { snapshotYear } from '../store/reducer';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseDBK, parsePDF } from './importParsers';
import ReconciliacaoRetificadoraModal from '../components/ReconciliacaoRetificadoraModal';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Mesmo titular: compara por CPF (dígitos, ignora formatação); sem CPF em
// algum dos dois lados, cai pro nome (só texto, sem número de documento
// pra comparar não dá pra confiar cegamente, mas é o que sobra).
function mesmoTitular(a, b) {
  const cpfA = (a?.cpf || '').replace(/\D/g, '');
  const cpfB = (b?.cpf || '').replace(/\D/g, '');
  if (cpfA && cpfB) return cpfA === cpfB;
  const nomeA = (a?.nome || '').trim().toUpperCase();
  const nomeB = (b?.nome || '').trim().toUpperCase();
  return !!nomeA && nomeA === nomeB;
}

export default function ImportPage() {
  const { state, dispatch, addToast, saveToStorage } = useData();
  const [importing, setImporting] = useState(false);
  const [importType, setImportType] = useState(null);
  const [importLog, setImportLog] = useState([]);
  const [progress, setProgress] = useState(null); // { current, total } | null
  const [reconciliacao, setReconciliacao] = useState(null); // props do modal de retificadora, ou null
  const fileRef = useRef();

  const log = (msg, level = 'info') => setImportLog(prev => [...prev, { msg, level }]);

  const handleSaveYear = () => {
    dispatch({ type: 'SAVE_HISTORICO' });
    saveToStorage();
    addToast(`Dados de ${state.anoCalendario} salvos no histórico!`, 'success');
  };

  const handleLoadYear = (ano) => {
    dispatch({ type: 'LOAD_HISTORICO', payload: ano });
    addToast(`Dados de ${ano} carregados!`, 'info');
  };

  const handleDeleteYear = (e, ano) => {
    e.stopPropagation();
    const confirmado = confirm(
      `Excluir o ano-calendário ${ano} do histórico?\n\n` +
      `Todos os bens, dívidas, rendimentos e pagamentos salvos desse ano serão apagados. Essa ação não pode ser desfeita.`
    );
    if (!confirmado) return;
    dispatch({ type: 'DELETE_HISTORICO_ANO', payload: ano });
    addToast(`Ano-calendário ${ano} excluído do histórico.`, 'info');
  };

  // "Histórico de Declarações" é o arquivo de documentos importados — algo
  // atemporal e independente do ano de trabalho ativo. Um ano que só existe
  // por ter sido avançado manualmente (nunca importado) não é uma
  // declaração e não entra aqui; ver origemAnoAtual/origem no reducer.
  const anosImportadosNoHistorico = Object.keys(state.historico)
    .filter(ano => state.historico[ano]?.origem === 'importacao')
    .map(Number);
  const anoAtivoEhImportado = state.anoCalendario != null && state.origemAnoAtual === 'importacao';
  const anosHistorico = [...new Set([
    ...anosImportadosNoHistorico,
    ...(anoAtivoEhImportado ? [state.anoCalendario] : []),
  ])].sort((a, b) => b - a);
  // O ano ativo lê do estado vivo (pode ter mudado desde o último arquivo),
  // não do snapshot arquivado, que pode estar desatualizado.
  const snapshotDoAno = (ano) => (ano === state.anoCalendario ? snapshotYear(state) : state.historico[ano]);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    setImportLog([]);
    setProgress(null);

    try {
      let result;
      const ext = file.name.toLowerCase().split('.').pop();

      if (ext === 'dbk' || ext === 'dec') {
        log(`Arquivo selecionado: ${file.name} (${ext.toUpperCase()})`);
        const text = await file.text();
        result = await parseDBK(text, log);
      } else if (ext === 'pdf') {
        log(`Arquivo selecionado: ${file.name} (PDF)`);
        log('Lendo arquivo PDF...');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setProgress({ current: 0, total: pdf.numPages });
        result = await parsePDF(pdf, log, (current, total) => setProgress({ current, total }));
      } else {
        log('Formato não suportado. Use .PDF ou .DBK', 'error');
        setImporting(false);
        return;
      }

      if (result) {
        const anoDestino = result.anoCalendario || state.anoCalendario;
        // Antes da 1ª importação não há ano definido: nada de "troca de ano",
        // a declaração simplesmente define o ano-calendário inicial. Isso é
        // independente do ano-calendário selecionado na sidebar (esta tela é
        // atemporal): o alvo é sempre o ano da própria declaração.
        const trocaAno = state.anoCalendario != null && anoDestino !== state.anoCalendario;
        // O que já existe no ano de destino: o próprio estado corrente (se
        // for o mesmo ano) ou o que estiver arquivado no histórico daquele
        // ano — sem isso, importar por engano sobrescreveria em silêncio
        // lançamentos manuais já feitos (compra/venda/baixa do ano).
        const existenteNoDestino = trocaAno ? (state.historico[anoDestino] || {}) : state;
        const temDadosNoDestino = (existenteNoDestino.bens?.length > 0) || (existenteNoDestino.dividas?.length > 0) ||
          (existenteNoDestino.rendimentos?.length > 0) || (existenteNoDestino.pagamentos?.length > 0);

        // Titular diferente do já cadastrado nesse ano: isso NÃO é um erro
        // (o app não impede), mas merece um aviso específico em vez do
        // genérico "já existem dados, vai substituir" — é fácil não perceber
        // que a substituição troca a pessoa inteira, não só corrige valores.
        // Só compara quando há algo dos dois lados pra comparar; sem isso
        // (ano novo, sem contribuinte definido ainda) não há titular anterior
        // pra conflitar.
        const contribuinteExistente = existenteNoDestino.contribuinte;
        const haViaComparar = contribuinteExistente && (contribuinteExistente.cpf || contribuinteExistente.nome) &&
          result.contribuinte && (result.contribuinte.cpf || result.contribuinte.nome);
        const titularDiferente = haViaComparar && !mesmoTitular(result.contribuinte, contribuinteExistente);

        if (titularDiferente) {
          const prosseguirTitular = confirm(
            `Esta declaração é de um titular DIFERENTE do já cadastrado para o ano-calendário ${anoDestino}.\n\n` +
            `Cadastrado: ${contribuinteExistente.nome || '(sem nome)'} (CPF ${formatCpfCnpj(contribuinteExistente.cpf)})\n` +
            `Nesta declaração: ${result.contribuinte.nome || '(sem nome)'} (CPF ${formatCpfCnpj(result.contribuinte.cpf)})\n\n` +
            `Importar mesmo assim vai SUBSTITUIR todos os dados do titular atual (inclusive o que foi cadastrado manualmente) por este outro titular. Tem certeza que quer continuar?`
          );
          if (!prosseguirTitular) {
            log('Importação cancelada: titular diferente do já cadastrado para este ano.', 'error');
            setImporting(false);
            return;
          }
          dispatch({ type: 'IMPORT_DECLARACAO', payload: {
            anoCalendario: result.anoCalendario,
            contribuinte: result.contribuinte,
            // Titular novo: os dependentes do titular anterior não são dele,
            // não seguem junto (evita misturar as duas famílias no mesmo
            // ano-calendário).
            dependentes: [],
            bens: result.bens,
            dividas: result.dividas,
            rendimentos: result.rendimentos,
            pagamentos: result.pagamentos,
          }});
          log('');
          log('Importação concluída com sucesso (titular trocado).', 'success');
          log('Revise os dados importados nas abas de cadastro.');
          addToast('Declaração importada com sucesso!', 'success');
          setImporting(false);
          setProgress(null);
          return;
        }

        // Retificadora: mesmo ano-calendário, mesmo titular, e o que já está
        // lá veio de uma importação de verdade (não só cadastro manual). Só
        // dá pra confiar nisso se todo item já tiver a marca de origem — dado
        // de uma versão antes dessa marca existir não permite separar
        // importado de manual com segurança, então cai no fluxo antigo (que
        // pelo menos avisa antes de substituir tudo).
        const origemConfiavelPorItem = ['bens', 'dividas'].every(campo =>
          (existenteNoDestino[campo] || []).every(item => item.origem === 'importacao' || item.origem === 'manual')
        );
        const temImportacaoAnterior = (existenteNoDestino.bens || []).some(b => b.origem === 'importacao') ||
          (existenteNoDestino.dividas || []).some(d => d.origem === 'importacao');
        const ehRetificadora = temDadosNoDestino && temImportacaoAnterior && origemConfiavelPorItem &&
          mesmoTitular(result.contribuinte, existenteNoDestino.contribuinte);

        if (ehRetificadora) {
          const nomeTitular = existenteNoDestino.contribuinte?.nome || result.contribuinte?.nome || '';
          const prosseguirRetificadora = confirm(
            `Você já importou uma declaração para o ano-calendário ${anoDestino}${nomeTitular ? ` (titular ${nomeTitular})` : ''}. ` +
            `Tem certeza que quer sobrescrever os dados importados dessa declaração anterior com esta retificadora? ` +
            `Na próxima tela você revisa e confirma item a item — o que foi incluído manualmente não é tocado.`
          );
          if (!prosseguirRetificadora) {
            log('Importação cancelada. Dados existentes preservados.', 'error');
            setImporting(false);
            return;
          }
          setReconciliacao({
            anoDestino,
            contribuinte: result.contribuinte,
            bensAntigos: (existenteNoDestino.bens || []).filter(b => b.origem === 'importacao'),
            bensNovos: result.bens || [],
            dividasAntigas: (existenteNoDestino.dividas || []).filter(d => d.origem === 'importacao'),
            dividasNovas: result.dividas || [],
            rendimentosNovos: result.rendimentos || [],
            pagamentosNovos: result.pagamentos || [],
          });
          log('');
          log('Declaração reconhecida como retificadora do mesmo ano e titular.', 'info');
          log('Revise a conciliação item a item na tela que abriu.');
          setImporting(false);
          setProgress(null);
          return;
        }

        let prosseguir = true;
        if (temDadosNoDestino) {
          prosseguir = confirm(
            (trocaAno
              ? `Esta declaração é do ano-calendário ${anoDestino}. Já existem dados salvos para ${anoDestino}`
              : `Já existem dados cadastrados para o ano-calendário ${anoDestino}`) +
            ` (${existenteNoDestino.bens?.length || 0} bens, ${existenteNoDestino.dividas?.length || 0} dívidas). ` +
            `Importar esta declaração vai SUBSTITUIR esses dados. Lançamentos manuais feitos até agora serão perdidos. Deseja continuar?`
          );
        } else if (trocaAno) {
          prosseguir = confirm(`Esta declaração é do ano-calendário ${anoDestino}, diferente do ano atual (${state.anoCalendario}). Trocar para ${anoDestino} e importar?`);
        }

        if (!prosseguir) {
          log('Importação cancelada. Dados existentes preservados.', 'error');
          setImporting(false);
          return;
        }

        dispatch({ type: 'IMPORT_DECLARACAO', payload: {
          anoCalendario: result.anoCalendario,
          contribuinte: result.contribuinte,
          bens: result.bens,
          dividas: result.dividas,
          rendimentos: result.rendimentos,
          pagamentos: result.pagamentos,
        }});
        log('');
        log('Importação concluída com sucesso.', 'success');
        log('Revise os dados importados nas abas de cadastro.');
        addToast('Declaração importada com sucesso!', 'success');
      }
    } catch (err) {
      log(`Erro na importação: ${err.message}`, 'error');
      addToast('Erro na importação: ' + err.message, 'error');
    }

    setImporting(false);
    setProgress(null);
  };

  const handleConfirmarReconciliacao = (payload) => {
    dispatch({ type: 'RECONCILIAR_IMPORTACAO', payload });
    setReconciliacao(null);
    log('');
    log('Conciliação da retificadora concluída.', 'success');
    addToast('Retificadora conciliada e importada com sucesso!', 'success');
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Importar Declaração</h2>
          <p>Importe o PDF ou arquivo eletrônico (.DBK) da declaração do ano anterior</p>
        </div>
      </div>
      <div className="page-body animate-in">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          <div
            className={`import-zone ${importType === 'pdf' ? 'active' : ''}`}
            onClick={() => { setImportType('pdf'); fileRef.current?.click(); }}
          >
            <h3>Importar PDF da Declaração</h3>
            <p>Arquivo .PDF gerado pelo programa IRPF (imagem da declaração)</p>
          </div>
          <div
            className={`import-zone ${importType === 'dbk' ? 'active' : ''}`}
            onClick={() => { setImportType('dbk'); fileRef.current?.click(); }}
          >
            <h3>Importar Arquivo Eletrônico</h3>
            <p>Arquivo .DBK ou .DEC gerado pelo programa IRPF (cópia de segurança)</p>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.dbk,.dec,.bak"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {importLog.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Log de Importação</h3>
              {importing && !progress && <span className="badge badge-blue">Processando...</span>}
              {importing && progress && (
                <span className="badge badge-blue">Página {progress.current} de {progress.total}</span>
              )}
            </div>
            {importing && progress && (
              <div style={{ height: '4px', borderRadius: '2px', background: 'var(--bg-input)', overflow: 'hidden', marginBottom: '12px' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.round((progress.current / progress.total) * 100)}%`,
                  background: 'var(--gradient-primary)',
                  transition: 'width var(--transition-normal)',
                }} />
              </div>
            )}
            <div style={{
              background: 'var(--bg-input)',
              borderRadius: 'var(--radius-sm)',
              padding: '16px',
              fontFamily: 'monospace',
              fontSize: '12px',
              maxHeight: '300px',
              overflowY: 'auto',
              lineHeight: '1.8',
            }}>
              {importLog.map((entry, i) => (
                <div key={i} style={{ color: entry.level === 'error' ? 'var(--accent-danger)' : entry.level === 'success' ? 'var(--accent-success)' : entry.level === 'warning' ? 'var(--accent-warning, #f59e0b)' : 'var(--text-secondary)' }}>
                  {entry.msg}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card-header" style={{ marginTop: '32px', marginBottom: '16px' }}>
          <h3 className="card-title">Histórico de Declarações</h3>
          {state.anoCalendario != null && (
            <button className="btn btn-secondary btn-sm" onClick={handleSaveYear}>Salvar {state.anoCalendario} no Histórico</button>
          )}
        </div>
        {anosHistorico.length === 0 ? (
          <div className="empty-state">
            <h3>Nenhuma declaração salva no histórico</h3>
            <p>Importe uma declaração ou clique em "Salvar no Histórico" para guardar os dados do ano atual</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {anosHistorico.map(ano => {
              const h = snapshotDoAno(ano);
              const ehAtivo = ano === state.anoCalendario;
              const totalBens = (h.bens || []).reduce((s, b) => s + (parseFloat(b.situacao_atual) || 0), 0);
              return (
                <div
                  className="card" key={ano}
                  style={{ cursor: ehAtivo ? 'default' : 'pointer' }}
                  onClick={ehAtivo ? undefined : () => handleLoadYear(ano)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Ano-Calendário {ano}</h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {(h.bens || []).length} bens, {(h.dividas || []).length} dívidas
                        {h.savedAt ? `, salvo em ${new Date(h.savedAt).toLocaleDateString('pt-BR')}` : ''}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(totalBens)}</div>
                        {ehAtivo
                          ? <span className="badge badge-green">Ano ativo</span>
                          : <span className="badge badge-blue">Carregar</span>}
                      </div>
                      <button
                        className="btn btn-sm btn-danger"
                        title={`Excluir o ano-calendário ${ano} do histórico`}
                        onClick={(e) => handleDeleteYear(e, ano)}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {reconciliacao && (
        <ReconciliacaoRetificadoraModal
          open={!!reconciliacao}
          {...reconciliacao}
          onConfirm={handleConfirmarReconciliacao}
          onCancel={() => { setReconciliacao(null); log('Conciliação cancelada. Dados existentes preservados.', 'error'); }}
        />
      )}
    </>
  );
}
