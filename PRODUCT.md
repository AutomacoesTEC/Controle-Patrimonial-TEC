# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

O aplicativo é React/Vite empacotado como app desktop Windows por PyWebView (`main.py`, `desktop_api.py`) e PyInstaller. A interface é web renderizada numa janela desktop; não há versão nativa iOS/Android.

## Users

Consultora tributária (e a equipe da TEC) que monta e acompanha o patrimônio de vários clientes pessoa física. Cada cliente é um perfil próprio. O trabalho acontece ao longo do ano, lançando compra, venda, baixa e benfeitoria, e culmina na preparação da próxima declaração de IRPF.

## Product Purpose

Controlar a variação patrimonial do contribuinte em ciclo plurianual: importa a declaração já entregue (.DBK/.DEC ou PDF) como posição base, recebe os lançamentos do ano seguinte e, ao fechar o ano, deixa a situação em 31/12 pronta para a próxima declaração. O ciclo se repete ano após ano.

Sucesso para quem usa:
- ver num olhar se a conciliação fecha e o que ainda falta explicar;
- ler tabelas densas de valores sem cansaço;
- lançar movimentações com menos cliques e menos idas e vindas;
- apresentar ao cliente um produto de aparência profissional e acabada.

## Positioning

Não é um programa de uma declaração só: guarda o rastro de cada movimentação (por que o valor mudou) e carrega a posição de um ano para o outro, com conciliação de caixa e origem de cada registro (declaração importada ou lançamento manual).

## Operating Context

- Uso diário de trabalho numa estação Windows, janela desktop, tela larga.
- Documentos de entrada: declaração IRPF em .DBK/.DEC e PDF; os arquivos originais do cliente são preservados e nunca regravados.
- Saídas: demonstrativo impresso em A4 e exportação em planilha.
- Dados reais de clientes (CPF, patrimônio) ficam fora do repositório.

## Capabilities and Constraints

- Telas: Demonstrativo, Acompanhamento financeiro, Revisão periódica, Importar declaração, Titular, Bens e direitos, Dívidas e ônus, Rendimentos, Pagamentos efetuados, Pagamentos diversos, Doações, Atividade rural, Ganhos de capital, Renda variável, Relatório IRPF, Histórico, Modalidade, além do seletor e desbloqueio de perfis.
- Terminologia fiscal segue o programa IRPF da Receita Federal (fichas, códigos de bens, rendimentos e pagamentos); rótulos oficiais não são reescritos.
- "Situação em 31/12" é custo de aquisição, não valor de mercado.
- Toda mudança de interface preserva cálculo, importação, histórico e contratos de texto cobertos pelos testes.
- Entrega sem declaração carregada: o app abre vazio, só com a criação de perfil.

## Brand Commitments

- Nome CP-TEC, sistema visual "Ardósia" documentado em DESIGN.md.
- Sem dourado ou qualquer acento quente; sem emoji decorativo; sem travessão em texto de interface.
- Aparência de produto profissional, sem cara de interface gerada por IA.

## Evidence on Hand

- Declarações de exemplo usadas nos testes ficam fora do repositório, por caminho absoluto, por conterem dado real.
- PDFs sintéticos em `output/pdf/` e fixtures em `src/pages/__fixtures__/`.
- Não existem depoimentos, clientes citáveis ou métricas de uso publicadas; não inventar.

## Product Principles

1. O dado fiscal manda: nenhuma decisão visual esconde, arredonda ou reinterpreta um valor.
2. O que precisa de atenção aparece antes do que já está resolvido.
3. Rastro visível: todo valor mostra de onde veio e por que mudou.
4. Densidade com clareza: muita informação por tela, organizada para leitura rápida.
5. Trabalho de consultoria: cada tela deve poder ser mostrada a um cliente sem constrangimento.

## Accessibility & Inclusion

Contraste WCAG AA medido nos dois temas (claro e escuro), foco visível de teclado, campos e tabelas com nome acessível e modais com foco confinado, conforme já registrado em DESIGN.md.
