import { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmacaoModal from '../components/ConfirmacaoModal';
import { formatCpfCnpj, mascaraCpf, iniciaisNome } from '../utils/formatters';
import {
  PERFIS_STORAGE_KEY,
  novoPerfil, adicionarPerfil, removerPerfil, atualizarPerfil, protegerPerfil, dataStorageKeyFor,
} from '../store/perfis';
import { gerarSaltBase64, derivarChave, criptografarObjeto } from '../utils/crypto';
import {
  EXTENSAO_BACKUP, MENSAGENS_BACKUP, TIPO_MIME_BACKUP,
  anosDoBackup, lerArquivoBackup, montarBackupDoArmazenamento, nomeArquivoBackup,
  restaurarBackup, textoDoArquivoBackup,
} from '../store/backupPerfil';
import { baixarTexto } from '../utils/baixarArquivo';
import { parseDBK, parsePDF } from './importParsers';
import { reducerComHistorico, initialState } from '../store/reducer';
import { validarIntegridadeArquivoIrpf } from '../irpf/leitorRegistrosDbk';
import { identificarArquivoFonte, payloadImportacaoCompleto, resumirImportacao } from '../utils/importacaoDeclaracao';
import RevisaoImportacaoModal from '../components/RevisaoImportacaoModal';

// pdfjs-dist é uma biblioteca pesada (é o motivo do bundle de Importar
// Declaração ser o maior do app) — PerfilLauncherPage é a ÚNICA tela que
// carrega fora de lazy(), sempre, pra toda usuária, mesmo quem nunca importa
// nada aqui. import() dinâmico, só dentro do handler de PDF (abaixo), evita
// inflar o carregamento inicial do app inteiro por causa de um botão que
// talvez nunca seja clicado (achado real de performance, auditoria do
// bundle: index.js foi de 246KB pra 683KB só de importar isso no topo do
// arquivo).

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
  </svg>
);
const LockIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" {...props}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const FORM_VAZIO = { nome: '', cpf: '', apelido: '' };
const SENHA_VAZIA = { senha: '', confirmar: '' };

