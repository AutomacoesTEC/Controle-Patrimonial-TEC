import { useId, useLayoutEffect, useRef, useState } from 'react';

// Envolve uma tabela (<div className="table-container"><table>...) e deixa
// arrastar a divisória de cada coluna, no cabeçalho, para mudar a largura.
// Duplo clique na divisória volta aquela coluna ao padrão.
//
// NÃO persiste nada: cada vez que a tela monta, as colunas voltam à largura
// natural. Pedido da usuária em 03/09/2026 — "arrastar sim, mas sempre abrir
// como padrão".
//
// Como não mexe no DOM que o React controla (o <table> vem inteiro como
// children): a largura das colunas é aplicada por uma folha de estilo
// isolada por classe única + table-layout:fixed, e as alças ficam numa
// camada sticky sobre o cabeçalho. Assim uma nova renderização da tabela
// (ordenar, filtrar) não apaga o ajuste, e a camada acompanha o thead
// sticky na rolagem sem nenhum cálculo de scroll.

const MIN_COL = 56;

export default function TabelaRedimensionavel({
  children,
  className = '',
  style,
  stickyFirstColumn = false,
  stickyRightColumns = 0,
  initialColumnWidths = {},
  persistKey,
  constLayoutKey,
}) {
  const wrapRef = useRef(null);
  const rawId = useId();
  const cls = 'rdz' + rawId.replace(/[^a-zA-Z0-9]/g, '');

  // larguras[i] = largura atual da coluna i (px). null = ainda não medido:
  // a tabela renderiza no layout automático de sempre até a primeira medição.
  const [larguras, setLarguras] = useState(null);
  const [alturaCab, setAlturaCab] = useState(0);
  const [temAcoes, setTemAcoes] = useState(false);
  const iniciaisRef = useRef(null);
  const dragRef = useRef(null);

  useLayoutEffect(() => () => document.body.classList.remove('rdz-arrastando'), []);

  useLayoutEffect(() => {
    const cont = wrapRef.current;
    const table = cont?.querySelector(':scope > table');
    const headRow = table?.tHead?.rows?.[0] || table?.tBodies?.[0]?.rows?.[0];
    if (!cont || !table || !headRow || headRow.cells.length < 2) return;

    const acao = headRow.cells[headRow.cells.length - 1].textContent.trim().toLowerCase() === 'ações';
    setTemAcoes(acao);
    let medidas = Array.from(headRow.cells).map(th => th.getBoundingClientRect().width);
    if (acao) medidas[medidas.length - 1] = Math.max(176, medidas.at(-1));
    // Se a tabela não chega a encher o container, distribui a sobra nas
    // colunas antes de congelar, pra não ficar um vão à direita.
    const soma = medidas.reduce((a, b) => a + b, 0);
    const disponivel = cont.clientWidth;
    if (soma > 0 && soma < disponivel - 1) {
      const fator = disponivel / soma;
      medidas = medidas.map(w => w * fator);
    }
    medidas = medidas.map(w => Math.round(w));
    medidas = medidas.map((w, i) => (
      initialColumnWidths[i] == null
        ? w
        : Math.max(MIN_COL, Math.round(initialColumnWidths[i]))
    ));

    iniciaisRef.current = medidas;
    setLarguras(medidas);
    setAlturaCab(Math.round(headRow.getBoundingClientRect().height));
  }, [persistKey, constLayoutKey]);

  const iniciarArraste = (i) => (e) => {
    dragRef.current = { i, x0: e.clientX, w0: larguras[i] };
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.classList.add('rdz-arrastando');
    e.preventDefault();
  };
  const moverArraste = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const w = Math.max(MIN_COL, Math.round(d.w0 + (e.clientX - d.x0)));
    setLarguras(prev => { const n = prev.slice(); n[d.i] = w; return n; });
  };
  const soltarArraste = (e) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* já solto */ }
    document.body.classList.remove('rdz-arrastando');
  };
  const restaurarColuna = (i) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    setLarguras(prev => { const n = prev.slice(); n[i] = iniciaisRef.current[i]; return n; });
  };

  const fixasDireita = stickyRightColumns || (temAcoes ? 1 : 0);
  let css = null;
  let divisorias = [];
  let divisoriasFixas = [];
  if (larguras) {
    const total = larguras.reduce((a, b) => a + b, 0);
    const regras = [`.${cls}>table{table-layout:fixed;width:${total}px}`];
    larguras.forEach((w, i) => {
      regras.push(
        `.${cls}>table>thead>tr>th:nth-child(${i + 1}),` +
        `.${cls}>table>tbody>tr:first-child>td:nth-child(${i + 1}):not([colspan])` +
        `{width:${w}px;min-width:${w}px;max-width:${w}px}`
      );
    });
    const inicioFixasDireita = Math.max(0, larguras.length - fixasDireita);
    let deslocamentoDireita = 0;
    for (let i = larguras.length - 1; i >= inicioFixasDireita; i -= 1) {
      regras.push(
        `.${cls}>table>thead>tr>th:nth-child(${i + 1})` +
        `{position:sticky;right:${deslocamentoDireita}px;z-index:4;background:var(--bg-secondary)}`,
        `.${cls}>table>tbody>tr>td:nth-child(${i + 1}):not([colspan])` +
        `{position:sticky;right:${deslocamentoDireita}px;z-index:1;background:inherit}`,
        `.${cls}>table>tbody>tr:hover>td:nth-child(${i + 1}):not([colspan])` +
        `{background:var(--bg-card-hover)}`
      );
      deslocamentoDireita += larguras[i];
    }
    if (stickyFirstColumn) {
      regras.push(
        `.${cls}>table>thead>tr>th:first-child` +
        `{position:sticky;left:0;z-index:5;background:var(--bg-secondary)}`,
        `.${cls}>table>tbody>tr>td:first-child:not([colspan])` +
        `{position:sticky;left:0;z-index:2;background:inherit}`,
        `.${cls}>table>tbody>tr:hover>td:first-child:not([colspan])` +
        `{background:var(--bg-card-hover)}`
      );
    }
    css = regras.join('\n');
    let acc = 0;
    divisorias = larguras.slice(0, -1).map((w, i) => { acc += w; return { i, left: acc }; });
    if (fixasDireita > 0) {
      divisoriasFixas = divisorias
        .filter(({ i }) => i >= inicioFixasDireita - 1)
        .map(({ i }) => ({
          i,
          right: larguras.slice(i + 1).reduce((soma, w) => soma + w, 0),
        }));
      divisorias = divisorias.filter(({ i }) => i < inicioFixasDireita - 1);
    }
  }

  return (
    <>
    <div ref={wrapRef} className={`table-container ${cls} ${stickyFirstColumn || fixasDireita ? 'rdz-colunas-fixas' : ''} ${className}`.trim()} style={style}>
      {css && <style media="screen">{css}</style>}
      {larguras && alturaCab > 0 && (
        <>
          <div className="rdz-camada" aria-hidden="true" style={{ height: 0, width: `${larguras.reduce((a, b) => a + b, 0)}px` }}>
            {divisorias.map(({ i, left }) => (
              <div
                key={i}
                className="rdz-puxador"
                style={{ left: `${left}px`, height: `${alturaCab}px` }}
                title="Arraste para ajustar a largura. Duplo clique volta ao padrão."
                onPointerDown={iniciarArraste(i)}
                onPointerMove={moverArraste}
                onPointerUp={soltarArraste}
                onPointerCancel={soltarArraste}
                onDoubleClick={restaurarColuna(i)}
              />
            ))}
          </div>
          {divisoriasFixas.length > 0 && (
            <div className="rdz-camada rdz-camada-fixa" aria-hidden="true" style={{ height: 0 }}>
              {divisoriasFixas.map(({ i, right }) => (
                <div
                  key={i}
                  className="rdz-puxador rdz-puxador-fixo"
                  style={{ right: `${right}px`, height: `${alturaCab}px` }}
                  title="Arraste para ajustar a largura. Duplo clique volta ao padrão."
                  onPointerDown={iniciarArraste(i)}
                  onPointerMove={moverArraste}
                  onPointerUp={soltarArraste}
                  onPointerCancel={soltarArraste}
                  onDoubleClick={restaurarColuna(i)}
                />
              ))}
            </div>
          )}
        </>
      )}
      {children}
    </div>
    </>
  );
}
