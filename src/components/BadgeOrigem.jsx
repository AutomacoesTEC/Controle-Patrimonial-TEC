import { rotuloOrigemRegistro } from '../utils/origemRegistro';

export default function BadgeOrigem({ item }) {
  const manual = item?.origem === 'manual';
  return (
    <span className={`badge badge-origem ${manual ? 'badge-blue' : 'badge-green'}`}>
      {rotuloOrigemRegistro(item)}
    </span>
  );
}
