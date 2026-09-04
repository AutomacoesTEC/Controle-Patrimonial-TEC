# Rodada 09 — adulteração determinística no teste de backup

## 1. Falha nomeada

O teste `corrupção no ciphertext é pega pelo hash` substitui o primeiro
caractere Base64 por `A`. Quando o ciphertext aleatório já começa com `A`, a
operação não altera o arquivo, `lerArquivoBackup` resolve corretamente e o
teste falha de modo espúrio. A trajetória ocorreu na primeira suíte da rodada
08: 871/872 testes passaram; o valor recebido começava com `A` e a asserção
esperava rejeição. A repetição integral passou.

## 2. Previsão escrita antes da mudança

- A transformação do teste mudará o ciphertext em 64/64 prefixos possíveis do
  alfabeto Base64, contra 63/64 antes.
- O teste-alvo passará em 20/20 repetições consecutivas.
- Nenhum arquivo de produção mudará.

## 3. Tarefa congelada

- Fixture: os 64 caracteres do alfabeto Base64 como primeiro caractere de
  `ciphertext`, sufixo fixo `resto-do-ciphertext`
- Seeds: cada um dos 64 prefixos, na ordem
  `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/`
- Teste-alvo: `corrupção no ciphertext é pega pelo hash, antes mesmo de pedir a senha`
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `75638da76550eb84196ecf4a8d11dd732734c401`
- Medidor: `medir-mutacao.mjs`; saídas: `antes.json` e `depois.json`

O medidor lê e executa somente a expressão à direita da atribuição real em
`backupPerfil.test.js`; assim, fixture e medidor ficam idênticos antes/depois.

## 4. Camada causal

Somente verificação: a maneira como o teste adultera seu ciphertext. Código de
produção, criptografia e validação do backup ficam fora desta rodada.

## 5. Decisão

**MANTER.** No mesmo conjunto de 64 prefixos, a transformação passou de
63/64 para 64/64 alterações reais; nenhum prefixo ficou inalterado. O teste
real passou em 20/20 processos consecutivos, e a suíte integral aprovou os
37 arquivos e 872 testes.

Evidência bruta: `antes.json`, `depois.json`, `falha-observada-antes.txt` e
`repeticoes-depois.txt`. A única linha funcional alterada pertence ao teste;
nenhum arquivo de produção mudou.

Verificações de regressão:

- `npm test`: 37 arquivos e 872 testes aprovados.
- `npm run build`: aprovado.
