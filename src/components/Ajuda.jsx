import { useEffect, useRef, useState } from 'react';

// Marca de ajuda: um "?" (ou "!" para ressalva) discreto que abre um balão
// com o texto. Passou de `title` nativo do navegador para balão próprio
// porque o title demora a aparecer, some sozinho, não estiliza e trunca texto
// longo — e este app usa a marca justamente para tirar da vista ressalvas
// longas sem perdê-las (auditoria de 21/08/2026: ressalvas empilhadas ficavam
// maiores que a própria tabela de valores).
//
// Em 03/09/2026 virou o padrão único para TODO aviso que antes era caixa
// âmbar "à vista" (pedido da usuária: "beeeem discreto, tipo o ?"). Por isso
// ganhou `tom="ressalva"` (marca âmbar "!") e `rotulo` (um texto curto e
// apagado ao lado da marca, para a ressalva virar uma linha discreta inteira,
// não só um ícone solto).
//
// Comportamento: abre no hover (espiada) e fixa no clique (para ler/rolar
// texto longo, e para funcionar no toque). Fecha no Esc, clique fora, ou
// rolagem. O balão é position:fixed para não ser cortado por overflow de
// tabelas/cards.
export default function Ajuda({ texto, titulo, tom = 'ajuda', rotulo }) {
  const [aberto, setAberto] = useState(false);
  const [fixado, setFixado] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const painelRef = useRef(null);
  const fecharTimer = useRef(null);
  const ressalva = tom === 'ressalva';

  const calcularPos = () => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const largura = Math.min(340, window.innerWidth - 24);
    let left = b.left + b.width / 2 - largura / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - largura - 12));
    const abaixo = window.innerHeight - b.bottom;
    const acima = b.top;
    const preferBaixo = abaixo >= 180 || abaixo >= acima;
    setPos({
      left, largura,
      top: preferBaixo ? Math.round(b.bottom + 8) : null,
      bottom: preferBaixo ? null : Math.round(window.innerHeight - b.top + 8),
    });
  };

  const abrir = () => { clearTimeout(fecharTimer.current); calcularPos(); setAberto(true); };
  const fecharJa = () => { clearTimeout(fecharTimer.current); setAberto(false); setFixado(false); };
  const agendarFechar = () => {
    if (fixado) return;
    clearTimeout(fecharTimer.current);
    fecharTimer.current = setTimeout(() => setAberto(false), 140);
  };
  const alternarFixado = () => {
    if (aberto && fixado) { fecharJa(); return; }
    setFixado(true);
    abrir();
  };

  useEffect(() => {
    if (!aberto) return;
    const foraDaMarca = (e) => !painelRef.current?.contains(e.target) && !btnRef.current?.contains(e.target);
    const onDown = (e) => { if (foraDaMarca(e)) fecharJa(); };
    const onKey = (e) => { if (e.key === 'Escape') fecharJa(); };
    const onScroll = () => fecharJa();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', fecharJa);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', fecharJa);
    };
  }, [aberto]);

  useEffect(() => () => clearTimeout(fecharTimer.current), []);

  return (
    <span className="ajuda-wrap" onMouseEnter={abrir} onMouseLeave={agendarFechar}>
      {rotulo && <span className="ajuda-rotulo">{rotulo}</span>}
      <button
        ref={btnRef}
        type="button"
        className={`ajuda-marca${ressalva ? ' ajuda-marca-ressalva' : ''}`}
        aria-label={titulo ? `${titulo}. ${texto}` : texto}
        aria-expanded={aberto}
        onClick={alternarFixado}
        onFocus={abrir}
        onBlur={agendarFechar}
      >
        {ressalva ? '!' : '?'}
      </button>
      {aberto && pos && (
        <div
          ref={painelRef}
          className={`ajuda-painel${ressalva ? ' ajuda-painel-ressalva' : ''}`}
          role="tooltip"
          style={{ position: 'fixed', left: pos.left, top: pos.top ?? undefined, bottom: pos.bottom ?? undefined, width: pos.largura }}
          onMouseEnter={abrir}
          onMouseLeave={agendarFechar}
        >
          {titulo && <div className="ajuda-painel-titulo">{titulo}</div>}
          <div className="ajuda-painel-texto">{texto}</div>
        </div>
      )}
    </span>
  );
}
