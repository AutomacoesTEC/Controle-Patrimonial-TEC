# Rodada 27 — Gráficos de apoio recolhidos

## 1. Falha nomeada

Ao abrir o Dashboard do perfil AJU-01, os três gráficos de apoio ficam todos
expandidos. Depois do demonstrativo, eles ocupam mais de uma tela sem que a
pessoa tenha pedido essa leitura secundária.

Trajetória: persistir o perfil AJU-01, abrir o Dashboard, fechar o aviso
estrutural e medir quantos contêineres de gráfico têm dimensão, a altura total
dos cards que os contêm e a presença de um controle recolhível.

## 2. Previsão escrita antes da mudança

- Um controle `.dashboard-graficos` passará de 0 para 1 e iniciará fechado.
- Gráficos com dimensões no estado inicial cairão de 3 para 0.
- A altura inicial dedicada ao conjunto cairá de mais de 900 px para menos de
  90 px.
- Após uma única abertura, os mesmos três títulos permanecerão e os três
  gráficos voltarão a ter dimensões positivas.

## 3. Tarefa congelada

- Fixture de dados: `src/store/__fixtures__/perfil-aju01-atual.json`
- Verificador: `verificar-graficos.py`
- Viewport: 1366 × 768, tema escuro
- Seeds: não aplicável
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `277750a`
- Saídas brutas: `antes.txt` e `depois.txt`

## 4. Camada causal

Somente contexto visual: exposição inicial dos gráficos já existentes.
Dados, cálculos, séries, cores, demonstrativo e faixa do saldo permanecem
intocados.

## 5. Decisão

**MANTER.** O controle passou de 0 para 1 e inicia fechado. Os gráficos
expostos e dimensionados caíram de 3 para 0, enquanto a altura inicial caiu
de 1.088 para 54 px. Uma única abertura restaurou 3/3 gráficos, agora em
1.162 px, e preservou os três títulos caractere a caractere.

Evidência bruta pareada: `antes.txt` e `depois.txt`. As duas correções do
verificador, feitas antes da medição válida do depois e sem alterar a
interpretação do antes, estão registradas em `erro-verificador-inicial.txt` e
`erro-metrica-retangulo.txt`.

Verificação adicional:

- `npm run build`: passou.
- `npm test -- --run --reporter=dot`: 41 arquivos e 885 testes passaram.
