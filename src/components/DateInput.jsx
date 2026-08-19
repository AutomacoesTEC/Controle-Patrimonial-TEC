import { useState, useEffect } from 'react';

function isoParaTexto(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function textoParaIso(texto) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!m) return null;
  const [, d, mo, y] = m;
  const dia = Number(d), mes = Number(mo);
  if (mes < 1 || mes > 12) return null;
  const diasNoMes = new Date(Number(y), mes, 0).getDate();
  if (dia < 1 || dia > diasNoMes) return null;
  return `${y}-${mo}-${d}`;
}

function formatarMascara(raw) {
  const digitos = raw.replace(/\D/g, '').slice(0, 8);
  let out = digitos.slice(0, 2);
  if (digitos.length > 2) out += '/' + digitos.slice(2, 4);
  if (digitos.length > 4) out += '/' + digitos.slice(4, 8);
  return out;
}

// Campo de data com máscara dd/mm/aaaa digitável de ponta a ponta, sem os
// segmentos do <input type="date"> nativo — frágil pra sobrescrever um valor
// já preenchido, porque o clique nem sempre cai no segmento certo (dia, mês
// ou ano), e um valor fora de posição passava direto sem aviso. Confirma
// assim que a data digitada fica completa e válida (não precisa de Enter),
// mas Enter também confirma. Ao perder o foco com algo incompleto ou
// inválido, volta pro último valor válido em vez de deixar o campo quebrado.
export default function DateInput({ value, onChange, min, max }) {
  const [texto, setTexto] = useState(() => isoParaTexto(value));
  const [invalido, setInvalido] = useState(false);

  // O campo é o dono da máscara enquanto a pessoa digita; só resincroniza
  // com o valor de fora quando ele muda por outro caminho (ex.: botão
  // "Todo o histórico").
  useEffect(() => {
    setTexto(isoParaTexto(value));
    setInvalido(false);
  }, [value]);

  const tentarConfirmar = (t) => {
    if (t.length === 0) {
      setInvalido(false);
      onChange('');
      return true;
    }
    if (t.length < 10) return false;
    const iso = textoParaIso(t);
    if (!iso || (min && iso < min) || (max && iso > max)) {
      setInvalido(true);
      return false;
    }
    setInvalido(false);
    onChange(iso);
    return true;
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/aaaa"
      className={`form-control${invalido ? ' form-control-invalid' : ''}`}
      value={texto}
      onChange={e => {
        const novo = formatarMascara(e.target.value);
        setTexto(novo);
        if (novo.length < 10) setInvalido(false);
        tentarConfirmar(novo);
      }}
      onKeyDown={e => { if (e.key === 'Enter') tentarConfirmar(texto); }}
      onBlur={() => {
        if (!tentarConfirmar(texto)) {
          setTexto(isoParaTexto(value));
          setInvalido(false);
        }
      }}
    />
  );
}
