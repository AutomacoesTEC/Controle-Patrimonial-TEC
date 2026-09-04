function Conteudo({ titulo, contexto, acao, onAcao }) {
  return (
    <div className="estado-vazio">
      <h3>{titulo}</h3>
      <p>{contexto}</p>
      {acao && onAcao && <button type="button" className="btn btn-primary" onClick={onAcao}>{acao}</button>}
    </div>
  );
}

export default function EstadoVazio({ titulo, contexto, acao, onAcao, colSpan }) {
  if (colSpan) {
    return <tr><td colSpan={colSpan}><Conteudo titulo={titulo} contexto={contexto} acao={acao} onAcao={onAcao} /></td></tr>;
  }
  return <Conteudo titulo={titulo} contexto={contexto} acao={acao} onAcao={onAcao} />;
}
