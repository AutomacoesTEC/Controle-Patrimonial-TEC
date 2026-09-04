# Rodada 22 — conferência de continuidade entre anos

## 1. Falha nomeada

O rollover copia saldos, mas dois anos importados independentemente nunca são
comparados. Um bem pode fechar 2025 em R$ 100 e abrir 2026 em R$ 90, outro pode
sumir com saldo e uma dívida pode aparecer trazendo saldo anterior; o
Dashboard não informa nenhuma das três quebras.

Trajetória: executar `continuidade.test.js` com dois estados de dois anos, um
coerente e outro com essas três divergências plantadas.

## 2. Previsão escrita antes da mudança

- O fixture coerente retornará zero divergências.
- O fixture adversarial retornará exatamente três, uma de cada tipo.
- Diferenças de até R$ 0,01 serão tratadas como fechamento ao centavo.
- Havendo os dois anos, o Dashboard mostrará card com contagem e lista
  expansível; sem o par, não inventará conferência.

## 3. Tarefa congelada

- Fixture: `src/store/continuidade.test.js`
- Anos: 2025 (fechamento) e 2026 (abertura)
- Seeds: não aplicável; objetos literais determinísticos
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `af3db94`
- Saídas brutas: `antes.txt` e `depois.txt`

## 4. Camada causal

Somente verificação: comparação pura de continuidade e apresentação do seu
resultado. Nenhum saldo é corrigido e nenhuma regra do Demonstrativo muda.

## 5. Decisão

**MANTER.** O fixture passou de capacidade ausente para 4/4: zero divergências
no par coerente, exatamente uma de cada tipo no adversarial e resultado
indisponível sem os dois anos; o quarto caso impede CNPJ repetido de trocar
dois bens de ordem. O perfil persistido AJU-01 exibiu um card com
"Saldos conferidos" e zero overflow horizontal. Evidência bruta: `antes.txt`
e `depois.txt`.

O primeiro verificador visual usou uma trajetória com apenas um ano e o card
ficou corretamente ausente; `erro-verificador-inicial.txt` preserva o ocorrido.
O teste foi repetido com o fixture persistido de dois anos.

## 6. Verificação

- Fixture puro: 4/4 testes aprovados.
- Navegador, perfil AJU-01 2025–2026: card presente, status coerente, 0 px de
  overflow horizontal.
- `npm test`: 40 arquivos e 882 testes aprovados.
- `npm run build`: aprovado.
