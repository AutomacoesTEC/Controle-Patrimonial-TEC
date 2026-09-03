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

export default function TabelaRedimensionavel({ children, className = '', style }) {
  const wrapRef = useRef(null);
  const rawId = useId();
  const cls = 'rdz' + rawId.replace(/[^a-zA-Z0-9]/g, '');

  // larguras[i] = largura atual da coluna i (px). null = ainda não medido:
  // a tabela renderiza no layout automático de sempre até a primeira medição.
  const [larguras, setLarguras] = useState(null);
  const [alturaCab, setAlturaCab] = useState(0);
  const iniciaisRef = useRef(null);
  const dragRef = useRef(null);

  useLayoutEffect(() => {
    const cont = wrapRef.current;
    const table = cont?.querySelector(':scope > table');
    const headRow = table?.tHead?.rows?.[0];
    if (!cont || !table || !headRow || headRow.cells.length < 2) return;

    let medidas = Array.from(headRow.cells).map(th => th.getBoundingClientRect().width);
    // Se a tabela não chega a encher o container, distribui a sobra nas
    // colunas antes de congelar, pra não ficar um vão à direita.
    const soma = medidas.reduce((a, b) => a + b, 0);
    const disponivel = cont.clientWidth;
    if (soma > 0 && soma < disponivel - 1) {
      const fator = disponivel / soma;
      medidas = medidas.map(w => w * fator);
    }
    medidas = medidas.map(w => Math.round(w));

    iniciaisRef.current = medidas;
    setLarguras(medidas);
    setAlturaCab(Math.round(headRow.getBoundingClientRect().height));
  }, []);

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

  let css = null;
  let divisorias = [];
  if (larguras) {
    const total = larguras.reduce((a, b) => a + b, 0);
    const regras = [`.${cls}>table{table-layout:fixed;width:${total}px}`];
    larguras.forEach((w, i) => {
      regras.push(
        `.${cls}>table>thead>tr>th:nth-child(${i + 1}),` +
        `.${cls}>table>tbody>tr>td:nth-child(${i + 1})` +
        `{width:${w}px;min-width:${w}px;max-width:${w}px}`
      );
    });
    css = regras.join('\n');
    let acc = 0;
    divisorias = larguras.slice(0, -1).map((w, i) => { acc += w; return { i, left: acc }; });
  }

  return (
    <div ref={wrapRef} className={`table-container ${cls} ${className}`.trim()} style={style}>
      {css && <style>{css}</style>}
      {larguras && alturaCab > 0 && (
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
      )}
      {children}
    </div>
  );
}
