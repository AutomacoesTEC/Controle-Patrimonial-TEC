// Marca de ajuda: um "?" discreto que abre o texto no title do navegador.
//
// Estava definido dentro de MovimentacaoBemForm e passou a ser compartilhado
// quando o Dashboard precisou do mesmo recurso. O motivo de existir é sempre o
// mesmo: a ressalva é importante, mas ocupar quatro linhas de um painel com
// ela afoga os números que a pessoa foi ali ver. Na auditoria de 21/08/2026
// duas ressalvas longas empilhadas no card de Rendimentos ficaram maiores que
// a própria tabela de valores.
export default function Ajuda({ texto }) {
  return (
    <span
      title={texto}
      aria-label={texto}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '15px', height: '15px', borderRadius: '50%', marginLeft: '6px',
        border: '1px solid var(--text-muted)', color: 'var(--text-muted)',
        fontSize: '10px', fontWeight: 700, cursor: 'help',
        textTransform: 'none', letterSpacing: 'normal', verticalAlign: 'middle',
      }}
    >
      ?
    </span>
  );
}
