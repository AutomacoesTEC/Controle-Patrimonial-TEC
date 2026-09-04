import { useMemo, useState } from 'react';
import { useData } from '../store/DataContext';
import DateInput from '../components/DateInput';
import TabelaRedimensionavel from '../components/TabelaRedimensionavel';
import EstadoVazio from '../components/EstadoVazio';

// Data/hora no padrão brasileiro (dd/mm/aaaa HH:mm), sempre com zero à
// esquerda.
function formatDataHora(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${min}`;
}

function formatarValorHistorico(valor) {
  if (valor == null || valor === '') return 'vazio';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

export default function HistoricoPage({ onImportar } = {}) {
  const { state } = useData();
  const alteracoes = state.alteracoes || [];
  // Atemporal por padrão: sem filtro, mostra tudo. "De"/"Até" filtram pela
  // data real em que a alteração aconteceu (não pelo ano-calendário que
  // estava ativo na hora, que é só um dado de contexto na tabela).
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  const [ordem, setOrdem] = useState('desc');

  const filtradas = useMemo(() => {
    const dentroDoPeriodo = alteracoes.filter(a => {
      const dia = (a.data || '').slice(0, 10);
      if (dataDe && dia < dataDe) return false;
      if (dataAte && dia > dataAte) return false;
      return true;
    });
    return [...dentroDoPeriodo].sort((a, b) =>
      ordem === 'asc' ? a.data.localeCompare(b.data) : b.data.localeCompare(a.data)
    );
  }, [alteracoes, dataDe, dataAte, ordem]);

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Histórico de Alterações</h2>
          <p>Registro de tudo que foi cadastrado, editado ou excluído no app</p>
        </div>
      </div>
      <div className="page-body animate-in">
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="form-row" style={{ alignItems: 'end', marginBottom: 0 }}>
            <div className="form-group">
              <label>De</label>
              <DateInput value={dataDe} onChange={setDataDe} />
            </div>
            <div className="form-group">
              <label>Até</label>
              <DateInput value={dataAte} onChange={setDataAte} />
            </div>
            <div className="form-group">
              <button className="btn btn-secondary" onClick={() => { setDataDe(''); setDataAte(''); }}>
                Limpar filtro
              </button>
            </div>
            <div className="form-group">
              <button className="btn btn-secondary" onClick={() => setOrdem(o => (o === 'desc' ? 'asc' : 'desc'))}>
                {ordem === 'desc' ? '↓ Mais recente primeiro' : '↑ Mais antigo primeiro'}
              </button>
            </div>
          </div>
        </div>

        {filtradas.length === 0 ? (
          <EstadoVazio
            titulo={alteracoes.length === 0 ? 'Nenhuma alteração registrada' : 'Nenhuma alteração neste período'}
            contexto={alteracoes.length === 0 ? 'Importe uma declaração ou faça o primeiro cadastro; cada mudança aparecerá aqui.' : 'Ajuste o filtro de datas para ver outros registros.'}
            acao={alteracoes.length === 0 ? 'Importar declaração' : undefined}
            onAcao={alteracoes.length === 0 ? onImportar : undefined}
          />
        ) : (
          <TabelaRedimensionavel persistKey="historico">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: '150px' }}>Quando</th>
                  <th>Ano-calendário</th>
                  <th style={{ minWidth: '300px' }}>O que mudou</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(a => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{formatDataHora(a.data)}</td>
                    <td>{a.anoCalendario != null ? <span className="badge badge-blue">{a.anoCalendario}</span> : ''}</td>
                    <td>
                      {a.descricao}
                      {a.mudancas?.length > 0 && (
                        <ul className="historico-mudancas">
                          {a.mudancas.map(m => <li key={m.campo}><strong>{m.campo.replace(/_/g, ' ')}</strong>: {formatarValorHistorico(m.antes)} → {formatarValorHistorico(m.depois)}</li>)}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRedimensionavel>
        )}
      </div>
    </>
  );
}
