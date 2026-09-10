import { useMemo } from 'react';
import { aplicacoesResgatadasSemRendimento, situacaoBemAteData } from '../store/demonstrativos';
import { dadosDoAno } from '../store/consultaPeriodo';
import { formatCurrency, formatCpfCnpj, describeRendimentoTipo, descreverOrigemDocumento } from '../utils/formatters';
import { rotuloTitularidade } from '../store/titularidade';

// Conferência opcional: redução do saldo não é prova de resgate ou rendimento omitido.
export default function ConferenciaAplicacoes({ state, mes }) {
  const ano = Number(mes.slice(0, 4));
  const de = ano + '-01-01';
  const ate = new Date(Date.UTC(ano, Number(mes.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const dados = useMemo(() => dadosDoAno(state, ano), [state, ano]);
  const itens = useMemo(() => dados ? aplicacoesResgatadasSemRendimento(dados, de, ate) : [], [dados, de, ate]);
  return <section className="card acomp-card" aria-label="Conferência opcional de aplicações">
    <details>
      <summary><strong>Conferência opcional de aplicações ({itens.length})</strong></summary>
      <p>Ano-calendário {ano}, até {mes.slice(5, 7)}/{ano}. Compara aplicações cujo saldo passou a zero com os rendimentos registrados para a mesma instituição. Isso não comprova resgate, rendimento omitido ou erro. O valor destacado é a redução do saldo, não um rendimento a lançar.</p>
      {!itens.length && <p>Nenhuma aplicação encontrada por esse critério no período selecionado.</p>}
      {itens.map(item => {
        const bem = (dados.bens || []).find(b => b.id === item.id);
        return <details className="import-review-details" key={item.id}>
          <summary>{item.discriminacao || 'Aplicação sem descrição'} (redução de saldo: {formatCurrency(item.valorResgatado)})</summary>
          <p><strong>{rotuloTitularidade(bem, dados.dependentes)}</strong>. CNPJ da instituição: {formatCpfCnpj(item.cnpj)}. Grupo {bem?.grupo}, código {bem?.codigo_bem}.</p>
          <p>{descreverOrigemDocumento(bem) || 'Referência de origem não disponível.'}</p>
          <p>Saldo no início: {formatCurrency(situacaoBemAteData(bem, de, 'de'))}. Saldo no fim do período: {formatCurrency(situacaoBemAteData(bem, ate, 'ate'))}.</p>
          <p>Motivo da comparação: não foi localizado rendimento da mesma instituição na categoria esperada pela regra do aplicativo: {item.onde}.</p>
          <p>Rendimentos encontrados para a instituição, sem atribuição automática a esta aplicação:</p>
          {item.outrosDaMesmaFonte.length ? <ul>{item.outrosDaMesmaFonte.map((r, i) => <li key={i}>{r.nome || 'Fonte sem nome'}: {describeRendimentoTipo(r.tipo)}, {formatCurrency(r.valor)}</li>)}</ul> : <p>Nenhum rendimento da mesma instituição encontrado no período.</p>}
          <p>Confira o informe da instituição e a movimentação desta aplicação. Só cadastre ou corrija um rendimento se o documento confirmar a necessidade. Esta consulta não altera os valores da conciliação.</p>
        </details>;
      })}
    </details>
  </section>;
}
