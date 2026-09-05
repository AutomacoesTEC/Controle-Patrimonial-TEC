import { useState, useMemo } from 'react';
import { useData } from '../store/DataContext';
import { situacaoBemAteData, situacaoDividaAteData } from '../store/demonstrativos';
import { formatCurrency, formatDate, MOVIMENTACAO_TIPOS } from '../utils/formatters';
import MoneyInput from './MoneyInput';
import Ajuda from './Ajuda';
import { estadoNoAno, correspondenteNoAno } from '../store/reducer';
import { anoDaDataCadastro } from '../utils/dataCadastro';

// Bloco de "registrar movimentação" de um bem (venda, compra, benfeitoria,
// baixa, ajuste), reaproveitado entre Bens e Direitos (BemModal) e Bens da
// Atividade Rural. `actionType` escolhe qual reducer action disparar
// (REGISTRAR_MOVIMENTACAO_BEM ou REGISTRAR_MOVIMENTACAO_BEM_RURAL) — as
// duas fazem a mesma coisa, só em coleções diferentes do estado.
// Também serve para dívidas (DividasPage): `tipos` troca a tabela de
// rótulos/ajuda (MOVIMENTACAO_DIVIDA_TIPOS) e `tipoInicial` o tipo
// pré-selecionado. Como nenhum tipo de dívida é venda, os campos
// valorVenda/irrfVenda nem aparecem. Sem parágrafo de introdução de
// propósito: o texto de ajuda por tipo (abaixo do seletor) já explica o
// que cada movimentação faz — um segundo parágrafo fixo só repetia a
// mesma ideia em palavras diferentes (achado real de poluição visual,
// tela de Bens e Direitos com o painel de movimentação sobrecarregado).
// delete/updateActionType espelham actionType (mesma correspondência
// bem/bem rural/dívida) — nunca são passados direto pelo chamador, são
// derivados abaixo.
const DELETE_ACTION_POR_ACTION = {
  REGISTRAR_MOVIMENTACAO_BEM: 'DELETE_MOVIMENTACAO_BEM',
  REGISTRAR_MOVIMENTACAO_BEM_RURAL: 'DELETE_MOVIMENTACAO_BEM_RURAL',
  REGISTRAR_MOVIMENTACAO_DIVIDA: 'DELETE_MOVIMENTACAO_DIVIDA',
  REGISTRAR_MOVIMENTACAO_DIVIDA_RURAL: 'DELETE_MOVIMENTACAO_DIVIDA_RURAL',
};
const UPDATE_ACTION_POR_ACTION = {
  REGISTRAR_MOVIMENTACAO_BEM: 'UPDATE_MOVIMENTACAO_BEM',
  REGISTRAR_MOVIMENTACAO_BEM_RURAL: 'UPDATE_MOVIMENTACAO_BEM_RURAL',
  REGISTRAR_MOVIMENTACAO_DIVIDA: 'UPDATE_MOVIMENTACAO_DIVIDA',
  REGISTRAR_MOVIMENTACAO_DIVIDA_RURAL: 'UPDATE_MOVIMENTACAO_DIVIDA_RURAL',
};

// "?" com tooltip nativo (mesma técnica do title="Excluir esta
// movimentação" já usado nos botões abaixo) — troca o parágrafo de ajuda
// sempre visível por uma explicação sob demanda, só quando a pessoa passa o
// mouse ou dá foco. Achado real: mesmo já tendo encurtado esses textos numa
// rodada anterior, continuavam pesando na tela por ficarem sempre à mostra.

