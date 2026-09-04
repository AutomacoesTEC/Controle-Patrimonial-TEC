import { rotuloOrigemRegistro } from '../utils/origemRegistro';

export default function BadgeOrigem({ item }) {
  const manual = item?.origem === 'manual';
  const original = item?.valorDeclarado?.discriminacao || item?.valorDeclarado?.nome_fonte || item?.valorDeclarado?.nome_beneficiario || '';
  return (
    <>
      <span className={`badge badge-origem ${manual ? 'badge-blue' : 'badge-green'}`}>
        {rotuloOrigemRegistro(item)}
      </span>
      {item?.valorDeclarado && <span className="badge badge-orange badge-editado" title={original ? `Original: ${original}` : 'Valor original preservado'}>Editado</span>}
    </>
  );
}
