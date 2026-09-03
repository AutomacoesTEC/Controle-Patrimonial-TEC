import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import Ajuda from './Ajuda';
import MoneyInput from './MoneyInput';
import { formatCurrency } from '../utils/formatters';
import { calcularMesComuns, calcularMesFii, sugerirCarry } from '../store/calculoRendaVariavelMes';

// Item E do HANDOFF-2026-09-03.md: lançamento manual de um mês de Renda
// Variável que a declaração importada não trouxe (ou trouxe errado). Serve
// as duas fichas (comuns/day-trade e FII/Fiagro) — `ficha` decide qual
// conjunto de campos mostrar. A prévia ao vivo chama as MESMAS funções que
// gravam o lançamento (calcularMesComuns/calcularMesFii): nunca existe uma
// fórmula "de mostrar" diferente da "de gravar".

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ORIGEM_TEXTO = { 'mes-anterior': 'mês anterior', 'ano-anterior': 'ano anterior (2025)', 'nenhum': 'nenhum' };

const mesmoBeneficiario = (linha, ben) =>
  ben.titular ? !!linha.titular : (!linha.titular && String(linha.cpfDependente || '') === String(ben.cpfDependente || ''));

export default function RendaVariavelMesModal({
  open, onClose, ficha, ano, beneficiarios, beneficiarioPadrao,
  linhasDoAno, linhasAnoAnterior, onSalvar,
}) {
  const [mes, setMes] = useState(1);
  const [benChave, setBenChave] = useState(beneficiarioPadrao || beneficiarios[0]?.chave);

  // Campos comuns/day-trade. Resultado é digitado como magnitude (MoneyInput
  // não aceita "-") + um "Foi prejuízo?" que inverte o sinal antes de entrar
  // na fórmula — apurarLado() já trata resultado negativo corretamente
  // (prejuizoCompensar cresce), só faltava o jeito de digitar o sinal.
  const [resultadoComuns, setResultadoComuns] = useState('');
  const [prejuizoComuns, setPrejuizoComuns] = useState(false);
  const [resultadoDayTrade, setResultadoDayTrade] = useState('');
  const [prejuizoDayTrade, setPrejuizoDayTrade] = useState(false);
  const [irrfComuns, setIrrfComuns] = useState('');
  const [irrfDayTrade, setIrrfDayTrade] = useState('');
  const [negAnteriorComuns, setNegAnteriorComuns] = useState(0);
  const [negAnteriorDayTrade, setNegAnteriorDayTrade] = useState(0);
  const [irrf11033Anteriores, setIrrf11033Anteriores] = useState(0);
  const [irrfDTAnteriores, setIrrfDTAnteriores] = useState(0);

  // Campos FII
  const [resultadoFii, setResultadoFii] = useState('');
  const [prejuizoFii, setPrejuizoFii] = useState(false);
  const [irrfFii, setIrrfFii] = useState('');
  const [aliquotaFiiPct, setAliquotaFiiPct] = useState(20);
  const [negAnteriorFii, setNegAnteriorFii] = useState(0);
  const [retidoAnterioresFii, setRetidoAnterioresFii] = useState(0);

  const [origemCarry, setOrigemCarry] = useState('nenhum');
  const [impostoPago, setImpostoPago] = useState(0);
  const [impostoPagoSujo, setImpostoPagoSujo] = useState(false);

  const beneficiarioAtivo = beneficiarios.find(b => b.chave === benChave) || beneficiarios[0];

  const existente = useMemo(() => {
    if (!beneficiarioAtivo) return null;
    return linhasDoAno.find(l => l.mes === mes && mesmoBeneficiario(l, beneficiarioAtivo)) || null;
  }, [linhasDoAno, mes, beneficiarioAtivo]);

  const mesesPosteriores = useMemo(() => {
    if (!beneficiarioAtivo) return 0;
    return linhasDoAno.filter(l => l.mes > mes && mesmoBeneficiario(l, beneficiarioAtivo)).length;
  }, [linhasDoAno, mes, beneficiarioAtivo]);

  // Reabre do zero a cada abertura (mês 1, primeiro beneficiário).
  useEffect(() => {
    if (open) { setMes(1); setBenChave(beneficiarioPadrao || beneficiarios[0]?.chave); setImpostoPagoSujo(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Troca de mês/beneficiário: se já existe lançamento MANUAL para essa
  // combinação, carrega os valores dele (edição); senão, limpa os campos do
  // mês e sugere o carry-forward (sugerirCarry) para os campos "anteriores".
  useEffect(() => {
    if (!open || !beneficiarioAtivo) return;
    setImpostoPagoSujo(false);
    if (existente && existente.origem === 'manual') {
      setOrigemCarry('lançamento existente');
      if (ficha === 'fii') {
        const v = existente.resultadoLiquidoMes || 0;
        setResultadoFii(Math.abs(v)); setPrejuizoFii(v < 0);
        setIrrfFii(existente.impostoRetidoNoMes);
        setAliquotaFiiPct(Math.round((parseFloat(existente.aliquota) || 20)));
        setNegAnteriorFii(existente.resultadoNegativoMesAnterior || 0);
        setRetidoAnterioresFii(existente.impostoRetidoMesesAnteriores || 0);
        setImpostoPago(existente.impostoPago || 0);
      } else {
        const vc = existente.comuns?.resultadoLiquidoMes || 0;
        const vd = existente.daytrade?.resultadoLiquidoMes || 0;
        setResultadoComuns(Math.abs(vc)); setPrejuizoComuns(vc < 0);
        setResultadoDayTrade(Math.abs(vd)); setPrejuizoDayTrade(vd < 0);
        setIrrfComuns(existente.consolidacao?.irFonteLei11033Mes ?? '');
        setIrrfDayTrade(existente.consolidacao?.irFonteDayTradeMes ?? '');
        setNegAnteriorComuns(existente.comuns?.resultadoNegativoMesAnterior || 0);
        setNegAnteriorDayTrade(existente.daytrade?.resultadoNegativoMesAnterior || 0);
        setIrrf11033Anteriores(existente.consolidacao?.irFonteLei11033MesesAnteriores || 0);
        setIrrfDTAnteriores(existente.consolidacao?.irFonteDayTradeMesesAnteriores || 0);
        setImpostoPago(existente.consolidacao?.impostoPago || 0);
      }
      setImpostoPagoSujo(true); // valor da linha existente, não recalcular por cima
      return;
    }
    const sug = sugerirCarry({
      linhasDoAno, linhasAnoAnterior, mes,
      titular: beneficiarioAtivo.titular, cpfDependente: beneficiarioAtivo.cpfDependente, ficha,
    });
    setOrigemCarry(sug.origem);
    if (ficha === 'fii') {
      setResultadoFii(''); setPrejuizoFii(false); setIrrfFii(''); setAliquotaFiiPct(20);
      setNegAnteriorFii(sug.negAnterior || 0);
      setRetidoAnterioresFii(sug.irrfAnteriores || 0);
    } else {
      setResultadoComuns(''); setPrejuizoComuns(false);
      setResultadoDayTrade(''); setPrejuizoDayTrade(false);
      setIrrfComuns(''); setIrrfDayTrade('');
      setNegAnteriorComuns(sug.negAnteriorComuns || 0);
      setNegAnteriorDayTrade(sug.negAnteriorDayTrade || 0);
      setIrrf11033Anteriores(sug.irrf11033Anteriores || 0);
      setIrrfDTAnteriores(sug.irrfDTAnteriores || 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mes, benChave]);

  const linhaCalculada = useMemo(() => {
    if (!beneficiarioAtivo) return null;
    const base = { mes, titular: beneficiarioAtivo.titular, cpfDependente: beneficiarioAtivo.cpfDependente };
    if (ficha === 'fii') {
      const resultado = (prejuizoFii ? -1 : 1) * (Number(resultadoFii) || 0);
      return calcularMesFii({
        ...base,
        resultado, irrfRetido: irrfFii, aliquota: (Number(aliquotaFiiPct) || 0) / 100,
        negAnterior: negAnteriorFii, retidoAnteriores: retidoAnterioresFii,
      });
    }
    const rComuns = (prejuizoComuns ? -1 : 1) * (Number(resultadoComuns) || 0);
    const rDayTrade = (prejuizoDayTrade ? -1 : 1) * (Number(resultadoDayTrade) || 0);
    return calcularMesComuns({
      ...base,
      resultadoComuns: rComuns, resultadoDayTrade: rDayTrade,
      irrfComuns11033: irrfComuns, irrfDayTrade,
      negAnteriorComuns, negAnteriorDayTrade,
      irrf11033Anteriores, irrfDTAnteriores,
    });
  }, [
    beneficiarioAtivo, mes, ficha,
    resultadoFii, prejuizoFii, irrfFii, aliquotaFiiPct, negAnteriorFii, retidoAnterioresFii,
    resultadoComuns, prejuizoComuns, resultadoDayTrade, prejuizoDayTrade, irrfComuns, irrfDayTrade,
    negAnteriorComuns, negAnteriorDayTrade, irrf11033Anteriores, irrfDTAnteriores,
  ]);

  const impostoPagarCalculado = ficha === 'fii' ? (linhaCalculada?.impostoAPagar || 0) : (linhaCalculada?.consolidacao?.impostoPagar || 0);
  useEffect(() => {
    if (!impostoPagoSujo) setImpostoPago(impostoPagarCalculado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impostoPagarCalculado]);

  const handleSalvar = (e) => {
    e.preventDefault();
    const linhaFinal = { ...linhaCalculada };
    if (ficha === 'fii') {
      linhaFinal.impostoPago = Number(impostoPago) || 0;
    } else {
      linhaFinal.consolidacao = { ...linhaFinal.consolidacao, impostoPago: Number(impostoPago) || 0 };
    }
    onSalvar(linhaFinal);
    onClose();
  };

  if (!open || !beneficiarioAtivo) return null;

  const tituloFicha = ficha === 'fii' ? 'FII ou Fiagro' : 'Operações Comuns / Day-Trade';

  return (
    <Modal open={open} onClose={onClose}>
      <div className="modal-header">
        <h3>Incluir mês: {tituloFicha}, {ano}</h3>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <form onSubmit={handleSalvar}>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Mês</label>
              <select className="form-control" value={mes} onChange={e => setMes(Number(e.target.value))}>
                {MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Beneficiário</label>
              <select className="form-control" value={benChave} onChange={e => setBenChave(e.target.value)}>
                {beneficiarios.map(b => <option key={b.chave} value={b.chave}>{b.nome}</option>)}
              </select>
            </div>
          </div>

          {existente && (
            <Ajuda
              tom="ressalva"
              rotulo={existente.origem === 'manual' ? 'Vai substituir o lançamento manual deste mês' : 'Vai substituir o valor oficial na exibição'}
              titulo={existente.origem === 'manual' ? 'Lançamento manual já existe' : 'Já existe valor oficial da declaração'}
              texto={existente.origem === 'manual'
                ? 'Já existe um lançamento manual para este mês e beneficiário. Salvar vai substituir os valores dele. Os campos abaixo já vieram carregados com o que está salvo.'
                : 'A declaração importada já traz um valor oficial para este mês e beneficiário. Salvar não altera a declaração original, só substitui o que aparece na tabela mensal (o manual prevalece na exibição).'}
            />
          )}
          {mesesPosteriores > 0 && (
            <Ajuda
              tom="ressalva"
              rotulo={`${mesesPosteriores} mês(es) posterior(es) já lançado(s) para este beneficiário`}
              titulo="Meses posteriores não são recalculados"
              texto="Existem meses depois deste já lançados para o mesmo beneficiário. Eles não são recalculados automaticamente ao salvar este mês; confira o carry-forward deles manualmente se o resultado deste mês mudar o prejuízo a compensar."
            />
          )}

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 12px' }}>
            Prejuízo/IRRF anteriores pré-preenchidos a partir do {ORIGEM_TEXTO[origemCarry] || origemCarry}. Editáveis.
          </p>

          {ficha === 'fii' ? (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Resultado líquido do mês</label>
                  <MoneyInput value={resultadoFii} onChange={setResultadoFii} />
                  <label style={{ fontWeight: 400, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <input type="checkbox" checked={prejuizoFii} onChange={e => setPrejuizoFii(e.target.checked)} /> Foi prejuízo (negativo)
                  </label>
                </div>
                <div className="form-group"><label>IRRF retido no mês</label><MoneyInput value={irrfFii} onChange={setIrrfFii} /></div>
                <div className="form-group" style={{ maxWidth: '120px' }}>
                  <label>Alíquota (%)</label>
                  <input className="form-control" type="number" min="0" max="100" step="1" value={aliquotaFiiPct} onChange={e => setAliquotaFiiPct(e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Negativo até o mês anterior</label><MoneyInput value={negAnteriorFii} onChange={setNegAnteriorFii} /></div>
                <div className="form-group"><label>IRRF de meses anteriores</label><MoneyInput value={retidoAnterioresFii} onChange={setRetidoAnterioresFii} /></div>
              </div>
            </>
          ) : (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Resultado líquido comuns</label>
                  <MoneyInput value={resultadoComuns} onChange={setResultadoComuns} />
                  <label style={{ fontWeight: 400, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <input type="checkbox" checked={prejuizoComuns} onChange={e => setPrejuizoComuns(e.target.checked)} /> Foi prejuízo (negativo)
                  </label>
                </div>
                <div className="form-group">
                  <label>Resultado day-trade</label>
                  <MoneyInput value={resultadoDayTrade} onChange={setResultadoDayTrade} />
                  <label style={{ fontWeight: 400, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <input type="checkbox" checked={prejuizoDayTrade} onChange={e => setPrejuizoDayTrade(e.target.checked)} /> Foi prejuízo (negativo)
                  </label>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>IRRF Lei 11.033 do mês</label><MoneyInput value={irrfComuns} onChange={setIrrfComuns} /></div>
                <div className="form-group"><label>IRRF day-trade do mês</label><MoneyInput value={irrfDayTrade} onChange={setIrrfDayTrade} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Negativo comuns até o mês anterior</label><MoneyInput value={negAnteriorComuns} onChange={setNegAnteriorComuns} /></div>
                <div className="form-group"><label>Negativo day-trade até o mês anterior</label><MoneyInput value={negAnteriorDayTrade} onChange={setNegAnteriorDayTrade} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>IRRF Lei 11.033 de meses anteriores</label><MoneyInput value={irrf11033Anteriores} onChange={setIrrf11033Anteriores} /></div>
                <div className="form-group"><label>IRRF day-trade de meses anteriores</label><MoneyInput value={irrfDTAnteriores} onChange={setIrrfDTAnteriores} /></div>
              </div>
            </>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Imposto pago (DARF), se diferente do apurado</label>
              <MoneyInput value={impostoPago} onChange={v => { setImpostoPago(v); setImpostoPagoSujo(true); }} />
            </div>
          </div>

          {/* Prévia ao vivo — mesmas funções de núcleo que gravam o lançamento. */}
          <div className="rv-resumo" style={{ marginTop: '4px' }}>
            {ficha === 'fii' ? (
              <>
                <div><span className="rv-resumo-rotulo">Base de cálculo</span><span className="rv-resumo-valor">{formatCurrency(linhaCalculada?.baseCalculoImposto || 0)}</span></div>
                <div><span className="rv-resumo-rotulo">Prejuízo a compensar</span><span className="rv-resumo-valor">{formatCurrency(linhaCalculada?.prejuizoCompensar || 0)}</span></div>
                <div><span className="rv-resumo-rotulo">Imposto devido</span><span className="rv-resumo-valor">{formatCurrency(linhaCalculada?.impostoDevido || 0)}</span></div>
                <div><span className="rv-resumo-rotulo">Imposto a pagar (apurado)</span><span className="rv-resumo-valor">{formatCurrency(impostoPagarCalculado)}</span></div>
              </>
            ) : (
              <>
                <div><span className="rv-resumo-rotulo">Base comuns</span><span className="rv-resumo-valor">{formatCurrency(linhaCalculada?.comuns?.baseCalculoImposto || 0)}</span></div>
                <div><span className="rv-resumo-rotulo">Base day-trade</span><span className="rv-resumo-valor">{formatCurrency(linhaCalculada?.daytrade?.baseCalculoImposto || 0)}</span></div>
                <div><span className="rv-resumo-rotulo">Prejuízo comuns a compensar</span><span className="rv-resumo-valor">{formatCurrency(linhaCalculada?.comuns?.prejuizoCompensar || 0)}</span></div>
                <div><span className="rv-resumo-rotulo">Prejuízo day-trade a compensar</span><span className="rv-resumo-valor">{formatCurrency(linhaCalculada?.daytrade?.prejuizoCompensar || 0)}</span></div>
                <div><span className="rv-resumo-rotulo">Imposto devido (total)</span><span className="rv-resumo-valor">{formatCurrency(linhaCalculada?.consolidacao?.totalImpostoDevido || 0)}</span></div>
                <div><span className="rv-resumo-rotulo">Imposto a pagar (apurado)</span><span className="rv-resumo-valor">{formatCurrency(impostoPagarCalculado)}</span></div>
              </>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary">Salvar</button>
        </div>
      </form>
    </Modal>
  );
}