// Data e hora da exportação no fuso de quem está lendo. `formatDate` não
// serve aqui: ela lê o prefixo "aaaa-mm-dd" do texto ISO, que é UTC, e um
// backup gerado às 22h no horário de Brasília apareceria com a data do dia
// seguinte.
function dataHoraDoBackup(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'data desconhecida';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}h${p(d.getMinutes())}`;
}

// Tela de entrada do app: cada perfil é um titular inteiro, com seus
// próprios anos/bens/dívidas/dependentes guardados numa chave de
// localStorage isolada da dos outros perfis (ver perfis.js). Escolher um
// perfil aqui é a única forma de entrar nos dados dele — não existe um
// jeito de "ver os dois ao mesmo tempo" de propósito, pra nunca misturar
// titulares diferentes. Quem decide se pede senha antes de entrar é o
// App.jsx (ver onSelecionarPerfil): aqui só entrega o perfil escolhido.
export default function PerfilLauncherPage({ theme, onToggleTheme, onSelecionarPerfil }) {
  const [perfis, setPerfis] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PERFIS_STORAGE_KEY) || '[]'); } catch { return []; }
  });
  // formOpen só reflete perfis.length === 0 na PRIMEIRA renderização (é só
  // o valor inicial do useState) — excluir o único perfil depois zera
  // `perfis` mas não reabre o formulário sozinho, e sem nenhum perfil na
  // lista e o formulário fechado a tela ficava travada (nem lista nem
  // "Novo Perfil" pra clicar), só saía de lá com F5. Achado real, reportado
  // pela usuária: excluiu o único perfil e ficou sem next step nenhum.
  const [formOpen, setFormOpen] = useState(perfis.length === 0);
  useEffect(() => {
    if (perfis.length === 0) setFormOpen(true);
  }, [perfis.length]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoApelidoId, setEditandoApelidoId] = useState(null);
  const [apelidoEdicao, setApelidoEdicao] = useState('');
  const [protegendoId, setProtegendoId] = useState(null);
  const [senhaForm, setSenhaForm] = useState(SENHA_VAZIA);
  const [senhaErro, setSenhaErro] = useState('');
  // Declaração escolhida em "Importar Declaração" antes de criar o perfil:
  // guarda o resultado inteiro do parser (não só nome/CPF), pra o perfil já
  // nascer com bens/dívidas/rendimentos importados, sem precisar repetir o
  // mesmo arquivo de novo em Importar Declaração assim que entrar. null =
  // ninguém importou nada, segue o fluxo manual de sempre.
  const [declaracaoImportada, setDeclaracaoImportada] = useState(null);
  const [previsualizacao, setPrevisualizacao] = useState(null);
  const [importando, setImportando] = useState(false);
  const [erroImportacao, setErroImportacao] = useState('');
  // Esta tela aparece ANTES de qualquer DataProvider existir (nenhum perfil
  // escolhido ainda, ver App.jsx), então não tem `useData()`/`confirmar()`
  // disponível — replica aqui o mesmo padrão do DataContext.jsx
  // (ConfirmacaoModal + Promise<boolean>) em vez do confirm() nativo.
  const [confirmState, setConfirmState] = useState(null);
  const resolverConfirmRef = useRef(null);
  const confirmar = useCallback((opcoes = {}) => new Promise((resolve) => {
    resolverConfirmRef.current = resolve;
    setConfirmState({ ...opcoes });
  }), []);
  const responderConfirm = useCallback((ok) => {
    setConfirmState(null);
    const r = resolverConfirmRef.current;
    resolverConfirmRef.current = null;
    r?.(ok);
  }, []);
  const fileRef = useRef();
  // Backup e restauração em arquivo (item A2 de
  // MELHORIAS-PROPOSTAS-2026-09-03.md). `avisoBackup` é a única linha de
  // resposta das duas operações (não há toast nesta tela, que vive antes do
  // DataProvider); `restauracao` é o painel que aparece depois de escolher um
  // arquivo válido e antes de gravar qualquer coisa.
  const [avisoBackup, setAvisoBackup] = useState(null); // { tipo: 'sucesso' | 'erro', texto }
  const [exportandoId, setExportandoId] = useState(null);
  const [restauracao, setRestauracao] = useState(null);
  const backupFileRef = useRef();

  const persistir = (novaLista) => {
    setPerfis(novaLista);
    try { localStorage.setItem(PERFIS_STORAGE_KEY, JSON.stringify(novaLista)); } catch {}
  };

  // Lê e interpreta a declaração com os MESMOS parsers da tela Importar
  // Declaração (parseDBK/parsePDF) — nenhuma lógica de leitura nova, só
  // reaproveitada. Preenche Nome/CPF na hora; o resto (bens, dívidas etc.)
  // fica guardado pra entrar junto quando o perfil for criado.
  const handleImportarDeclaracao = async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo depois de um erro
    if (!file) return;

    setImportando(true);
    setErroImportacao('');
    try {
      const ext = file.name.toLowerCase().split('.').pop();
      const arrayBufferFonte = await file.arrayBuffer();
      let result;
      // Os avisos do parser (quais fichas o arquivo NÃO traz) eram jogados
      // fora aqui, com uma função de log vazia — a tela Importar Declaração
      // mostra os mesmos avisos, mas quem cria o perfil já importando, que é
      // o caminho natural de quem está começando, não via nenhum. Achado na
      // auditoria de 21/08/2026.
      const avisos = [];
      const coletar = (msg, nivel) => { if (nivel === 'warning' || nivel === 'error') avisos.push(msg); };
      // Mesmas extensões oficiais tratadas em ImportPage.jsx — ver o
      // comentário lá, com a referência à classe `ConstantesGlobais` do
      // programa da Receita. As duas telas precisam aceitar o mesmo conjunto,
      // senão a pessoa consegue importar um formato ao criar o perfil e não
      // consegue reimportar depois (ou o contrário).
      if (ext === 'dbk' || ext === 'dec' || ext === 'f2b') {
        const text = await file.text();
        validarIntegridadeArquivoIrpf(text, ext);
        result = await parseDBK(text, coletar);
      } else if (ext === 'pdf') {
        const [pdfjsLib, { default: pdfjsWorker }] = await Promise.all([
          import('pdfjs-dist'),
          import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        ]);
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
        // Preserva os bytes originais para o hash. O leitor PDF pode destacar
        // o buffer que recebe ao enviá-lo para o worker.
        const pdf = await pdfjsLib.getDocument({ data: arrayBufferFonte.slice(0) }).promise;
        result = await parsePDF(pdf, coletar, () => {});
      } else {
        setErroImportacao('Formato não suportado. Use o PDF da declaração ou o arquivo .DEC, .DBK ou .F2B gerado pelo programa da Receita.');
        setImportando(false);
        return;
      }
      if (!result?.contribuinte?.nome && !result?.contribuinte?.cpf) {
        setErroImportacao('Não consegui identificar o titular neste arquivo. Preencha manualmente abaixo.');
        setImportando(false);
        return;
      }
      result = await identificarArquivoFonte(result, file, arrayBufferFonte);
      setPrevisualizacao({
        nomeArquivo: file.name,
        result,
        avisos: [...new Set([...avisos, ...(result.avisosImportacao || [])])],
        primeiraRevisao: true,
      });
    } catch (err) {
      setErroImportacao(err?.message || 'Não consegui ler este arquivo. Confira se é uma declaração .DBK/.DEC ou o PDF da declaração, ou preencha manualmente.');
    }
    setImportando(false);
  };

  const limparDeclaracaoImportada = () => {
    setDeclaracaoImportada(null);
    setErroImportacao('');
  };

  const confirmarPrevisualizacao = () => {
    const selecionada = previsualizacao;
    if (!selecionada) return;
    if (selecionada.primeiraRevisao) {
      setDeclaracaoImportada({
        nomeArquivo: selecionada.nomeArquivo,
        result: selecionada.result,
        avisos: selecionada.avisos,
      });
      setForm(p => ({
        ...p,
        nome: selecionada.result.contribuinte?.nome || p.nome,
        cpf: selecionada.result.contribuinte?.cpf || p.cpf,
      }));
    }
    setPrevisualizacao(null);
  };

  const handleCriarPerfil = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    const perfil = novoPerfil(form);
    try {
      let dados;
      if (declaracaoImportada) {
        // Roda o mesmo reducer/ação que "Importar Declaração" usa, só que
        // sobre um estado em branco (perfil recém-criado) — sem duplicar a
        // lógica de import, e sem o risco de dessincronizar dela no futuro.
        // reducerComHistorico, não `reducer`: a tela Histórico de Alterações
        // se apresenta como "registro de tudo que foi cadastrado, editado ou
        // excluído no app", e uma importação de 172 bens feita por aqui não
        // deixava rastro nenhum, enquanto a mesma importação feita pela tela
        // Importar Declaração deixava (a ação IMPORT_DECLARACAO já tem
        // descrição registrada em descreverAcao). Achado na auditoria de
        // 21/08/2026.
        const { toasts, ...estadoImportado } = reducerComHistorico(initialState, { type: 'IMPORT_DECLARACAO', payload: payloadImportacaoCompleto(declaracaoImportada.result) });
        dados = estadoImportado;
      } else {
        // O nome/CPF digitados aqui já são o titular — sem isso, a pessoa
        // acabava de digitar o nome e teria que digitar de novo na tela
        // Titular e Dependentes assim que entrasse no perfil.
        dados = { contribuinte: { nome: perfil.nome, cpf: perfil.cpf } };
      }
      localStorage.setItem(dataStorageKeyFor(perfil.id), JSON.stringify(dados));
      const novaLista = adicionarPerfil(perfis, perfil);
      localStorage.setItem(PERFIS_STORAGE_KEY, JSON.stringify(novaLista));
      setPerfis(novaLista);
      onSelecionarPerfil(perfil);
    } catch (err) {
      setErroImportacao(`Não foi possível salvar o novo perfil neste computador. ${err?.message || 'Verifique o espaço disponível e tente novamente.'}`);
    }
  };

  const handleExcluirPerfil = async (e, perfil) => {
    e.stopPropagation();
    const confirmado = await confirmar({
      titulo: `Excluir o perfil "${perfil.apelido || perfil.nome || 'sem nome'}"?`,
      texto: 'Todos os anos, bens, dívidas, rendimentos e dependentes cadastrados nele são apagados por completo. Essa ação não pode ser desfeita.',
      textoConfirmar: 'Excluir',
      perigo: true,
    });
    if (!confirmado) return;
    try {
      localStorage.removeItem(dataStorageKeyFor(perfil.id));
    } catch {}
    persistir(removerPerfil(perfis, perfil.id));
  };

  // Exporta QUALQUER perfil da lista, aberto ou não, direto do que está
  // gravado no localStorage. Perfil protegido não pede senha aqui: o que sai
  // é o envelope cifrado que já está no disco, cópia exata, e sem a senha ele
  // continua ilegível (ver o cabeçalho de src/store/backupPerfil.js).
  const handleExportarPerfil = async (e, perfil) => {
    e.stopPropagation();
    setAvisoBackup(null);
    setExportandoId(perfil.id);
    try {
      const agora = new Date();
      const arquivo = await montarBackupDoArmazenamento({ storage: localStorage, perfil, agora });
      const nome = nomeArquivoBackup(perfil, agora);
      baixarTexto({ nome, texto: textoDoArquivoBackup(arquivo), tipo: TIPO_MIME_BACKUP });
      setAvisoBackup({
        tipo: 'sucesso',
        texto: `Backup de ${perfil.apelido || perfil.nome || 'perfil'} salvo como ${nome}. Guarde uma cópia fora deste computador.`,
      });
    } catch (err) {
      setAvisoBackup({ tipo: 'erro', texto: err?.message || 'Não foi possível gerar o backup deste perfil.' });
    }
    setExportandoId(null);
  };

  // Só LÊ e confere o arquivo (formato, integridade pelo hash e versão de
  // esquema). Nada é gravado antes de a pessoa escolher o destino e clicar em
  // Restaurar no painel.
  const handleEscolherBackup = async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // permite reescolher o mesmo arquivo depois de um erro
    if (!file) return;
    setAvisoBackup(null);
    try {
      const arquivo = await lerArquivoBackup(await file.text());
      setRestauracao({ nomeArquivo: file.name, arquivo, senha: '', destino: 'novo', erro: '', ocupado: false });
    } catch (err) {
      setRestauracao(null);
      setAvisoBackup({ tipo: 'erro', texto: err?.message || MENSAGENS_BACKUP.arquivo_invalido });
    }
  };

  const handleRestaurarBackup = async () => {
    if (!restauracao || restauracao.ocupado) return;
    const { arquivo, senha, destino } = restauracao;
    if (arquivo.protegido && !senha) {
      setRestauracao(r => ({ ...r, erro: 'Digite a senha que protegia o perfil quando este backup foi exportado.' }));
      return;
    }
    // O padrão é sempre criar um perfil NOVO. Substituir um perfil que já
    // existe apaga os dados dele, então passa pelo modal próprio de
    // confirmação (nunca pelo confirm() nativo, ver src/semConfirmNativo.test.js).
    const alvo = destino === 'novo' ? null : perfis.find(p => p.id === destino);
    if (destino !== 'novo') {
      if (!alvo) {
        setRestauracao(r => ({ ...r, erro: MENSAGENS_BACKUP.perfil_inexistente }));
        return;
      }
      const confirmado = await confirmar({
        titulo: `Substituir os dados do perfil "${alvo.apelido || alvo.nome || 'sem nome'}"?`,
        texto: 'Todos os anos, bens, dívidas, rendimentos e dependentes que estão nele hoje são apagados e trocados pelos do arquivo. Essa ação não pode ser desfeita.',
        textoConfirmar: 'Substituir',
        perigo: true,
      });
      if (!confirmado) return;
    }
    setRestauracao(r => ({ ...r, ocupado: true, erro: '' }));
    try {
      const { perfil, lista } = await restaurarBackup({
        storage: localStorage,
        arquivo,
        senha,
        substituirPerfilId: alvo ? alvo.id : null,
      });
      // restaurarBackup já gravou a lista; aqui só espelha na tela.
      setPerfis(lista);
      setRestauracao(null);
      const nome = perfil.apelido || perfil.nome || 'sem nome';
      setAvisoBackup({
        tipo: 'sucesso',
        texto: alvo
          ? `Perfil "${nome}" substituído pelo conteúdo do backup. Escolha o perfil na lista para abrir.`
          : `Perfil "${nome}" restaurado do backup. Escolha o perfil na lista para abrir.`,
      });
    } catch (err) {
      setRestauracao(r => ({ ...r, ocupado: false, erro: err?.message || 'Não foi possível restaurar este backup.' }));
    }
  };

  const iniciarEdicaoApelido = (e, perfil) => {
    e.stopPropagation();
    setEditandoApelidoId(perfil.id);
    setApelidoEdicao(perfil.apelido || '');
  };
  const salvarApelido = (e, perfilId) => {
    e.stopPropagation();
    persistir(atualizarPerfil(perfis, perfilId, { apelido: apelidoEdicao.trim() }));
    setEditandoApelidoId(null);
  };

  const iniciarProtecao = (e, perfil) => {
    e.stopPropagation();
    setProtegendoId(perfil.id);
    setSenhaForm(SENHA_VAZIA);
    setSenhaErro('');
  };

  // Cripografa o que já está salvo (texto puro, já que o perfil ainda não
  // era protegido) com uma chave nova derivada da senha — dali em diante,
  // sem a senha, o conteúdo desse perfil é ilegível de verdade (ver
  // src/utils/crypto.js). A senha em si nunca é gravada, só o salt.
  const confirmarProtecao = async (e, perfil) => {
    e.stopPropagation();
    if (senhaForm.senha.length < 6) { setSenhaErro('A senha precisa ter pelo menos 6 caracteres.'); return; }
    if (senhaForm.senha !== senhaForm.confirmar) { setSenhaErro('As senhas não coincidem.'); return; }
    try {
      const salt = gerarSaltBase64();
      const chave = await derivarChave(senhaForm.senha, salt);
      const atualRaw = localStorage.getItem(dataStorageKeyFor(perfil.id));
      const atual = atualRaw ? JSON.parse(atualRaw) : {};
      const envelope = await criptografarObjeto(chave, atual);
      localStorage.setItem(dataStorageKeyFor(perfil.id), JSON.stringify(envelope));
      persistir(protegerPerfil(perfis, perfil.id, salt));
      setProtegendoId(null);
    } catch {
      setSenhaErro('Não foi possível ativar a proteção. Tente novamente.');
    }
  };

  return (
    <div className="app-layout">
      <div className="launcher-ambient" />
      <button
        className="theme-toggle-fixed"
        title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        onClick={onToggleTheme}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
      <main className="main-content" style={{ alignItems: 'center', justifyContent: 'center', overflowY: 'auto', position: 'relative' }}>
        <div style={{ width: '100%', maxWidth: '560px', padding: '40px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div className="launcher-logo">CP</div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '20px 0 0', letterSpacing: '-0.02em' }}>
              Controle Patrimonial <span className="perfil-apelido-badge" style={{ fontSize: '13px', padding: '3px 10px', verticalAlign: 'middle' }}>TEC</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0', fontSize: '14px' }}>Selecione um perfil para continuar, ou cadastre um novo titular</p>
          </div>

          {perfis.length > 0 && (
            <div style={{ display: 'grid', gap: '12px', marginBottom: formOpen ? '24px' : '0' }}>
              {perfis.map(p => (
                <div key={p.id} className="perfil-card" onClick={() => onSelecionarPerfil(p)}>
                  <div className="perfil-avatar">{iniciaisNome(p.nome)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700 }}>{p.nome || 'Sem nome'}</span>
                      {p.apelido && <span className="perfil-apelido-badge">{p.apelido}</span>}
                      {p.protegido && <span title="Protegido por senha" style={{ color: 'var(--text-muted)', display: 'inline-flex' }}><LockIcon /></span>}
                    </div>
                    {/* Perfil protegido não guarda o CPF completo fora do
                        envelope cifrado (ver protegerPerfil em perfis.js,
                        achado 21): o card mostra só os três últimos dígitos,
                        que bastam para desempatar homônimos. */}
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                      {p.cpf
                        ? formatCpfCnpj(p.cpf)
                        : p.cpfFinal
                          ? `CPF •••.•••.${p.cpfFinal}-••`
                          : 'CPF não informado'}
                    </div>
                    {editandoApelidoId === p.id ? (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }} onClick={e => e.stopPropagation()}>
                        <input className="form-control" style={{ padding: '4px 8px', fontSize: '12px' }} value={apelidoEdicao} onChange={e => setApelidoEdicao(e.target.value)} placeholder="Apelido (opcional)" autoFocus />
                        <button className="btn btn-sm btn-primary" onClick={e => salvarApelido(e, p.id)}>Salvar</button>
                      </div>
                    ) : protegendoId === p.id ? (
                      <div style={{ marginTop: '10px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input type="password" className="form-control" style={{ padding: '4px 8px', fontSize: '12px' }} value={senhaForm.senha} onChange={e => setSenhaForm(s => ({ ...s, senha: e.target.value }))} placeholder="Senha (mín. 6 caracteres)" autoFocus />
                          <input type="password" className="form-control" style={{ padding: '4px 8px', fontSize: '12px' }} value={senhaForm.confirmar} onChange={e => setSenhaForm(s => ({ ...s, confirmar: e.target.value }))} placeholder="Confirmar senha" />
                          <button className="btn btn-sm btn-primary" onClick={e => confirmarProtecao(e, p)}>Ativar</button>
                        </div>
                        {senhaErro && <p style={{ color: 'var(--accent-danger)', fontSize: '11px', marginTop: '4px' }}>{senhaErro}</p>}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '14px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <button className="perfil-link-btn" onClick={e => iniciarEdicaoApelido(e, p)}>
                          {p.apelido ? 'Editar apelido' : '+ Apelido'}
                        </button>
                        {!p.protegido && (
                          <button className="perfil-link-btn" onClick={e => iniciarProtecao(e, p)}>Proteger com senha</button>
                        )}
                        <button
                          className="perfil-link-btn"
                          disabled={exportandoId === p.id}
                          title={`Salva um arquivo ${EXTENSAO_BACKUP} com tudo o que está neste perfil`}
                          onClick={e => handleExportarPerfil(e, p)}
                        >
                          {exportandoId === p.id ? 'Gerando backup...' : 'Exportar backup'}
                        </button>
                      </div>
                    )}
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={e => handleExcluirPerfil(e, p)}>Excluir</button>
                </div>
              ))}
              {!formOpen && (
                <button className="perfil-add-card" onClick={() => { setForm(FORM_VAZIO); limparDeclaracaoImportada(); setFormOpen(true); }}>
                  ＋ Novo Perfil
                </button>
              )}
            </div>
          )}

          {/* Backup e restauração em arquivo (item A2). Fica fora do bloco da
              lista de propósito: numa instalação nova, sem perfil nenhum,
              restaurar um backup é justamente o que a pessoa precisa fazer. */}
          <input
            ref={backupFileRef}
            type="file"
            accept={`${EXTENSAO_BACKUP},.json`}
            style={{ display: 'none' }}
            onChange={handleEscolherBackup}
          />
          {avisoBackup && (
            <p style={{
              fontSize: '12px',
              margin: '0 0 12px',
              color: avisoBackup.tipo === 'erro' ? 'var(--accent-danger)' : 'var(--text-secondary)',
            }}>
              {avisoBackup.texto}
            </p>
          )}
          {!restauracao && (
            <div style={{ marginBottom: '16px' }}>
              <button className="perfil-link-btn" onClick={() => backupFileRef.current?.click()}>
                Restaurar perfil de um arquivo ({EXTENSAO_BACKUP})
              </button>
            </div>
          )}
          {restauracao && (
            <div className="card" style={{ marginBottom: '16px' }}>
              <div className="card-header"><h3 className="card-title">Restaurar perfil</h3></div>
              <div style={{ padding: '0 16px', fontSize: '13px' }}>
                <p style={{ margin: '0 0 10px', color: 'var(--text-secondary)' }}>
                  Arquivo <strong>{restauracao.nomeArquivo}</strong>, exportado em {dataHoraDoBackup(restauracao.arquivo.exportadoEm)} pelo CP-TEC {restauracao.arquivo.versaoApp || 'de versão não informada'}.
                </p>
                <p style={{ margin: '0 0 10px' }}>
                  Titular: <strong>{restauracao.arquivo.perfil?.nome || 'sem nome'}</strong>
                  {restauracao.arquivo.perfil?.apelido ? <span className="perfil-apelido-badge" style={{ marginLeft: '8px' }}>{restauracao.arquivo.perfil.apelido}</span> : null}
                </p>
                {restauracao.arquivo.protegido ? (
                  <div className="form-group">
                    <label>Senha do perfil</label>
                    <input
                      type="password"
                      className="form-control"
                      value={restauracao.senha}
                      autoFocus
                      onChange={e => setRestauracao(r => ({ ...r, senha: e.target.value, erro: '' }))}
                    />
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '6px 0 0' }}>
                      Este backup está cifrado. Sem a senha usada na exportação, o conteúdo não pode ser lido nem restaurado.
                    </p>
                  </div>
                ) : (
                  <p style={{ margin: '0 0 10px', color: 'var(--text-secondary)' }}>
                    {anosDoBackup(restauracao.arquivo).length > 0
                      ? `Anos no arquivo: ${anosDoBackup(restauracao.arquivo).join(', ')}.`
                      : 'O arquivo não traz nenhum ano-calendário com dados.'}
                  </p>
                )}
                <div className="form-group">
                  <label>Destino</label>
                  <select
                    className="form-control"
                    value={restauracao.destino}
                    onChange={e => setRestauracao(r => ({ ...r, destino: e.target.value, erro: '' }))}
                  >
                    <option value="novo">Criar um perfil novo</option>
                    {perfis.map(p => (
                      <option key={p.id} value={p.id}>Substituir o perfil {p.apelido || p.nome || 'sem nome'}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '6px 0 0' }}>
                    Criar um perfil novo não mexe em nada do que já está no app. Substituir apaga o conteúdo do perfil escolhido.
                  </p>
                </div>
                {restauracao.erro && (
                  <p style={{ color: 'var(--accent-danger)', fontSize: '12px', margin: '0 0 10px' }}>{restauracao.erro}</p>
                )}
              </div>
              <div style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRestauracao(null)}>Cancelar</button>
                <button type="button" className="btn btn-primary" disabled={restauracao.ocupado} onClick={handleRestaurarBackup}>
                  {restauracao.ocupado ? 'Restaurando...' : 'Restaurar'}
                </button>
              </div>
            </div>
          )}

          {formOpen && (
            <div className="card">
              <div className="card-header"><h3 className="card-title">Novo Perfil</h3></div>
              <form onSubmit={handleCriarPerfil}>
                <div style={{ padding: '0 16px' }}>
                  <input ref={fileRef} type="file" accept=".pdf,.dbk,.dec,.f2b" style={{ display: 'none' }} onChange={handleImportarDeclaracao} />
                  {declaracaoImportada ? (
                    <div className="form-group" style={{ padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* O texto antigo prometia "bens, dívidas e demais dados",
                            o que é falso para um PDF: dos rendimentos, ele não lê
                            os recebidos de pessoa física e do exterior. Agora nomeia
                            o que entra, por formato. */}
                        <span style={{ flex: 1 }}>
                          Preenchido a partir de <strong>{declaracaoImportada.nomeArquivo}</strong>.
                          {' O resumo abaixo mostra somente o que foi estruturado e a situação de auditoria de cada ficha.'}
                        </span>
                        <button type="button" className="perfil-link-btn" onClick={limparDeclaracaoImportada}>✕ Limpar</button>
                      </div>
                      {/* Sem aviso fixo de carnê-leão aqui: ele aparecia em TODA
                          importação por PDF, mesmo quando a ficha vem "Sem
                          Informações" (as declarações reais), virando alarme falso.
                          Quando o PDF de fato traz carnê-leão, ou qualquer outra
                          ficha não lida COM conteúdo, o item nomeado aparece na
                          lista `avisos` abaixo. */}
                      {(declaracaoImportada.avisos || []).length > 0 && (
                        <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {declaracaoImportada.avisos.map((aviso, i) => <li key={i}>{aviso}</li>)}
                        </ul>
                      )}
                      {(() => {
                        const resumo = resumirImportacao(declaracaoImportada.result);
                        return (
                          <div className="import-review-state-summary" style={{ marginTop: '10px', marginBottom: 0 }}>
                            {resumo.porEstado.completa ? <span className="badge badge-green">{resumo.porEstado.completa} completas</span> : null}
                            {resumo.porEstado.parcial ? <span className="badge badge-orange">{resumo.porEstado.parcial} em auditoria</span> : null}
                            {resumo.porEstado.vazia ? <span className="badge badge-blue">{resumo.porEstado.vazia} vazias</span> : null}
                            {resumo.porEstado.ausente ? <span className="badge badge-blue">{resumo.porEstado.ausente} não impressas</span> : null}
                            {resumo.porEstado.nao_suportada ? <span className="badge badge-orange">{resumo.porEstado.nao_suportada} não estruturadas</span> : null}
                            {resumo.porEstado.erro ? <span className="badge badge-red">{resumo.porEstado.erro} com erro</span> : null}
                            <button
                              type="button"
                              className="perfil-link-btn"
                              onClick={() => setPrevisualizacao({ ...declaracaoImportada, primeiraRevisao: false })}
                            >Rever detalhes</button>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="form-group">
                      <button type="button" className="btn btn-secondary btn-sm" disabled={importando} onClick={() => fileRef.current?.click()}>
                        {importando ? 'Lendo declaração...' : 'Importar Declaração (PDF, .DEC ou .DBK)'}
                      </button>
                      {erroImportacao && <p style={{ color: 'var(--accent-danger)', fontSize: '12px', marginTop: '6px', marginBottom: 0 }}>{erroImportacao}</p>}
                    </div>
                  )}
                  <div className="form-group"><label>Nome do Titular</label><input className="form-control" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} autoFocus /></div>
                  <div className="form-row">
                    <div className="form-group"><label>CPF</label><input className="form-control" inputMode="numeric" value={mascaraCpf(form.cpf)} onChange={e => setForm(p => ({ ...p, cpf: mascaraCpf(e.target.value) }))} placeholder="Opcional, 000.000.000-00" /></div>
                    <div className="form-group"><label>Apelido</label><input className="form-control" value={form.apelido} onChange={e => setForm(p => ({ ...p, apelido: e.target.value }))} placeholder="Ex: Cliente A" /></div>
                  </div>
                </div>
                <div style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  {perfis.length > 0 && <button type="button" className="btn btn-secondary" onClick={() => { setFormOpen(false); limparDeclaracaoImportada(); }}>Cancelar</button>}
                  <button type="submit" className="btn btn-primary" disabled={!form.nome.trim()}>Criar e Entrar</button>
                </div>
              </form>
            </div>
          )}

          {perfis.length === 0 && !formOpen && (
            <div className="card"><div className="empty-state" style={{ padding: '40px 20px' }}>
              <p style={{ fontSize: '16px', fontWeight: 600 }}>Nenhum perfil cadastrado ainda</p>
              <p>Cada perfil é um titular (com seus dependentes, bens, dívidas etc.), isolado dos demais.</p>
            </div></div>
          )}
        </div>
      </main>
      {previsualizacao && (
        <RevisaoImportacaoModal
          open
          resultado={previsualizacao.result}
          nomeArquivo={previsualizacao.nomeArquivo}
          confirmLabel={previsualizacao.primeiraRevisao ? 'Usar esta declaração' : 'Fechar revisão'}
          onConfirm={confirmarPrevisualizacao}
          onCancel={() => setPrevisualizacao(null)}
        />
      )}
      <ConfirmacaoModal
        open={!!confirmState}
        {...confirmState}
        onConfirmar={() => responderConfirm(true)}
        onCancelar={() => responderConfirm(false)}
      />
    </div>
  );
}
