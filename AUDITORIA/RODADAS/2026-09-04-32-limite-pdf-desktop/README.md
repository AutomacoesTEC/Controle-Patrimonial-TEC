# Rodada 32 — Limite correto para PDF no desktop

## Falha e previsão

O backlog ainda manda usar `webContents.printToPDF` e chama a integração
Electron de pendente, embora o executável seja pywebview e a suíte proíba
Electron. Seguir esse texto recolocaria uma arquitetura removida.

Previsão: marcadores contraditórios de Electron dentro de B4 cairão de pelo
menos 2 para 0; B4 passará a concluído; runtime pywebview, ausência de
dependência Electron e teste de proibição permanecerão verdadeiros.

Fixture `verificar-limite.py`, sem seeds, modelo Codex baseado em GPT-5
(identificador exato não exposto), commit-base `9757fb8`, saídas brutas
`antes.txt`/`depois.txt`.

Camada causal única: limites e registro do backlog. Nenhum código de produto,
empacotamento ou dependência muda.

Fontes oficiais consultadas em 04/09/2026: a API pública do pywebview não
expõe impressão/PDF; PrintToPdf é API do CoreWebView2 nativo, fora da
abstração atual:

- https://pywebview.idepy.com/en/guide/api
- https://learn.microsoft.com/en-us/microsoft-edge/webview2/how-to/print

## Decisão

**MANTER.** Marcadores contraditórios em B4 caíram de 3 para 0 e o item passou
a concluído. Runtime pywebview, zero dependências incompatíveis e o teste que
impede a troca de arquitetura permaneceram verdadeiros. Evidência bruta em
`antes.txt` e `depois.txt`; a medição intermediária foi preservada.

Verificação adicional: `empacotamento.test.js`, 9/9 testes aprovados.