export default function MovimentacaoBemForm({
  bem,
  actionType = 'REGISTRAR_MOVIMENTACAO_BEM',
  tipos = MOVIMENTACAO_TIPOS,
  tipoInicial = 'venda_parcial',
  anoCalendario,
}) {
  const { state, dispatch, addToast, confirmar } = useData();
  const [movTipo, setMovTipo] = useState(tipoInicial);
  const [movValor, setMovValor] = useState('');
  const [movValorVenda, setMovValorVenda] = useState('');
  const [movIrrfVenda, setMovIrrfVenda] = useState('');
  // Sem valor padrão: preenchia sozinha com a data real do sistema, então
  // uma movimentação registrada num ano-calendário passado (ex.: 2025)
  // acabava datada de hoje (ex.: 2026) sem a pessoa perceber — ela tinha
  // que digitar a data de propósito, nunca herdar a de hoje de graça.
  const [movData, setMovData] = useState('');
  const [movDescricao, setMovDescricao] = useState('');
  // null = registrando movimentação nova; id da movimentação = editando uma
  // já existente (formulário reaproveitado, só troca o que o botão faz).
  const [editingId, setEditingId] = useState(null);

  const isVenda = movTipo === 'venda_parcial' || movTipo === 'venda_total';
  // Bem da Atividade Rural: a venda dele NÃO gera ganho de capital, o valor
  // recebido é receita bruta da atividade rural e vai para o livro-caixa
  // (IN SRF 83/2001, art. 5º, § 2º, III; Decreto nº 9.580/2018, art. 54,
  // § 1º, III) — ver ganhosApuradosPeriodo em demonstrativos.js. Por isso o
  // card de Ganho de Capital dá lugar a um aviso: pedir "valor de venda"
  // aqui só levaria a pessoa a esperar um ganho que a tela nunca vai mostrar.
  const isBemRural = actionType === 'REGISTRAR_MOVIMENTACAO_BEM_RURAL';
  const isDivida = actionType.includes('DIVIDA');

  // Quanto o bem/dívida VALIA na véspera desta movimentação.
  //
  // É o número que uma baixa total precisa registrar como custo que sai, e o
  // teto de uma venda parcial. Vem reconstruído por data (situacao_anterior
  // mais as movimentações anteriores à data escolhida), e não da
  // `situacao_atual`.
  //
  // ACHADO 01 da auditoria de 24/08/2026, o mais grave da tela. A versão
  // anterior usava `bem.situacao_atual` como custo baixado numa venda total.
  // Num bem que a declaração já trouxe zerado — anterior 21.000,00, atual
  // 0,00, o caso normal de veículo vendido no ano — isso gravava custo ZERO,
  // e o Demonstrativo calculava `ganho = valorVenda − 0`. Reproduzido
  // clicando na tela: registrar a venda real por R$ 18.000,00 virava um
  // GANHO de R$ 18.000,00 onde o certo é PERDA de R$ 3.000,00, inflando o
  // Saldo de Caixa em R$ 21.000,00.
  //
  // Sem data escolhida ainda, cai na situação atual e, se ela for zero, na
  // anterior — é só o valor exibido no campo antes de a pessoa escolher a
  // data; o que vale no registro é sempre a reconstrução pela data.
  const situacaoNaVespera = useMemo(() => {
    const ano = anoDaDataCadastro(movData);
    if (ano) {
      const colecao = isDivida ? (actionType.endsWith('_RURAL') ? 'dividasRurais' : 'dividas') : (isBemRural ? 'bensRurais' : 'bens');
      const destino = estadoNoAno(state, ano);
      const alvo = correspondenteNoAno(destino[colecao], bem) || bem;
      return isDivida ? situacaoDividaAteData(alvo, movData, 'de') : situacaoBemAteData(alvo, movData, 'de');
    }
    const atual = parseFloat(bem.situacao_atual) || 0;
    return atual > 0 ? atual : (parseFloat(bem.situacao_anterior) || 0);
  }, [bem, movData, isDivida, isBemRural, actionType, state]);

  // Tipos que zeram o saldo (venda total, baixa, quitação) numa movimentação
  // NOVA: o valor não é digitado, vem da situação na véspera.
  const zeraOSaldo = !editingId && tipos[movTipo]?.sinal === '0';
  // O custo efetivo desta operação, usado no aviso de ganho sem IRRF.
  const custoDaVenda = zeraOSaldo ? situacaoNaVespera : (parseFloat(movValor) || 0);

  const limparFormulario = () => {
    setMovValor(''); setMovValorVenda(''); setMovIrrfVenda(''); setMovDescricao('');
    setEditingId(null);
  };

  const handleRegistrar = async () => {
    // Tipos com sinal '0' (venda_total/baixa em bens, quitacao em dívidas)
    // zeram o saldo e o campo "valor" fica desabilitado na tela — mas ainda
    // precisa guardar QUANTO estava sendo baixado (em bens, é o custo de
    // aquisição que sai, senão a aba Ganhos de Capital não tem como calcular
    // o ganho/perda de uma venda total depois). Usa o valor vivo no momento
    // do registro. Só se aplica a movimentação NOVA: editando uma já
    // existente, o valor é o que a pessoa digitar (é uma correção de
    // histórico, não uma baixa em cima do saldo atual, que já reflete essa
    // mesma movimentação).
    const zeraTudo = zeraOSaldo;
    if (!anoDaDataCadastro(movData)) {
      addToast('Informe uma data válida para a movimentação (ano de 0001 a 9999).', 'error');
      return;
    }
    // `situacaoNaVespera` (reconstruída pela data) no lugar de
    // `bem.situacao_atual` — ver o comentário da definição, achado 01.
    const valor = zeraTudo ? situacaoNaVespera : (parseFloat(movValor) || 0);
    if (!zeraTudo && valor <= 0) {
      alert('Informe um valor maior que zero para essa movimentação.');
      return;
    }
    // ACHADO 11 da auditoria de 24/08/2026: uma venda parcial de R$ 1.000,00
    // num bem que valia R$ 0,01 era aceita sem nenhum aviso. O saldo aplicava
    // o piso em zero e caía um centavo, enquanto o ganho de capital usava o
    // valor cheio da movimentação como custo — as duas contas passavam a
    // olhar custos diferentes para a mesma operação. Confirmação, não
    // bloqueio: pode ser um valor anterior cadastrado errado, e quem decide
    // é a usuária.
    if (movTipo === 'venda_parcial' && valor > situacaoNaVespera + 0.005) {
      const confirmaExcesso = await confirmar({
        titulo: 'Confirmar valor maior que o saldo do bem?',
        texto: `O valor da venda (${formatCurrency(valor)}) é maior do que o bem valia em ${formatDate(movData)} (${formatCurrency(situacaoNaVespera)}).\n\n` +
          `O saldo não fica negativo, mas o ganho de capital será calculado sobre o valor que você informou.`,
        textoConfirmar: 'Confirmar',
      });
      if (!confirmaExcesso) return;
    }
    // Confirmação, não bloqueio: pode ser uma movimentação legítima de
    // virada de ano (ex.: venda em janeiro do ano seguinte lançada aqui
    // antes do "Avançar para o próximo ano"), então só avisa — não impede.
    const anoDaData = anoDaDataCadastro(movData);
    if (anoCalendario != null && anoDaData !== anoCalendario) {
      const confirma = await confirmar({
        titulo: 'Confirmar data de outro ano-calendário?',
        texto: `A data informada (${formatDate(movData)}) é de ${anoDaData}, diferente do ano-calendário selecionado (${anoCalendario}).`,
        textoConfirmar: 'Confirmar',
      });
      if (!confirma) return;
    }
    const movimentacao = { tipo: movTipo, valor, data: movData, descricao: movDescricao };
    // valorVenda (preço recebido) só faz sentido numa venda, e é opcional:
    // sem ele, a movimentação é registrada normalmente, só não entra na
    // aba Ganhos de Capital (que precisa do preço de venda pra calcular).
    if (isVenda && movValorVenda !== '') movimentacao.valorVenda = parseFloat(movValorVenda) || 0;
    // IRRF pago sobre o ganho da venda (15% em operações comuns de renda
    // variável/alienação, mas o valor real pago pode variar por alíquota
    // progressiva) — usado só para o Demonstrativo de Conciliação
    // Patrimonial do Dashboard calcular o "ganho líquido de IRRF".
    if (isVenda && movIrrfVenda !== '') movimentacao.irrfVenda = parseFloat(movIrrfVenda) || 0;
    const colecao = isDivida ? (actionType.endsWith('_RURAL') ? 'dividasRurais' : 'dividas') : (isBemRural ? 'bensRurais' : 'bens');
    if (!correspondenteNoAno(estadoNoAno(state, anoDaData)[colecao], bem)) {
      addToast('Não foi possível identificar este bem ou dívida no ano da data. Abra o ano de destino e selecione o registro correspondente.', 'error');
      return;
    }
    dispatch({ type: 'SALVAR_MOVIMENTACAO_DATADA', payload: { actionType, bemId: bem.id, movId: editingId, movimentacao } });
    addToast(`Movimentação ${editingId ? 'corrigida' : 'registrada'} em ${anoDaData}.`, 'success');
    limparFormulario();
  };

  // Preenche o formulário com a movimentação escolhida e troca "Registrar"
  // por "Salvar correção" — mesmo raciocínio de excluir/recriar sem perder
  // a data ou os campos opcionais que só existiam na 1ª tentativa (achado
  // real: sem isso, corrigir um "Valor de venda" digitado errado exigia
  // excluir a movimentação inteira e lembrar de preencher tudo de novo).
  const handleEditar = (mov) => {
    setEditingId(mov.id);
    setMovTipo(mov.tipo);
    setMovValor(mov.valor > 0 ? String(mov.valor) : '');
    setMovValorVenda(mov.valorVenda != null ? String(mov.valorVenda) : '');
    setMovIrrfVenda(mov.irrfVenda != null ? String(mov.irrfVenda) : '');
    setMovData(mov.data || '');
    setMovDescricao(mov.descricao || '');
  };

  const handleExcluir = async (mov) => {
    const rotulo = tipos[mov.tipo]?.label || mov.tipo;
    const ok = await confirmar({
      titulo: 'Excluir esta movimentação?',
      texto: `A movimentação "${rotulo}" de ${formatDate(mov.data)} será excluída. O valor é recalculado a partir do que sobrar. Essa ação não pode ser desfeita.`,
      textoConfirmar: 'Excluir',
      perigo: true,
    });
    if (!ok) return;
    dispatch({ type: DELETE_ACTION_POR_ACTION[actionType], payload: { bemId: bem.id, movId: mov.id } });
    addToast('Movimentação excluída.', 'info');
    if (editingId === mov.id) limparFormulario();
  };

  return (
    <>
    {/* Bloco destacado (borda e título em vermelho) a pedido da usuária em
        03/09/2026: quem abre "Editar Bem" veio para registrar a movimentação,
        e o bloco tem que saltar aos olhos. */}
    <div style={{ background: 'var(--bg-input)', border: '2px solid var(--accent-danger)', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '16px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-danger)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
        Registrar movimentação
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Tipo de movimentação<Ajuda texto={tipos[movTipo].ajuda} /></label>
          <select className="form-control" value={movTipo} onChange={e => setMovTipo(e.target.value)}>
            {Object.entries(tipos).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Data</label>
          <input className="form-control" type="date" min="0001-01-01" max="9999-12-31" value={movData} onChange={e => setMovData(e.target.value)} />
        </div>
        <div className="form-group">
          <label>
            {movTipo === 'ajuste' ? 'Novo valor' : 'Valor da movimentação'}
            {zeraOSaldo && (
              <Ajuda texto="Numa baixa total o valor não é digitado: é o que o bem valia na véspera desta data, e é ele que sai do patrimônio e serve de custo no cálculo do ganho de capital. Mude a data para ver o valor mudar." />
            )}
          </label>
          {/* Campo desabilitado, mas agora MOSTRANDO o valor que vai ser
              baixado, em vez de ficar em branco. Ficar vazio escondia
              justamente o número errado do achado 01, e ainda fazia o aviso
              de ganho comparar o preço de venda contra zero (achado 16). */}
          <MoneyInput
            value={zeraOSaldo ? situacaoNaVespera : movValor}
            onChange={setMovValor}
            disabled={zeraOSaldo}
          />
        </div>
      </div>
      <div className="form-group">
        <label>Descrição da movimentação</label>
        <input className="form-control" value={movDescricao} onChange={e => setMovDescricao(e.target.value)} placeholder="Ex: venda de 1/3 do imóvel, reforma da cozinha..." />
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" className="btn btn-sm btn-primary" onClick={handleRegistrar}>
          {editingId ? 'Salvar correção' : 'Registrar movimentação'}
        </button>
        {editingId && (
          <button type="button" className="btn btn-sm btn-secondary" onClick={limparFormulario}>
            Cancelar correção
          </button>
        )}
      </div>
    </div>

    {/* Card separado (não dentro da caixa cinza de "Registrar movimentação"):
        a usuária apontou, com captura de tela, que misturar ganho de
        capital com o registro da movimentação em si ficava confuso. Mesmo
        destaque azul claro já usado para números em foco em RelatorioPage/
        GanhosCapitalPage/AtividadeRuralPage (rgba(59,130,246,...)), aqui
        aplicado ao card inteiro em vez de só um número, pra separar
        visualmente sem inventar uma paleta nova. Continua condicionado a
        isVenda e alimentando os mesmos estados (movValorVenda/movIrrfVenda),
        só reposicionado — o registro em si continua no botão do card acima. */}
    {isVenda && !isBemRural && (
      <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
          Ganho de Capital desta Venda
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>
              Valor de venda (opcional)
              <Ajuda texto="Preço recebido pela venda. Junto com o IRRF, calcula sozinho o ganho líquido desta venda em Ganhos de Capital e no Demonstrativo de Conciliação Patrimonial." />
            </label>
            <MoneyInput value={movValorVenda} onChange={setMovValorVenda} />
          </div>
          <div className="form-group">
            <label>IRRF pago sobre o ganho (opcional)</label>
            <MoneyInput value={movIrrfVenda} onChange={setMovIrrfVenda} />
          </div>
        </div>
        {/* Aviso textual, sem calcular nem sugerir nenhum valor de imposto
            (decisão da usuária: receio de embutir regra de cálculo de IR
            num app de desktop, caso a legislação mude). Só avisa quando há
            ganho de fato (valor de venda maior que o valor da movimentação)
            e o IRRF ainda não foi preenchido. */}
        {/* Compara com o CUSTO REAL da operação, que numa baixa total é a
            situação na véspera e não o campo digitado (que fica desabilitado).
            Antes comparava com o campo vazio, isto é, com zero, e o aviso
            disparava em toda venda total — inclusive nas de prejuízo, onde
            não há ganho nenhum a conferir. Achado 16. */}
        {parseFloat(movValorVenda || 0) > custoDaVenda && movIrrfVenda === '' && (
          <p style={{ fontSize: '12px', color: 'var(--accent-warning, #f59e0b)', marginTop: '8px', marginBottom: 0 }}>
            Há ganho nesta venda mas o IRRF não foi informado, confira se houve retenção antes de salvar.
          </p>
        )}
      </div>
    )}

    {isVenda && isBemRural && (
      <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
          Esta venda não gera ganho de capital
        </div>
        <p style={{ margin: 0, fontSize: '13px' }}>
          O valor recebido na venda de um bem usado exclusivamente na atividade rural é receita bruta da própria
          atividade rural, apurada no livro-caixa, e não ganho de capital (IN SRF 83/2001, art. 5º, § 2º, III).
          Registre a baixa do bem aqui e lance o valor recebido como receita em Atividade Rural, aba Receitas e Despesas.
        </p>
      </div>
    )}

    {/* Bloco 4: card próprio (verde, mesmo tom já usado em
        .import-zone.active no index.css) para diferenciar visualmente da
        lista solta que existia antes — pedido da usuária junto com a
        reorganização em blocos coloridos do Bloco 1/2/3 acima. */}
    {(bem.movimentacoes || []).length > 0 && (
        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-success)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
            Movimentações já registradas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[...bem.movimentacoes].reverse().map(m => (
              <div
                key={m.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px',
                  fontSize: '12px', padding: '8px 10px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${editingId === m.id ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                }}
              >
                <div>
                  <strong>{MOVIMENTACAO_TIPOS[m.tipo]?.label || m.tipo}</strong>
                  {' '}em {formatDate(m.data)}
                  {m.valor > 0 && <>, {formatCurrency(m.valor)}</>}
                  {m.valorVenda != null && <>, vendido por {formatCurrency(m.valorVenda)}</>}
                  {m.irrfVenda != null && <>, IRRF {formatCurrency(m.irrfVenda)}</>}
                  {m.descricao && <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{m.descricao}</div>}
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button
                    type="button" className="btn btn-sm btn-secondary" title="Editar esta movimentação"
                    onClick={() => handleEditar(m)}
                  >
                    Editar
                  </button>
                  <button
                    type="button" className="btn btn-sm btn-danger" title="Excluir esta movimentação"
                    onClick={() => handleExcluir(m)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
    )}
    </>
  );
}
