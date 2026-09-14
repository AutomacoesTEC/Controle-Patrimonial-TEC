import { useState } from 'react';
import Modal from './Modal';
import Ajuda from './Ajuda';
import { formatCurrency as moeda, formatDate, descreverOrigemDocumento } from '../utils/formatters';
import { acompanhamentoDo } from '../store/acompanhamento';
const dinheiro = n => n == null ? 'Não informado' : moeda(n / 100);
export default function ResumoDemonstrativo({ inicial, final, variacao, conciliacao, financeiro, posicoes, cobertura, parcelas, state, pessoa, ate, onNavigate, onDetalhar, controles, contexto, variacaoCard, conciliacaoCards }) {
  const [classeDetalhada, setClasseDetalhada] = useState(null);
  const grupoDetalhado = posicoes.grupos.find(g => g.classe === classeDetalhada);
  const itensDetalhados = posicoes.itens.filter(i => i.classe === classeDetalhada && Math.round(i.valor * 100) !== 0);
  const navegar = (aba = 'caixa', operacao = '') => onNavigate?.('acompanhamento', { mes: ate.slice(0, 7), pessoa, aba: typeof aba === 'string' ? aba : 'caixa', operacao });
  const a = acompanhamentoDo(state);
  const avaliacoes = [...new Map(a.avaliacoes.filter(v => v.data <= ate && (pessoa === 'todos' || v.pessoa === pessoa)).sort((x,y) => x.data.localeCompare(y.data)).map(v => [v.pessoa + ':' + v.chaveBem, v])).values()];
  const classeVariacao = variacao > 0 ? 'positive' : variacao < 0 ? 'negative' : '';
  const classeConciliacao = conciliacao > 0 ? 'positive' : conciliacao < 0 ? 'negative' : '';
  return <section className="resumo-auditado" aria-label="Resumo do demonstrativo">
    <div className="demo-ledger">
      <div className="demo-ledger-cabecalho">
        <div>
          <span className="demo-ledger-kicker">Fechamento patrimonial</span>
          <h3>Resumo do demonstrativo</h3>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onDetalhar}>Ver composição</button>
      </div>
      <dl className="demo-ledger-valores">
        <div>
          <dt>Patrimônio inicial</dt>
          <dd>{moeda(inicial)}</dd>
        </div>
        <div>
          <dt>Patrimônio final</dt>
          <dd>{moeda(final)}</dd>
        </div>
        <div className="demo-ledger-variacao">
          <dt>Variação patrimonial</dt>
          <dd className={`currency ${classeVariacao}`}>{moeda(variacao)}</dd>
        </div>
      </dl>
      {conciliacao != null && (
        <div className="demo-ledger-resultado">
          <div>
            <strong>Resultado da conciliação patrimonial</strong>
            <span>Diferença que orienta a conferência do período</span>
          </div>
          <strong className={`currency ${classeConciliacao}`}>{moeda(conciliacao)}</strong>
        </div>
      )}
    </div>
    {variacaoCard}
    {controles}
    {contexto}
    <div className="card demo-visao demonstrativo-bloco">
      <h3>Posições declaradas e atualizações manuais</h3><p>Valores registrados em {formatDate(ate)}. Direitos a receber e recursos bloqueados são separados das contas e dos investimentos.</p>
      <div className="demo-posicoes">{posicoes.grupos.map(g => <div key={g.classe}><span>{g.nome} <button type="button" className="ajuda-marca" aria-label={'Ver composição de '+g.nome} aria-haspopup="dialog" onClick={() => setClasseDetalhada(g.classe)}>?</button></span><strong>{moeda(g.valor)}</strong></div>)}</div>
      <details><summary>Consultar classificação e origem dos ativos</summary><div className="table-wrapper"><table><thead><tr><th>Bem / direito</th><th>Classificação</th><th>Critério</th><th>Posição</th></tr></thead><tbody>{posicoes.itens.filter(i => i.valor).map(i => <tr key={i.id}><td>{i.descricao}</td><td>{posicoes.grupos.find(g => g.classe === i.classe)?.nome}</td><td>{i.base}</td><td className="currency">{moeda(i.valor)}</td></tr>)}</tbody></table></div><p>Indicações lidas da descrição são revisáveis. Edite a classe financeira no cadastro do bem; o grupo fiscal permanece independente.</p><button className="btn btn-secondary" onClick={() => onNavigate?.('bens')}>Classificar em Bens e Direitos</button></details>
    </div>
    {conciliacaoCards}
    {financeiro && <details className="card demo-visao demonstrativo-bloco demo-caixa-detalhes"><summary>Detalhamento do caixa e conferência bancária</summary><p>{financeiro.contas ? 'Movimentos efetivamente registrados nas contas disponíveis do recorte.' : 'Cadastre contas e baixas financeiras para acompanhar recebimentos e pagamentos.'} Contratos, parcelas previstas e rendimentos anuais não são somados novamente ao caixa.</p>
      <div className="demo-posicoes">{[['Inicial',financeiro.inicial],['Aberturas',financeiro.aberturas],['Entradas externas',financeiro.entradas],['Saídas externas',financeiro.saidas],['Transferências no recorte',financeiro.transferencias],['Final registrado',financeiro.final]].map(([label,n]) => <div key={label}><span>{label}</span><strong>{financeiro.contas ? dinheiro(n) : 'Não informado'}</strong></div>)}</div>
      <p><strong>{financeiro.extratosCompletos ? 'Saldos mensais conferem com os extratos informados.' : 'Conferência bancária pendente.'}</strong> {financeiro.diferenca != null && 'Diferença no saldo final: ' + dinheiro(financeiro.diferenca) + '.'} A conferência não certifica contas ou movimentos que ainda não foram cadastrados.</p>
      <h4>Origens e aplicações de recursos <Ajuda titulo="Como ler o movimento de caixa" texto="O saldo inicial, somado aos recebimentos e descontado dos pagamentos, explica o saldo final das contas cadastradas. IRRF já descontado do recebimento não entra novamente como recurso nem como nova saída. Venda ou resgate entra pelo valor efetivamente recebido, sem somar o principal e o ganho outra vez. Restituição entra no caixa quando recebida. Transferências entre contas incluídas no mesmo recorte se anulam." /></h4>
      <div className="demo-fluxo-grupos">{[['entrada', 'Origens (recebimentos)', financeiro.entradas], ['saida', 'Aplicações (pagamentos)', financeiro.saidas]].map(([sentido, titulo, total]) => {
        const grupos = financeiro.categorias.filter(c => c.sentido === sentido && c.valor);
        const pendente = financeiro.semClassificacao.filter(l => l.tipo === sentido).reduce((s,l) => s + l.valor, 0);
        return <div key={sentido}><h4>{titulo}</h4><div className="table-wrapper"><table><tbody>{grupos.map(c => <tr key={c.id}><td>{c.nome}</td><td className="currency">{dinheiro(c.valor)}</td></tr>)}{pendente > 0 && <tr><td>Natureza a classificar</td><td className="currency">{dinheiro(pendente)}</td></tr>}{!grupos.length && !pendente && <tr><td colSpan={2}>Nenhum movimento registrado neste recorte.</td></tr>}</tbody><tfoot><tr><th>Total</th><td className="currency"><strong>{financeiro.contas ? dinheiro(total) : 'Não informado'}</strong></td></tr></tfoot></table></div></div>;
      })}</div>
      <p>{financeiro.semClassificacao.length} movimento(s) a classificar; {financeiro.semDocumento.length} sem referência documental. Cobertura por valor das entradas e saídas registradas: {financeiro.coberturaDocumental == null ? 'não calculável' : financeiro.coberturaDocumental.toLocaleString('pt-BR', {maximumFractionDigits:1}) + '%'}. Referência documental não equivale a documento validado.</p>
      <p>Diferença de fontes no perímetro das contas: <strong>{financeiro.gapContas == null ? 'Não validável sem saldo de extrato' : dinheiro(financeiro.gapContas)}</strong>. Não inclui aplicações ou fontes externas ainda não registradas.</p>
      <details><summary>Ver movimentos e documentos</summary><div className="table-wrapper"><table><thead><tr><th>Data</th><th>Descrição / contraparte</th><th>Classificação</th><th>Operação</th><th>Referência</th><th>Valor</th></tr></thead><tbody>{financeiro.externos.map(l => <tr key={l.id}><td>{formatDate(l.data)}</td><td>{l.descricao} / {l.contraparte}</td><td>{l.rotuloCategoria}</td><td>{l.operacao}</td><td>{l.referencia || 'Pendente'}</td><td className="currency">{dinheiro(l.valor)}</td></tr>)}</tbody></table></div></details>
      <button className="btn btn-primary" onClick={navegar}>Preencher contas, movimentos e documentos</button>
    </details>}
    {avaliacoes.length > 0 && <details className="card demo-visao demonstrativo-bloco"><summary>Avaliações de mercado cadastradas</summary><p>Visão independente do custo fiscal. Financiamentos e outros passivos econômicos devem ser acompanhados nas operações, mesmo quando não constam da ficha de dívidas da declaração.</p><strong>{avaliacoes.length ? dinheiro(avaliacoes.reduce((s,v) => s + v.valor, 0)) + ' em avaliações cadastradas' : 'Nenhuma avaliação cadastrada neste recorte'}</strong><p>Este total parcial não representa patrimônio líquido econômico completo.</p><button className="btn btn-secondary" onClick={() => navegar('economico')}>Abrir avaliações e operações</button></details>}
    {parcelas.length > 0 && <details className="card demo-visao demonstrativo-bloco"><summary>Vendas parceladas: contrato, declaração e recebimentos</summary><p>Valores declarados são apresentados para confronto. Somente baixas financeiras entram no caixa; vincule a operação à apuração importada para relacionar as duas fontes.</p><div className="table-wrapper"><table><thead><tr><th>Operação</th><th>Contrato</th><th>Parcelas declaradas no período</th><th>Contrato menos parcelas informadas até a data</th><th>Baixas vinculadas no período</th></tr></thead><tbody>{parcelas.map((p,i) => <tr key={p.ano + ':' + p.id + ':' + i}><td>{p.bem}{p.vinculado && <button className="btn btn-secondary btn-sm" onClick={() => navegar('operacoes', p.operacaoId)}>Abrir operação</button>}</td><td className="currency">{moeda(p.contrato)}</td><td className="currency">{moeda(p.recebidoDeclarado)}</td><td className="currency">{moeda(p.diferencaContratoParcelas)}</td><td>{p.vinculado ? moeda(p.baixas) : 'Vincular operação'}</td></tr>)}</tbody></table></div><p>A diferença contratual não confirma dívida em aberto: parcelas de outros exercícios podem faltar neste documento.</p><button className="btn btn-secondary" onClick={navegar}>Vincular operação e registrar recebimento</button></details>}
    <Modal open={!!grupoDetalhado} onClose={() => setClasseDetalhada(null)} style={{maxWidth: '1000px', width: 'calc(100vw - 32px)'}}>
      <div className="modal-header"><h3>Composição: {grupoDetalhado?.nome}</h3><button type="button" className="modal-close" aria-label="Fechar composição" onClick={() => setClasseDetalhada(null)}>×</button></div>
      <div className="modal-body">
        <p>Registros que compõem o saldo em {formatDate(ate)}, conforme a titularidade selecionada no demonstrativo.</p>
        {itensDetalhados.length ? <div className="table-wrapper"><table className="demo-composicao-saldo"><thead><tr><th>Bem ou direito</th><th>Critério de classificação</th><th>Valor</th></tr></thead><tbody>{itensDetalhados.map((i,indice) => <tr key={i.id + ':' + indice}><td>{i.descricao || 'Registro sem descrição'}<small className="demo-origem-saldo">{i.origemDocumento ? (descreverOrigemDocumento(i) || 'Declaração importada') : 'Cadastro manual'}</small></td><td>{i.base}</td><td className="currency">{moeda(i.valor)}</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>Total de {grupoDetalhado?.nome}</th><td className="currency"><strong>{moeda(grupoDetalhado?.valor || 0)}</strong></td></tr></tfoot></table></div> : <p>Nenhum registro com saldo nesta categoria para a data e a titularidade selecionadas.</p>}
      </div>
      <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setClasseDetalhada(null)}>Fechar</button></div>
    </Modal>
  </section>;
}
