import { useEffect } from 'react';

const SELETOR_CAMPO = 'input, select, textarea';

function textoLimpo(elemento) {
  if (!elemento) return '';
  const copia = elemento.cloneNode(true);
  copia.querySelectorAll('button, [aria-hidden="true"]').forEach(item => item.remove());
  return copia.textContent.replace(/\s+/g, ' ').trim();
}

function nomeDoCampo(campo) {
  const rotulo = campo.closest('.form-group')?.querySelector('label');
  const nomeVisual = textoLimpo(rotulo);
  if (nomeVisual) return nomeVisual;
  if (campo.closest('.year-selector')) return 'Ano-calendário';
  if (campo.placeholder) return campo.placeholder;
  if (campo.title) return campo.title;
  if (campo.name) return campo.name.replace(/[_-]+/g, ' ');
  if (campo.type === 'file') return 'Arquivo para importação';
  if (campo.tagName === 'SELECT') return 'Selecionar opção';
  if (campo.tagName === 'TEXTAREA') return 'Texto';
  return 'Campo';
}

export function nomearCamposSemRotulo(raiz) {
  const campos = [];
  if (raiz instanceof Element && raiz.matches(SELETOR_CAMPO)) campos.push(raiz);
  campos.push(...raiz.querySelectorAll(SELETOR_CAMPO));
  campos.forEach(campo => {
    if ((campo.labels?.length || 0) > 0) return;
    if (campo.hasAttribute('aria-label') || campo.hasAttribute('aria-labelledby')) return;
    campo.setAttribute('aria-label', nomeDoCampo(campo));
  });
}

export default function useRotulosAcessiveis() {
  useEffect(() => {
    const raiz = document.getElementById('root');
    if (!raiz) return undefined;
    nomearCamposSemRotulo(raiz);
    const observador = new MutationObserver(mutacoes => {
      mutacoes.forEach(mutacao => {
        mutacao.addedNodes.forEach(no => {
          if (no instanceof Element) nomearCamposSemRotulo(no);
        });
      });
    });
    observador.observe(raiz, { childList: true, subtree: true });
    return () => observador.disconnect();
  }, []);
}
