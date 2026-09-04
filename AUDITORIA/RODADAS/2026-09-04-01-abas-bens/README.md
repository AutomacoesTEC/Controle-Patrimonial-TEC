# Rodada 01 — confinamento das abas de Bens e Direitos

## 1. Falha nomeada

Na tela `Bens e Direitos`, em 1366x768 e 1280x720, a barra de categorias tem
largura intrínseca maior que a área útil. Ela termina em `x=1612` e faz a
própria `.page-body` rolar horizontalmente. A trajetória congelada é:

1. abrir um perfil novo;
2. importar `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`;
3. entrar no perfil;
4. abrir `Bens e Direitos`;
5. medir nos temas claro e escuro, em 1366x768 e 1280x720.

O efeito observável é que as categorias finais, como `Criptoativos` e
`Fundos`, ficam fora da área visível e a rolagem ocorre no contêiner da página,
não exclusivamente na barra que precisa dela.

## 2. Previsão escrita antes da mudança

- `pageBody.sobra`: de 246 px (1366x768) e 332 px (1280x720) para 0 px, nos
  dois temas.
- `toolbar.sobra`: de 274 px e 360 px para 0 px.
- `tabsFora`: deixa de existir.
- A barra de abas continua com rolagem horizontal própria quando suas opções
  não couberem.
- Nenhuma mudança nos dados importados, cálculos ou tabela de bens.

## 3. Tarefa congelada

- Fixture: `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`
- Viewports: 1366x768 e 1280x720
- Temas: escuro e claro
- Seeds: não aplicável; trajetória determinística, sem aleatoriedade usada na
  medição geométrica
- Modelo: Codex baseado em GPT-5; identificador exato do modelo da sessão não
  é exposto ao agente
- Commit-base: `72580c54a1adba9c4033ebc8b2302d1bcf0efb77`
- Medidor: `medir-abas-bens.py`
- Baseline bruto: `antes.json`

## 4. Camada causal desta rodada

Somente interface/layout da barra de categorias de `Bens e Direitos`.
Mudanças de tabela, sidebar, cálculos, estado e outras barras de abas ficam
fora desta rodada.

## 5. Decisão

**MANTER.** O mesmo fixture, modelo, viewports e temas produziu:

- `pageBody.sobra`: 246/332 px antes; 0/0 px depois;
- `toolbar.sobra`: 274/360 px antes; 0/0 px depois;
- limite direito das abas: `x=1612` antes; `x=1338` em 1366 px e `x=1252`
  em 1280 px depois, sempre dentro da área útil;
- rolagem própria das abas: 274 px em 1366x768 e 360 px em 1280x720;
- resultados idênticos nos temas claro e escuro.

A saída bruta pareada está em `antes.json` e `depois.json`. A mudança foi
mantida porque alcançou integralmente a previsão sem alterar dados, cálculos
ou tabelas.

Verificações adicionais sobre o estado mantido:

- `npm run build`: concluído;
- `npm test`: 37 arquivos e 872 testes aprovados.

Nota do instrumento: antes da medição válida, o seletor genérico de arquivo
foi corrigido para apontar explicitamente ao importador que aceita `.pdf`.
Ele antes encontrava o novo campo de restauração de backup. A correção do
medidor foi feita com o código do produto novamente no commit-base; só depois
foram coletados `antes.json`, reaplicada a mudança causal e coletado
`depois.json`.
