import { useState, useEffect } from 'react';

// Reconstrói o texto formatado a partir de TODOS os dígitos já presentes no
// campo (não só o caractere novo) — mesma técnica de "empilhar da direita"
// que qualquer app bancário usa: digitar 1, 5, 0 vira 0,01 → 0,15 → 1,50.
function digitosParaTexto(bruto) {
  const digitos = bruto.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (digitos === '') return '';
  const centavos = digitos.slice(-2).padStart(2, '0');
  const inteiroDigitos = digitos.slice(0, -2) || '0';
  const inteiroFormatado = Number(inteiroDigitos).toLocaleString('pt-BR');
  return `${inteiroFormatado},${centavos}`;
}

function textoParaNumero(texto) {
  if (!texto) return '';
  const limpo = texto.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(limpo);
  return Number.isNaN(n) ? '' : n;
}

function numeroParaTexto(numero) {
  if (numero === '' || numero == null || Number.isNaN(Number(numero))) return '';
  return Number(numero).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Campo de valor em reais com máscara: digita só números, o separador de
// milhar e a vírgula decimal aparecem sozinhos. O <input type="number">
// nativo mostrava o valor cru ("1500"), com cara de contador de estoque,
// não de dinheiro ("R$ 1.500,00").
export default function MoneyInput({ value, onChange, placeholder = '0,00', disabled }) {
  const [texto, setTexto] = useState(() => numeroParaTexto(value));

  useEffect(() => {
    setTexto(numeroParaTexto(value));
  }, [value]);

  return (
    <div className="money-input">
      <span className="money-input-prefix">R$</span>
      <input
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        disabled={disabled}
        className="form-control"
        value={texto}
        onChange={e => {
          const novoTexto = digitosParaTexto(e.target.value);
          setTexto(novoTexto);
          onChange(textoParaNumero(novoTexto));
        }}
        onFocus={e => e.target.select()}
      />
    </div>
  );
}
