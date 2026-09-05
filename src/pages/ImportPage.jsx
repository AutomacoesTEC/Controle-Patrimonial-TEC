import { useState, useRef } from 'react';
import { useData } from '../store/DataContext';
import { formatCpfCnpj } from '../utils/formatters';
import { snapshotYear } from '../store/reducer';
import { avaliarDestinoImportacao } from '../utils/destinoImportacao';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseDBK, parsePDF } from './importParsers';
import ReconciliacaoRetificadoraModal from '../components/ReconciliacaoRetificadoraModal';
import RevisaoImportacaoModal from '../components/RevisaoImportacaoModal';
import { identificarArquivoFonte, payloadImportacaoCompleto } from '../utils/importacaoDeclaracao';
import { validarIntegridadeArquivoIrpf } from '../irpf/leitorRegistrosDbk';

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
  const { state, dispatch, dispatchPersistido, addToast, perfilProtegido, persistencia, confirmar } = useData();
  const [importing, setImporting] = useState(false);
  const [importType, setImportType] = useState(null);
  const [importLog, setImportLog] = useState([]);
  const [progress, setProgress] = useState(null); // { current, total } | null
  const [reconciliacao, setReconciliacao] = useState(null); // props do modal de retificadora, ou null
  const [previsualizacao, setPrevisualizacao] = useState(null);
  const fileRef = useRef();

  const log = (msg, level = 'info') => setImportLog(prev => [...prev, { msg, level }]);

  const handleLoadYear = (ano) => {
    dispatch({ type: 'LOAD_HISTORICO', payload: ano });
    addToast(`Dados de ${ano} carregados!`, 'info');
  };

  const handleDeleteYear = async (e, ano) => {
    e.stopPropagation();
    const confirmado = await confirmar({
      titulo: `Excluir o ano-calendário ${ano} do histórico?`,
      texto: 'Todos os bens, dívidas, rendimentos e pagamentos salvos desse ano serão apagados. Essa ação não pode ser desfeita.',
      textoConfirmar: 'Excluir',
      perigo: true,
    });
    if (!confirmado) return;
    dispatch({ type: 'DELETE_HISTORICO_ANO', payload: ano });
    addToast(`Ano-calendário ${ano} excluído do histórico.`, 'info');
  };

  const exportarFonteAuditoria = (e, ano, documentoFonte) => {
    e.stopPropagation();
    if (!documentoFonte?.textoIntegral) return;
    const blob = new Blob([documentoFonte.textoIntegral], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-declaracao-irpf-${ano}-${documentoFonte.formato || 'arquivo'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
      const arrayBufferFonte = await file.arrayBuffer();

      // Extensões OFICIAIS do programa da Receita, conferidas na classe
      // `ConstantesGlobais` do próprio IRPF 2026 em 24/08/2026:
      //   .DEC  arquivo da declaração        (EXTENSAO_ARQ_DECLARACAO)
      //   .DBK  cópia de segurança           (EXTENSAO_COPIA_SEGURA)
      //   .F2B  backup do ano anterior       (EXTENSAO_BACKUP_ANO_ANTERIOR)
      //   .REC  recibo de entrega            (EXTENSAO_COMPL_RECIBO)
      // Os três primeiros são gravados pelo mesmo componente e têm o mesmo
      // layout de registros; o `.REC` é só o recibo e NÃO é declaração, por
      // isso fica de fora.
      //
      // O `.F2B` é aceito mas nunca foi testado contra um arquivo real — se o
      // layout divergir, o parser avisa sobre os tipos de registro que não
      // reconhece, em vez de importar errado em silêncio.
      //
      // `.bak` saiu daqui: NÃO é extensão do programa, e mesmo assim estava no
      // `accept` do seletor de arquivo. Quem escolhesse um `.bak` recebia
      // "Formato não suportado" do próprio app que tinha oferecido a opção.
      if (ext === 'dbk' || ext === 'dec' || ext === 'f2b') {
        log(`Arquivo selecionado: ${file.name} (${ext.toUpperCase()})`);
        const text = await file.text();
        const integridade = validarIntegridadeArquivoIrpf(text, ext);
        log(`Integridade eletrônica validada: ${integridade.registros.length} registro(s), trailer e contagens conferidos.`, 'success');
        result = await parseDBK(text, log);
      } else if (ext === 'pdf') {
        log(`Arquivo selecionado: ${file.name} (PDF)`);
        log('Lendo arquivo PDF...');
        // pdf.js pode transferir/destacar o ArrayBuffer recebido. O original
        // precisa permanecer intacto para o SHA-256 que identifica exatamente
        // o arquivo escolhido pela pessoa.
        const pdf = await pdfjsLib.getDocument({ data: arrayBufferFonte.slice(0) }).promise;
        setProgress({ current: 0, total: pdf.numPages });
        result = await parsePDF(pdf, log, (current, total) => setProgress({ current, total }));
      } else {
        log('Formato não suportado. Use o PDF da declaração ou o arquivo .DEC ou .DBK gerado pelo programa da Receita.', 'error');
        setImporting(false);
        return;
      }

      if (result) {
        result = await identificarArquivoFonte(result, file, arrayBufferFonte);
        if (result.documentoFonte) {
          const d = result.documentoFonte;
          const quantidade = d.totalPaginas ? `${d.totalPaginas} página(s)` : `${d.totalRegistros} registro(s)`;
          log(`Integridade: conteúdo textual integral preservado localmente (${quantidade}, ${d.caracteresExtraidos.toLocaleString('pt-BR')} caracteres).`, 'success');
          if (d.sha256TextoExtraido) log(`Hash SHA-256 do texto: ${d.sha256TextoExtraido}`);
          if (d.sha256ArquivoOriginal) log(`Hash SHA-256 do arquivo original: ${d.sha256ArquivoOriginal}`, 'success');
        }
        setImporting(false);
        setProgress(null);
        const aprovado = await new Promise(resolve => {
          setPrevisualizacao({ resultado: result, nomeArquivo: file.name, resolve });
        });
        setPrevisualizacao(null);
        if (!aprovado) {
          log('Importação cancelada na etapa de revisão. Nenhum dado foi alterado.', 'info');
          return;
        }
        setImporting(true);
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
        const { temDadosNoDestino, origemConfiavelPorItem, temImportacaoAnterior } = avaliarDestinoImportacao(existenteNoDestino);

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
          const prosseguirTitular = await confirmar({
            titulo: 'Importar declaração de outro titular?',
            texto: `Esta declaração é de um titular DIFERENTE do já cadastrado para o ano-calendário ${anoDestino}.\n\n` +
              `Cadastrado: ${contribuinteExistente.nome || '(sem nome)'} (CPF ${formatCpfCnpj(contribuinteExistente.cpf)})\n` +
              `Nesta declaração: ${result.contribuinte.nome || '(sem nome)'} (CPF ${formatCpfCnpj(result.contribuinte.cpf)})\n\n` +
              `Importar mesmo assim vai SUBSTITUIR todos os dados do titular atual (inclusive o que foi cadastrado manualmente) por este outro titular.`,
            textoConfirmar: 'Substituir titular',
            perigo: true,
          });
          if (!prosseguirTitular) {
            log('Importação cancelada: titular diferente do já cadastrado para este ano.', 'error');
            setImporting(false);
            return;
          }
          await dispatchPersistido({ type: 'IMPORT_DECLARACAO', payload: payloadImportacaoCompleto(result, {
            // Titular novo: os dependentes do titular anterior não são dele,
            // não seguem junto (evita misturar as duas famílias no mesmo
            // ano-calendário).
            dependentes: [],
          }) });
          log('');
          log('Importação concluída e salva localmente (titular trocado).', 'success');
          log('Revise os dados importados nas abas de cadastro.');
          addToast('Declaração importada e salva com sucesso!', 'success');
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
        const ehRetificadora = temDadosNoDestino && temImportacaoAnterior && origemConfiavelPorItem &&
          mesmoTitular(result.contribuinte, existenteNoDestino.contribuinte);

        if (ehRetificadora) {
          const nomeTitular = existenteNoDestino.contribuinte?.nome || result.contribuinte?.nome || '';
          const prosseguirRetificadora = await confirmar({
            titulo: 'Sobrescrever com a declaração retificadora?',
            texto: `Você já importou uma declaração para o ano-calendário ${anoDestino}${nomeTitular ? ` (titular ${nomeTitular})` : ''}. ` +
              `Isso vai sobrescrever os dados importados dessa declaração anterior com esta retificadora. ` +
              `Na próxima tela você revisa e confirma item a item. O que foi incluído manualmente não é tocado.`,
            textoConfirmar: 'Sobrescrever',
            perigo: true,
          });
          if (!prosseguirRetificadora) {
            log('Importação cancelada. Dados existentes preservados.', 'error');
            setImporting(false);
            return;
          }
          setReconciliacao({
            resultadoCompleto: result,
            anoDestino,
            contribuinte: result.contribuinte,
            formato: result.formato,
            bensAntigos: (existenteNoDestino.bens || []).filter(b => b.origem === 'importacao' || b.origem === 'origem_legacy'),
            bensNovos: result.bens || [],
            dividasAntigas: (existenteNoDestino.dividas || []).filter(d => d.origem === 'importacao' || d.origem === 'origem_legacy'),
            dividasNovas: result.dividas || [],
            imoveisRuraisAntigos: (existenteNoDestino.imoveisRurais || []).filter(
              item => item.origem === 'importacao' || item.origem === 'origem_legacy',
            ),
            imoveisRuraisNovos: result.imoveisRurais || [],
            bensRuraisAntigos: (existenteNoDestino.bensRurais || []).filter(
              item => item.origem === 'importacao' || item.origem === 'origem_legacy',
            ),
            bensRuraisNovos: result.bensRurais || [],
            dividasRuraisAntigas: (existenteNoDestino.dividasRurais || []).filter(
              item => item.origem === 'importacao' || item.origem === 'origem_legacy',
            ),
            dividasRuraisNovas: result.dividasRurais || [],
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
          prosseguir = await confirmar({
            titulo: 'Substituir os dados já cadastrados neste ano?',
            texto: (trocaAno
              ? `Esta declaração é do ano-calendário ${anoDestino}. Já existem dados salvos para ${anoDestino}`
              : `Já existem dados cadastrados para o ano-calendário ${anoDestino}`) +
              ` (${existenteNoDestino.bens?.length || 0} bens, ${existenteNoDestino.dividas?.length || 0} dívidas). ` +
              `Importar esta declaração vai SUBSTITUIR esses dados. Lançamentos manuais feitos até agora serão perdidos.`,
            textoConfirmar: 'Substituir',
            perigo: true,
          });
        } else if (trocaAno) {
          prosseguir = await confirmar({
            titulo: 'Trocar de ano-calendário e importar?',
            texto: `Esta declaração é do ano-calendário ${anoDestino}, diferente do ano atual (${state.anoCalendario}).`,
            textoConfirmar: 'Trocar e importar',
          });
        }

        if (!prosseguir) {
          log('Importação cancelada. Dados existentes preservados.', 'error');
          setImporting(false);
          return;
        }

        await dispatchPersistido({ type: 'IMPORT_DECLARACAO', payload: payloadImportacaoCompleto(result) });
        log('');
        log('Importação concluída e salva localmente.', 'success');
        log('Revise os dados importados nas abas de cadastro.');
        addToast('Declaração importada e salva com sucesso!', 'success');
      }
    } catch (err) {
      log(`Erro na importação: ${err.message}`, 'error');
      addToast('Erro na importação: ' + err.message, 'error');
    }

    setImporting(false);
    setProgress(null);
  };

  const handleConfirmarReconciliacao = async (payload) => {
    try {
      await dispatchPersistido({ type: 'RECONCILIAR_IMPORTACAO', payload });
      setReconciliacao(null);
      log('');
      log('Conciliação da retificadora concluída e salva localmente.', 'success');
      addToast('Retificadora conciliada, importada e salva!', 'success');
    } catch (err) {
      log(`A retificadora não foi aplicada: ${err.message}`, 'error');
      addToast(err.message, 'error');
    }
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
        <div
          className="card"
          style={{
            marginBottom: '20px',
            borderColor: perfilProtegido ? 'var(--accent-success)' : 'var(--accent-warning, #f59e0b)',
          }}
        >
          <p style={{ margin: 0, fontSize: '13px' }}>
            {perfilProtegido
              ? 'Perfil protegido por senha. A declaração e sua cópia textual integral são salvas localmente com criptografia.'
              : 'Atenção: este perfil não tem senha. A declaração e sua cópia textual integral ficam somente neste computador, mas sem criptografia. Para dados reais, volte à tela de perfis e use “Proteger com senha”.'}
          </p>
        </div>
        {persistencia.estado === 'erro' && (
          <div className="card" style={{ marginBottom: '20px', borderColor: 'var(--accent-danger)' }}>
            <p style={{ margin: 0, color: 'var(--accent-danger)', fontSize: '13px' }}>
              Falha de salvamento local: {persistencia.erro}. Os dados não devem ser considerados gravados até uma nova tentativa bem-sucedida.
            </p>
          </div>
        )}
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
            <p>Arquivo .DEC ou .DBK gerado pelo programa IRPF</p>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.dbk,.dec,.f2b"
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
        </div>
        {anosHistorico.length === 0 ? (
          <div className="empty-state">
            <h3>Nenhuma declaração salva no histórico</h3>
            <p>Importe uma declaração para ela aparecer aqui</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {anosHistorico.map(ano => {
              const h = snapshotDoAno(ano);
              const ehAtivo = ano === state.anoCalendario;
              return (
                <div
                  className="card" key={ano}
                  style={{ cursor: ehAtivo ? 'default' : 'pointer' }}
                  onClick={ehAtivo ? undefined : () => handleLoadYear(ano)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Ano-Calendário {ano}</h3>
                      {h.savedAt && (
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          Salvo em {new Date(h.savedAt).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                      {h.documentoFonte && (
                        <p style={{ fontSize: '12px', color: 'var(--accent-success)', marginTop: '4px' }}>
                          Fonte integral preservada: {h.documentoFonte.totalPaginas
                            ? `${h.documentoFonte.totalPaginas} páginas`
                            : `${h.documentoFonte.totalRegistros || 0} registros`}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {ehAtivo
                        ? <span className="badge badge-green">Ano ativo</span>
                        : <span className="badge badge-blue">Carregar</span>}
                      {h.documentoFonte?.textoIntegral && (
                        <button
                          className="btn btn-sm btn-secondary"
                          title="Exportar uma cópia textual integral para auditoria"
                          onClick={(e) => exportarFonteAuditoria(e, ano, h.documentoFonte)}
                        >
                          Exportar fonte
                        </button>
                      )}
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
      {previsualizacao && (
        <RevisaoImportacaoModal
          open
          resultado={previsualizacao.resultado}
          nomeArquivo={previsualizacao.nomeArquivo}
          onConfirm={() => previsualizacao.resolve(true)}
          onCancel={() => previsualizacao.resolve(false)}
        />
      )}
    </>
  );
}
