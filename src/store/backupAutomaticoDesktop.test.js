import { describe, expect, it, vi } from 'vitest';
import { initialState } from './reducer';
import { PERFIS_STORAGE_KEY } from './perfis';
import {
  agendarBackupAutomaticoDesktop,
  INTERVALO_BACKUP_AUTOMATICO_MS,
  salvarBackupAutomaticoDesktop,
} from './backupAutomaticoDesktop';

describe('backup automático no pywebview', () => {
  it('envia ao bridge um backup íntegro do perfil aberto', async () => {
    const perfil = { id: 'p1', nome: 'Maria', cpf: '12345678901', protegido: false };
    const storage = { getItem: vi.fn(chave => chave === PERFIS_STORAGE_KEY ? JSON.stringify([perfil]) : null) };
    const api = { salvar_backup_automatico: vi.fn(async nome => ({ salvo: true, nome })) };

    const resultado = await salvarBackupAutomaticoDesktop({
      api,
      storage,
      perfilId: 'p1',
      estado: { ...initialState, anoCalendario: 2025, toasts: [{ id: 1 }] },
      agora: new Date('2026-09-04T12:00:00.000Z'),
    });

    expect(resultado.salvo).toBe(true);
    expect(api.salvar_backup_automatico).toHaveBeenCalledOnce();
    const [nome, texto] = api.salvar_backup_automatico.mock.calls[0];
    expect(nome).toMatch(/2026-09-04.*\.cptec\.json$/);
    const envelope = JSON.parse(texto);
    expect(envelope.formato).toBe('cptec-backup');
    expect(envelope.conteudo.toasts).toBeUndefined();
    expect(envelope.conteudo.anoCalendario).toBe(2025);
  });

  it('executa ao abrir e agenda nova execução a cada 15 minutos', () => {
    const api = { salvar_backup_automatico: vi.fn() };
    const executar = vi.fn();
    const cancelar = vi.fn();
    let tarefaAgendada;
    const agendar = vi.fn((tarefa) => { tarefaAgendada = tarefa; return 42; });

    const parar = agendarBackupAutomaticoDesktop({ api, executar, agendar, cancelar });
    expect(executar).toHaveBeenCalledTimes(1);
    expect(agendar).toHaveBeenCalledWith(expect.any(Function), INTERVALO_BACKUP_AUTOMATICO_MS);
    tarefaAgendada();
    expect(executar).toHaveBeenCalledTimes(2);
    parar();
    expect(cancelar).toHaveBeenCalledWith(42);
  });
});
