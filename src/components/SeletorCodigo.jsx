import { useState, useRef, useId } from 'react';
import { normalizarBusca } from '../utils/formatters';

// Combobox de código de ficha da declaração: a lista OFICIAL da Receita (a
// mesma que o programa do IRPF usa, extraída em tabelas-irpf2026/) num dropdown
// filtrável, MAS o campo continua aceitando digitação livre — um código que
// ainda não esteja na tabela entra do mesmo jeito. Pedido da usuária em
// 03/09/2026: "ter a possibilidade de selecionar os códigos assim como o app do
// IRPF, com a opção de digitar também".
//
// `opcoes`: [{ codigo, nome }]. `value`/`onChange` guardam só o CÓDIGO (string).
// Filtra por prefixo do código OU por trecho do nome, sem acento e sem caixa.
// O texto digitado que não seja um código é usado só como filtro: ao sair do
// campo sem escolher nada, o valor anterior é mantido (não vira lixo).
const norm = normalizarBusca;
const pareceCodigo = t => /^[0-9]{1,3}$/.test(String(t).trim());

export default function SeletorCodigo({ opcoes = [], value, onChange, placeholder = 'Código', id }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState(null); // null = exibindo o value; string = filtro em digitação
  const [marcado, setMarcado] = useState(0);
  const autoId = useId();
  const listId = id || autoId;

  const termo = busca == null ? '' : norm(busca.trim());
  const filtradas = termo
    ? opcoes.filter(o => norm(o.codigo).startsWith(termo) || norm(o.nome).includes(termo))
    : opcoes;

  const selecionada = opcoes.find(o => String(o.codigo) === String(value ?? ''));
  const textoCampo = busca != null
    ? busca
    : (selecionada ? `${selecionada.codigo} - ${selecionada.nome}` : String(value ?? ''));

  const escolher = (codigo) => {
    onChange(String(codigo));
    setBusca(null);
    setAberto(false);
  };

  const confirmarDigitado = () => {
    if (busca == null) return;
    const t = busca.trim();
    if (t === '' || pareceCodigo(t) || opcoes.some(o => String(o.codigo) === t)) onChange(t);
    // texto que não é código: descarta, mantém o value anterior
    setBusca(null);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAberto(true); setMarcado(m => Math.min(m + 1, filtradas.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setMarcado(m => Math.max(m - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (aberto && filtradas[marcado]) escolher(filtradas[marcado].codigo);
      else { confirmarDigitado(); setAberto(false); }
    } else if (e.key === 'Escape') { setAberto(false); setBusca(null); }
  };

  return (
    <div className="seletor-codigo">
      <input
        className="form-control"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listId}
        autoComplete="off"
        placeholder={placeholder}
        value={textoCampo}
        onFocus={() => setAberto(true)}
        onChange={e => { setBusca(e.target.value); setAberto(true); setMarcado(0); }}
        onKeyDown={onKeyDown}
        onBlur={() => { setTimeout(() => { confirmarDigitado(); setAberto(false); }, 150); }}
      />
      {aberto && filtradas.length > 0 && (
        <ul className="seletor-codigo-lista" id={listId} role="listbox">
          {filtradas.map((o, i) => (
            <li
              key={o.codigo}
              role="option"
              aria-selected={String(o.codigo) === String(value ?? '')}
              className={`${i === marcado ? 'marcado' : ''} ${String(o.codigo) === String(value ?? '') ? 'atual' : ''}`}
              onMouseEnter={() => setMarcado(i)}
              onMouseDown={e => { e.preventDefault(); escolher(o.codigo); }}
            >
              <strong>{o.codigo}</strong> <span>{o.nome}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
