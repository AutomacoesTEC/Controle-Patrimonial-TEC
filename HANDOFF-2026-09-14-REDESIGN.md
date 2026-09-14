# Handoff, redesign visual do CP-TEC, 14/09/2026

Sessão interrompida a pedido da usuária, para continuar depois. Nada ficou pela
metade: tudo o que foi feito está commitado e os testes passam.

## Onde o trabalho está

- **Worktree:** `~/.claude-worktrees/controle-patrimonial-fonte-1564771472/a2c763fd`
- **Branch:** `AutomacoesTEC/redesign-visual-a2c763fd`
- **Base:** `0a82a9a` (ponta de `fix/auditoria-fase2-2026-09-09`). Não saiu de
  `master`, que é de 24/08 e não tem o Acompanhamento financeiro nem a Fase 2.
- **Sem PR:** o repositório não tem remote. Para integrar, ou se cria um remote,
  ou se faz o merge local na branch de trabalho.

Commits desta sessão, do mais antigo para o mais novo:

| Commit | O que entrou |
|---|---|
| `4f95d6a` | PRODUCT.md, DESIGN.md regerado do código, sidecar `.impeccable/design.json`, configuração do modo live e o relatório de desvios |
| `f684644` | Tela de entrada em duas colunas, com bloco de marca tipográfico |
| `b6c0290` | Ícone novo (opção C) e repaginação da coluna de entrada |
| `3b80b5d` | Três faixas em cada coluna, para a tela parar de sobrar |

## O que já está pronto

1. **PRODUCT.md**: registro de produto, com a usuária consultora, o ciclo
   plurianual e os compromissos de marca.
2. **DESIGN.md**: regerado do código pelo modo scan da impeccable, com nome
   conceito "A Sala de Conferência", os dois temas no mesmo nível, sombra só
   como resposta a estado e as cores antes fora da paleta agora oficiais.
3. **`.impeccable/design.json`**: sidecar que o painel do modo live renderiza,
   com rampas tonais calculadas em OKLCH e 10 componentes em HTML e CSS.
4. **`AUDITORIA/DESVIOS-SISTEMA-VISUAL-2026-09-14.md`**: 14 grupos de desvio
   entre o sistema descrito e o código, com evidência em arquivo e linha. É a
   lista de trabalho do redesign.
5. **Ícone**: barras de posição por ano sobre a dupla linha de fechamento, em
   `assets/cp-tec.ico` (7 tamanhos), `assets/cp-tec.png`, `public/cp-tec.png` e
   `public/favicon.svg`. Gerado por script determinístico, guardado em
   `/tmp/.../scratchpad/gerar_icone_final.py` (fora do repositório).
6. **Tela de entrada** (seleção de perfil e desbloqueio): duas colunas, com o
   trabalho à esquerda e o bloco navy só tipográfico à direita, em três faixas.

## O que vem a seguir

A ordem combinada com a usuária, uma tela por vez, com aprovação entre elas:

1. **Demonstrativo** (a mais problemática; diagnóstico já feito, ver abaixo)
2. Importar declaração
3. Bens e Direitos
4. Acompanhamento financeiro
5. Cadastros de tabela: Dívidas, Rendimentos, Pagamentos, Doações
6. Atividade rural, Ganhos de capital, Renda variável
7. Relatório e Histórico
8. Titular e Modalidade

### Diagnóstico do Demonstrativo, por ordem de impacto

1. O elemento mais forte da tela é o botão verde de exportar
   (`src/pages/Dashboard.jsx:358`, classe `btn-success`). Rouba a atenção do
   número e queima o verde que significa ganho.
2. Tudo é card e nenhum card é mais importante que o outro: 28 no Dashboard,
   todos com o mesmo raio, borda e padding.
3. Caixa dentro de caixa: card, bloco interno com borda e raio, e a tabela.
4. A fileira de três indicadores é um template (`ResumoDemonstrativo.jsx:15-19`),
   com espaço vazio em dois dos três cartões.
5. A tela abre com filtro, não com resposta: o resultado fica a mais de 1.800px
   de rolagem.
6. Verde e vermelho perderam sentido de tanto aparecer, inclusive em totais
   neutros.
7. Dezesseis bolinhas de ajuda numa tela só.
8. Rótulos de seção em maiúsculas, idioma de painel genérico.
9. O menu lateral perdeu os ícones.
10. Abaixo de 1.000px o app quebra: nenhum breakpoint recolhe a barra lateral.

### Direção visual aprovada na etapa 4

Peça contábil, não painel: uma âncora por tela; menos molduras; hierarquia por
tipo e não por cor; ação sem cor de status; mais linha por tela; ajuda contida;
menu com ícones; janela estreita que para de quebrar; tela e papel como a mesma
peça; navy como único acento.

## Como retomar o ambiente

```bash
cd ~/.claude-worktrees/controle-patrimonial-fonte-1564771472/a2c763fd
npx vite --config vite.live.config.mjs      # servidor em 127.0.0.1:5191
.claude/skills/impeccable/scripts/impeccable live        # liga o modo live
.claude/skills/impeccable/scripts/impeccable live-poll   # escuta do painel
```

Detalhes que economizam tempo:

- `vite.live.config.mjs` existe só nesta worktree e não é versionado. Sem ele o
  Vite responde 403 na fonte Inter, porque `node_modules` é um link para o
  checkout principal, fora da raiz servida. A interface cai para a fonte do
  sistema e qualquer medição de layout fica falsa.
- O modo live injeta um `<script>` no `index.html`. Ele sai sozinho no
  `impeccable live-server stop`. Nunca commitar essa linha.
- O perfil de teste vive só no localStorage do navegador do MCP, em
  `127.0.0.1:5191`. Para reproduzir com dados: importar
  `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`, confirmar a revisão,
  confirmar o aviso de outro titular e pular a classificação.
- As capturas ficam em `.playwright-mcp/` (ignorada pelo git) e foram copiadas
  para a Área de Trabalho da usuária, na pasta `CP-TEC design`.

## Estado da verificação

`npm test`: 1.014 testes passando, 0 falhas, 113 pulados (os que exigem
declarações reais, que moram fora do repositório). `npm run build` sem erro.
Console do navegador limpo. Nenhuma mudança de cálculo, de importação ou de
texto coberto por contrato de teste.

## Pendências conhecidas

- O `.exe` ainda não foi recompilado, então o ícone novo só aparece no app
  depois de rodar o PyInstaller do lado Windows.
- O MCP do Figma pediu reautorização e ficou fora do ar. As três capturas do
  antes e a proposta ainda não foram levadas para lá.
- A cópia Windows do código (`/mnt/c/Users/tectr_u0xxepj/controle-patrimonial/`)
  continua na versão anterior. Sincronizar só quando o redesign fechar.
