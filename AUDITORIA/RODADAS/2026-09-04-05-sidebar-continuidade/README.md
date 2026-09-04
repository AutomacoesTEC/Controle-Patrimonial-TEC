# Rodada 05 — continuidade visível da navegação lateral

## 1. Falha nomeada

Em 1366x768 e 1280x720, a navegação lateral possui rolagem, mas abre no topo
sem qualquer indicação persistente de que há destinos abaixo. `Ganhos de
Capital`, `Renda Variável` e `Histórico de Alterações` ficam fora da área
visível, e a barra de rolagem nativa pode não aparecer no WebView/Windows.

Trajetória: importar AJU-01, entrar no perfil, manter `sidebar-nav.scrollTop=0`
e medir os três últimos itens e a existência de uma indicação acionável de
continuidade, nos dois tamanhos e temas.

## 2. Previsão escrita antes da mudança

- Nos quatro cenários, um controle `Ver itens abaixo` estará visível sempre
  que houver conteúdo abaixo da dobra.
- Acionar o controle levará ao fim da navegação, onde os três últimos itens
  ficarão integralmente visíveis.
- Ao chegar ao fim, o controle desaparecerá.
- Nenhum destino, agrupamento ou comportamento de navegação será alterado.

## 3. Tarefa congelada

- Fixture: `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`
- Viewports: 1366x768 e 1280x720; temas escuro e claro
- Seeds: não aplicável; trajetória determinística
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `4d5f2c15a8270787d4967d396dd6ea43f8ef62b6`
- Medidor: `medir-sidebar.py`; saídas: `antes.json` e `depois.json`

## 4. Camada causal

Somente observabilidade e controle da rolagem da navegação lateral. Os itens,
rotas, conteúdo das páginas e seletor de ano ficam fora desta rodada.

## 5. Decisão

**MANTER.** Antes, os três destinos finais estavam ocultos no topo e não
existia indicador em nenhum dos quatro cenários. Depois, `Ver itens abaixo`
aparece em 4/4, leva ao fim da navegação, os três destinos ficam integralmente
visíveis e o controle desaparece em 4/4 ao cumprir sua função.

A sobra vertical passou de 121 para 161 px em 1366x768 e de 169 para 209 px
em 1280x720 porque foram reservados 40 px de respiro abaixo do conteúdo: assim
o controle flutuante nunca encobre o último destino. A barra nativa também
ganhou contraste e espessura explícitos. Saídas brutas: `antes.json` e
`depois.json`.

Verificações adicionais: `npm run build` concluído; `npm test` com 37 arquivos
e 872 testes aprovados.
