import { useEffect, useRef, useState } from 'react';

// Marca de ajuda: um "?" (ou "!" para ressalva) discreto que abre um balão com o
// texto. Passou de `title` nativo do navegador para balão próprio porque o
// title demora a aparecer, some sozinho, não estiliza e trunca texto longo — e
// este app usa a marca justamente para tirar da vista ressalvas longas sem
// perdê-las (auditoria de 21/08/2026).
//
// Em 03/09/2026 virou o padrão único para TODO aviso que antes era caixa âmbar
// "à vista" (pedido da usuária: "beeeem discreto, tipo o ?"). Ganhou
// `tom="ressalva"` (marca âmbar "!") e `rotulo` (texto curto e apagado ao lado).
//
// Comportamento (ajuste da usuária em 03/09/2026): abre SÓ no clique da marca,
// NUNCA no hover — passar o mouse por cima da frase não deve disparar nada.
// Fecha no clique de novo, no Esc, no clique fora e na rolagem. O balão é
// position:fixed para não ser cortado por overflow de tabela/card.
export default function Ajuda({ texto, titulo, tom = 'ajuda', rotulo }) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const painelRef = useRef(null);
  const ressalva = tom === 'ressalva';

  const calcularPos = () => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return null;
    const largura = Math.min(340, window.innerWidth - 24);
    let left = b.left + b.width / 2 - largura / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - largura - 12));
    const abaixo = window.innerHeight - b.bottom;
    const acima = b.top;
    const preferBaixo = abaixo >= 180 || abaixo >= acima;
    return {
      left, largura,
      top: preferBaixo ? Math.round(b.bottom + 8) : null,
      bottom: preferBaixo ? null : Math.round(window.innerHeight - b.top + 8),
    };
  };

  const fechar = () => setAberto(false);
  const alternar = () => {
    if (aberto) { fechar(); return; }
    setPos(calcularPos());
    setAberto(true);
  };

  useEffect(() => {
    if (!aberto) return;
    const foraDaMarca = (e) => !painelRef.current?.contains(e.target) && !btnRef.current?.contains(e.target);
    const onDown = (e) => { if (foraDaMarca(e)) fechar(); };
    const onKey = (e) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', fechar);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', fechar);
    };
  }, [aberto]);

  return (
    <span className="ajuda-wrap">
      {rotulo && <span className="ajuda-rotulo">{rotulo}</span>}
      <button
        ref={btnRef}
        type="button"
        className={`ajuda-marca${ressalva ? ' ajuda-marca-ressalva' : ''}`}
        aria-label={titulo ? `${titulo}. ${texto}` : texto}
        aria-expanded={aberto}
        onClick={alternar}
      >
        {ressalva ? '!' : '?'}
      </button>
      {aberto && pos && (
        <div
          ref={painelRef}
          className={`ajuda-painel${ressalva ? ' ajuda-painel-ressalva' : ''}`}
          role="tooltip"
          style={{ position: 'fixed', left: pos.left, top: pos.top ?? undefined, bottom: pos.bottom ?? undefined, width: pos.largura }}
        >
          {titulo && <div className="ajuda-painel-titulo">{titulo}</div>}
          <div className="ajuda-painel-texto">{texto}</div>
        </div>
      )}
    </span>
  );
}
