import { useState, useRef } from 'react';
import { useData } from '../store/DataContext';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseDBK, parsePDF } from './importParsers';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function ImportPage() {
  const { state, dispatch, addToast } = useData();
  const [importing, setImporting] = useState(false);
  const [importType, setImportType] = useState(null);
  const [importLog, setImportLog] = useState([]);
  const fileRef = useRef();

  const log = (msg) => setImportLog(prev => [...prev, msg]);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    setImportLog([]);

    try {
      let result;
      const ext = file.name.toLowerCase().split('.').pop();

      if (ext === 'dbk' || ext === 'dec') {
        log(`📄 Arquivo selecionado: ${file.name} (${ext.toUpperCase()})`);
        const text = await file.text();
        result = await parseDBK(text, log);
      } else if (ext === 'pdf') {
        log(`📄 Arquivo selecionado: ${file.name} (PDF)`);
        log('📂 Lendo arquivo PDF...');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        result = await parsePDF(pdf, log);
      } else {
        log('❌ Formato não suportado. Use .PDF ou .DBK');
        setImporting(false);
        return;
      }

      if (result) {
        const anoDestino = result.anoCalendario || state.anoCalendario;
        const trocaAno = anoDestino !== state.anoCalendario;
        // O que já existe no ano de destino: o próprio estado corrente (se
        // for o mesmo ano) ou o que estiver arquivado no histórico daquele
        // ano — sem isso, importar por engano sobrescreveria em silêncio
        // lançamentos manuais já feitos (compra/venda/baixa do ano).
        const existenteNoDestino = trocaAno ? (state.historico[anoDestino] || {}) : state;
        const temDadosNoDestino = (existenteNoDestino.bens?.length > 0) || (existenteNoDestino.dividas?.length > 0) ||
          (existenteNoDestino.rendimentos?.length > 0) || (existenteNoDestino.pagamentos?.length > 0);

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
          log('❌ Importação cancelada. Dados existentes preservados.');
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
        log('✅ Importação concluída com sucesso!');
        log('💡 Revise os dados importados nas abas de cadastro.');
        addToast('Declaração importada com sucesso!', 'success');
      }
    } catch (err) {
      log(`❌ Erro na importação: ${err.message}`);
      addToast('Erro na importação: ' + err.message, 'error');
    }

    setImporting(false);
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
            <div style={{ fontSize: '48px' }}>📄</div>
            <h3>Importar PDF da Declaração</h3>
            <p>Arquivo .PDF gerado pelo programa IRPF (imagem da declaração)</p>
          </div>
          <div
            className={`import-zone ${importType === 'dbk' ? 'active' : ''}`}
            onClick={() => { setImportType('dbk'); fileRef.current?.click(); }}
          >
            <div style={{ fontSize: '48px' }}>💾</div>
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
              {importing && <span className="badge badge-blue">Processando...</span>}
            </div>
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
              {importLog.map((line, i) => (
                <div key={i} style={{ color: line.startsWith('❌') ? 'var(--accent-danger)' : line.startsWith('✅') ? 'var(--accent-success)' : 'var(--text-secondary)' }}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
