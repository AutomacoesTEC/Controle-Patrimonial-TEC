// Ícones do menu lateral quando recolhido. Antes o menu recolhido mostrava
// uma sigla de 2 letras por item (IM/DB/TD/BE...), que a usuária apontou como
// "estranho" (03/09/2026). São ícones de traço (outline), mesmo estilo dos
// ícones dos stat cards do Dashboard: viewBox 24, fill:none, stroke:currentColor,
// traço 2, pontas arredondadas. Sem emoji.
//
// O `title` do <button> continua trazendo o nome completo no hover, então o
// ícone é reforço visual, não a única forma de identificar o item.

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

const NAV_ICONS = {
  // Importar Declaração — seta para dentro de uma caixa
  importar: (
    <svg {...base}><path d="M12 3v12" /><path d="m8 11 4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
  ),
  // Dashboard — painéis
  dashboard: (
    <svg {...base}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>
  ),
  // Modalidade — ramificação (o ano tem regra própria)
  modalidade: (
    <svg {...base}><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>
  ),
  // Titular e Dependentes — pessoas
  titular: (
    <svg {...base}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  ),
  // Bens e Direitos — carteira
  bens: (
    <svg {...base}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
  ),
  // Dívidas e Ônus — cartão
  dividas: (
    <svg {...base}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
  ),
  // Rendimentos — cédula com cifrão
  rendimentos: (
    <svg {...base}><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M12 9v6" /><path d="M14 10.5a1.5 1.5 0 0 0-1.5-1.5h-1a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3h-1a1.5 1.5 0 0 1-1.5-1.5" /></svg>
  ),
  // Pagamentos Efetuados — recibo
  pagamentos: (
    <svg {...base}><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
  ),
  // Despesas Gerais — carrinho
  pagamentosDiversos: (
    <svg {...base}><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /><path d="M2 3h2l2.4 12.5a2 2 0 0 0 2 1.5h9.8a2 2 0 0 0 2-1.5L23 7H6" /></svg>
  ),
  // Doações — presente
  doacoes: (
    <svg {...base}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" /></svg>
  ),
  // Atividade Rural — espiga de trigo
  atividadeRural: (
    <svg {...base}><path d="M12 22V8" /><path d="M12 8c-1.5-1.5-4-1.5-5.5 0 1.5 1.5 4 1.5 5.5 0Z" /><path d="M12 8c1.5-1.5 4-1.5 5.5 0-1.5 1.5-4 1.5-5.5 0Z" /><path d="M12 13c-1.5-1.5-4-1.5-5.5 0 1.5 1.5 4 1.5 5.5 0Z" /><path d="M12 13c1.5-1.5 4-1.5 5.5 0-1.5 1.5-4 1.5-5.5 0Z" /><path d="M12 18c-1.5-1.5-4-1.5-5.5 0 1.5 1.5 4 1.5 5.5 0Z" /><path d="M12 18c1.5-1.5 4-1.5 5.5 0-1.5 1.5-4 1.5-5.5 0Z" /></svg>
  ),
  // Relatório IRPF — documento com linhas
  relatorio: (
    <svg {...base}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h8M8 9h2" /></svg>
  ),
  // Ganhos de Capital — linha subindo
  ganhosCapital: (
    <svg {...base}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>
  ),
  // Renda Variável — gráfico de barras/atividade
  rendaVariavel: (
    <svg {...base}><path d="M3 3v18h18" /><path d="M7 15l3-4 3 3 4-6" /></svg>
  ),
  // Histórico de Alterações — relógio com seta
  historico: (
    <svg {...base}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></svg>
  ),
};

export default function NavIcon({ id }) {
  return NAV_ICONS[id] || (
    <svg {...base}><circle cx="12" cy="12" r="9" /></svg>
  );
}
