import { useState, useId } from 'react';
import { filtrarOpcoesBem } from '../utils/formatters';

// Combobox de escolha de bem já cadastrado, para a aba Ganhos de Capital
// (item F, HANDOFF-2026-09-03.md). Reusa a casca do SeletorCodigo.jsx
// (dropdown filtrável, navegação por teclado, fecha ao perder o foco), mas
// com semântica diferente o bastante para não caber como uma prop do
// mesmo componente: aqui NÃO existe digitação livre (um id de bem não é
// algo que se digita à mão para "criar" — criar é um fluxo próprio, o botão
// "Novo bem"), `value` é o id do bem (não um código de ficha da Receita) e
// cada opção mostra DUAS linhas (nome curto + grupo/código/discriminação
// completa) em vez de uma, para desambiguar bens parecidos.
//
// `opcoes`: [{ id, rotulo, detalhe, baixado }] — ver opcoesSeletorBem() em
// utils/formatters.js. `value`/`onChange` guardam só o id do bem escolhido.
export default function SeletorBem({ opcoes = [], value, onChange, placeholder = 'Selecione um bem cadastrado', id }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState(null); // null = exibindo o rótulo do selecionado; string = filtro em digitação
  const [marcado, setMarcado] = useState(0);
  const autoId = useId();
  const listId = id || autoId;

  const filtradas = busca == null ? opcoes : filtrarOpcoesBem(opcoes, busca);
  const selecionada = opcoes.find(o => String(o.id) === String(value ?? ''));
  const textoCampo = busca != null ? busca : (selecionada ? selecionada.rotulo : '');

  const escolher = (bemId) => {
    onChange(bemId);
    setBusca(null);
    setAberto(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAberto(true); setMarcado(m => Math.min(m + 1, filtradas.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setMarcado(m => Math.max(m - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (aberto && filtradas[marcado]) escolher(filtradas[marcado].id);
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
        onFocus={() => { setAberto(true); setBusca(''); }}
        onChange={e => { setBusca(e.target.value); setAberto(true); setMarcado(0); }}
        onKeyDown={onKeyDown}
        // Sem confirmarDigitado (diferente do SeletorCodigo): texto digitado
        // é sempre só filtro; ao perder o foco sem escolher, volta a mostrar
        // o valor anterior — nunca aceita um valor que não esteja na lista.
        onBlur={() => { setTimeout(() => { setBusca(null); setAberto(false); }, 150); }}
      />
      {aberto && filtradas.length > 0 && (
        <ul className="seletor-codigo-lista" id={listId} role="listbox">
          {filtradas.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={String(o.id) === String(value ?? '')}
              className={`${i === marcado ? 'marcado' : ''} ${String(o.id) === String(value ?? '') ? 'atual' : ''}`}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}
              onMouseEnter={() => setMarcado(i)}
              onMouseDown={e => { e.preventDefault(); escolher(o.id); }}
            >
              <strong>{o.rotulo}</strong>
              <span style={{ fontSize: '11px' }}>{o.detalhe}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
