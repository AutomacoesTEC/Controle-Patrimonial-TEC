import { useEffect, useId, useRef, useState } from 'react';
import { useMarcarModalSujo } from './Modal';

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

const pad2 = (n) => String(n).padStart(2, '0');
const isoDeYMD = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Grade de dias do mês (com padding do mês anterior/seguinte pra fechar
// semanas completas, domingo a sábado) — só cálculo, sem estado.
function gradeDoMes(ano, mes) {
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d);
  while (celulas.length % 7 !== 0) celulas.push(null);
  return celulas;
}

// Calendário clicável, popup próprio (sem depender de <input type="date">
// nativo — decisão já tomada antes: o nativo tem segmentos frágeis, um
// clique num ponto errado sobrescrevia o valor sem aviso). Continua com a
// digitação livre dd/mm/aaaa de sempre; o calendário é só um jeito a mais
// de escolher a data, não substitui o texto.
function CalendarioPopup({ valorIso, min, max, onEscolher, onFechar, id }) {
  const base = valorIso ? new Date(`${valorIso}T00:00:00`) : new Date();
  const [anoView, setAnoView] = useState(base.getFullYear());
  const [mesView, setMesView] = useState(base.getMonth() + 1); // 1-12
  const ref = useRef(null);

  useEffect(() => {
    const aoClicarFora = (e) => { if (ref.current && !ref.current.contains(e.target)) onFechar(); };
    const aoTeclar = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onFechar(); }
    };
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar, true);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar, true);
    };
  }, [onFechar]);

  const mudarMes = (delta) => {
    let m = mesView + delta, a = anoView;
    if (m < 1) { m = 12; a -= 1; }
    if (m > 12) { m = 1; a += 1; }
    setMesView(m); setAnoView(a);
  };

  const hoje = isoDeYMD(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());

  return (
    <div ref={ref} id={id} className="date-picker-popup" role="dialog" aria-label="Escolher data" onClick={e => e.stopPropagation()}>
      <div className="date-picker-header">
        <button type="button" className="date-picker-nav" onClick={() => mudarMes(-1)} title="Mês anterior" aria-label="Mês anterior">‹</button>
        <span>{MESES[mesView - 1]} {anoView}</span>
        <button type="button" className="date-picker-nav" onClick={() => mudarMes(1)} title="Próximo mês" aria-label="Próximo mês">›</button>
      </div>
      <div className="date-picker-grid date-picker-weekdays">
        {DIAS_SEMANA.map((d, i) => <span key={i} aria-hidden="true">{d}</span>)}
      </div>
      <div className="date-picker-grid">
        {gradeDoMes(anoView, mesView).map((dia, i) => {
          if (dia == null) return <span key={i} />;
          const iso = isoDeYMD(anoView, mesView, dia);
          const desabilitado = (min && iso < min) || (max && iso > max);
          const selecionado = iso === valorIso;
          const ehHoje = iso === hoje;
          return (
            <button
              key={i} type="button" disabled={desabilitado}
              className={`date-picker-day${selecionado ? ' selected' : ''}${ehHoje && !selecionado ? ' today' : ''}`}
              aria-label={`${dia} de ${MESES[mesView - 1]} de ${anoView}`}
              aria-pressed={selecionado}
              aria-current={ehHoje ? 'date' : undefined}
              onClick={() => onEscolher(iso)}
            >
              {dia}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Campo de data com máscara dd/mm/aaaa digitável de ponta a ponta, sem os
// segmentos do <input type="date"> nativo — frágil pra sobrescrever um valor
// já preenchido, porque o clique nem sempre cai no segmento certo (dia, mês
// ou ano), e um valor fora de posição passava direto sem aviso. Confirma
// assim que a data digitada fica completa e válida (não precisa de Enter),
// mas Enter também confirma. Ao perder o foco com algo incompleto ou
// inválido, mantém a digitação visível e informa como corrigir, em vez de
// apagar silenciosamente a tentativa da pessoa.
// O ícone de calendário abre um seletor visual (CalendarioPopup) como
// segunda forma de preencher, sem tirar a digitação livre.
export default function DateInput({ value, onChange, min, max, ariaLabel, id }) {
  const [texto, setTexto] = useState(() => isoParaTexto(value));
  const [invalido, setInvalido] = useState(false);
  const [mensagemErro, setMensagemErro] = useState('');
  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const marcarModalSujo = useMarcarModalSujo();
  const autoId = useId();
  const inputId = id || `data-${autoId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const erroId = `${inputId}-erro`;
  const calendarioId = `${inputId}-calendario`;

  // O campo é o dono da máscara enquanto a pessoa digita; só resincroniza
  // com o valor de fora quando ele muda por outro caminho (ex.: botão
  // "Todo o histórico").
  useEffect(() => {
    setTexto(isoParaTexto(value));
    setInvalido(false);
    setMensagemErro('');
  }, [value]);

  const mensagemPara = (t) => {
    if (t.length < 10) return 'Digite a data completa no formato dd/mm/aaaa.';
    if (min && textoParaIso(t) && textoParaIso(t) < min) return 'A data está antes do período permitido.';
    if (max && textoParaIso(t) && textoParaIso(t) > max) return 'A data está depois do período permitido.';
    return 'Digite uma data válida no formato dd/mm/aaaa.';
  };

  const confirmarComFeedback = (t) => {
    const ok = tentarConfirmar(t);
    if (!ok) {
      setInvalido(true);
      setMensagemErro(mensagemPara(t));
    }
    return ok;
  };

  const tentarConfirmar = (t) => {
    if (t.length === 0) {
      setInvalido(false);
      setMensagemErro('');
      onChange('');
      return true;
    }
    if (t.length < 10) return false;
    const iso = textoParaIso(t);
    if (!iso || (min && iso < min) || (max && iso > max)) {
      setInvalido(true);
      setMensagemErro(mensagemPara(t));
      return false;
    }
    setInvalido(false);
    setMensagemErro('');
    onChange(iso);
    return true;
  };

  return (
    <div className="date-input">
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        placeholder="dd/mm/aaaa"
        className={`form-control${invalido ? ' form-control-invalid' : ''}`}
        value={texto}
        aria-invalid={invalido || undefined}
        aria-describedby={invalido ? erroId : undefined}
        onChange={e => {
          const novo = formatarMascara(e.target.value);
          setTexto(novo);
          if (novo.length < 10) setInvalido(false);
          tentarConfirmar(novo);
        }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmarComFeedback(texto); } }}
        onBlur={() => {
          if (!tentarConfirmar(texto)) {
            setInvalido(true);
            setMensagemErro(mensagemPara(texto));
          }
        }}
      />
      <button
        type="button" className="date-input-icon" title="Escolher no calendário" aria-label="Escolher no calendário" aria-expanded={calendarioAberto} aria-controls={calendarioId}
        onClick={() => setCalendarioAberto(a => !a)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>
      {calendarioAberto && (
        <CalendarioPopup
          valorIso={value || null}
          min={min}
          max={max}
          id={calendarioId}
          onEscolher={(iso) => {
            onChange(iso);
            setTexto(isoParaTexto(iso));
            setInvalido(false);
            setMensagemErro('');
            setCalendarioAberto(false);
            // Escolher pelo calendário não passa pelo <input> de verdade,
            // então não dispara onChange nativo nenhum — sem isso, o Modal
            // (que detecta "tem algo digitado" ouvindo onChange de
            // qualquer campo, pra avisar antes de fechar com Esc) não
            // percebia essa mudança feita só pelo calendário. Simular o
            // evento com dispatchEvent NÃO funciona aqui: o React rastreia
            // o valor do <input> controlado por dentro e engole o evento
            // simulado quando o setter nativo não foi usado de verdade
            // (achado real, testando dentro de um modal — Esc fechava
            // direto, sem avisar). useMarcarModalSujo() avisa o Modal
            // direto, sem depender de simular DOM.
            marcarModalSujo();
          }}
          onFechar={() => setCalendarioAberto(false)}
        />
      )}
      {invalido && <p id={erroId} className="date-input-error" role="alert">{mensagemErro}</p>}
    </div>
  );
}
