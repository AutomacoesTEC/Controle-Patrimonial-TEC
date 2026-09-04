import { useEffect } from 'react';

function texto(elemento) {
  return elemento?.textContent.replace(/\s+/g, ' ').trim() || '';
}

function legendaDaTabela(tabela) {
  const tituloCard = texto(tabela.closest('.card')?.querySelector('.card-title'));
  const tituloModal = texto(tabela.closest('.modal')?.querySelector('.modal-header h2, .modal-header h3'));
  const cabecalhos = [...tabela.querySelectorAll('thead th')]
    .map(texto).filter(Boolean).slice(0, 4).join(', ');
  const tituloPagina = texto(document.querySelector('.page-header h2'));
  const contexto = tituloCard || tituloModal || tituloPagina;
  if (contexto && cabecalhos) return `${contexto} — ${cabecalhos}`;
  return contexto || (cabecalhos ? `Tabela — ${cabecalhos}` : 'Tabela de dados');
}

function garantirLegenda(tabela) {
  if (tabela.querySelector(':scope > caption')) return;
  const caption = document.createElement('caption');
  caption.className = 'sr-only';
  caption.textContent = legendaDaTabela(tabela);
  tabela.prepend(caption);
}

export function legendarTabelas(raiz) {
  if (raiz instanceof HTMLTableElement) garantirLegenda(raiz);
  raiz.querySelectorAll('table').forEach(garantirLegenda);
}

export default function useLegendasTabelas() {
  useEffect(() => {
    const raiz = document.getElementById('root');
    if (!raiz) return undefined;
    legendarTabelas(raiz);
    const observador = new MutationObserver(mutacoes => {
      mutacoes.forEach(mutacao => {
        const tabelaAlvo = mutacao.target instanceof Element ? mutacao.target.closest('table') : null;
        if (tabelaAlvo) garantirLegenda(tabelaAlvo);
        mutacao.addedNodes.forEach(no => {
          if (no instanceof Element) legendarTabelas(no);
        });
      });
    });
    observador.observe(raiz, { childList: true, subtree: true });
    return () => observador.disconnect();
  }, []);
}
