# Rodada 41 — Estados vazios com próxima ação

## Falha e previsão

Num perfil novo, a trajetória `Bens e Direitos` termina numa tabela vazia com
uma frase embutida na célula. Embora exista um botão no cabeçalho, o próprio
estado não oferece uma próxima ação clara nem um padrão reutilizável pelas
onze telas de dados.

Previsão: a tabela continua vazia e com a mesma estrutura, mas passa a conter
um `.estado-vazio` com título, contexto e um único botão principal; acioná-lo
abre `Novo Bem`. O mesmo componente será reutilizado nas onze telas.

Fixture `verificar-estado-vazio.py`, perfil novo sem dados, viewport 1366 ×
768, sem seeds, modelo Codex baseado em GPT-5 (identificador exato não
exposto), commit-base `6ea81f9`; saídas `antes.txt`/`depois.txt`. Camada causal
única: apresentação e próxima ação de coleções vazias.

## Decisão

**MANTER.** A tabela preservou sua única linha vazia estrutural, mas passou de
zero a um estado padronizado, com título, contexto e uma ação. Acionar
`Cadastrar primeiro bem` abriu o fluxo de cadastro. A leitura intermediária
antes da renderização do modal foi preservada. Evidência bruta em
`antes.txt`/`depois.txt`.

Verificações: 11 telas importam o componente; build de produção com 661
módulos; regressão com 41 arquivos e 885 testes aprovados.
