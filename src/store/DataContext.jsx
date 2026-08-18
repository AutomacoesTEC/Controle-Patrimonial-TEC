import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { reducer, initialState } from './reducer';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, () => {
    try {
      const saved = localStorage.getItem('controle-patrimonial-data');
      if (saved) return { ...initialState, ...JSON.parse(saved) };
    } catch {}
    return initialState;
  });

  const saveToStorage = useCallback(() => {
    try {
      const { toasts, ...data } = state;
      localStorage.setItem('controle-patrimonial-data', JSON.stringify(data));
    } catch {}
  }, [state]);

  // Autosave: evita perder dados de quem esquecer de clicar em "Salvar Dados".
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveToStorage();
  }, [state, saveToStorage]);

  const addToast = useCallback((message, type = 'info') => {
    // O id tem que ser o MESMO usado depois no REMOVE_TOAST — o reducer não
    // pode gerar um id novo aqui, senão o aviso nunca é removido (bug real:
    // o toast ficava preso na tela para sempre).
    const id = Date.now() + Math.random();
    dispatch({ type: 'ADD_TOAST', payload: { id, message, type } });
    setTimeout(() => dispatch({ type: 'REMOVE_TOAST', payload: id }), 4000);
  }, []);

  return (
    <DataContext.Provider value={{ state, dispatch, saveToStorage, addToast }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}