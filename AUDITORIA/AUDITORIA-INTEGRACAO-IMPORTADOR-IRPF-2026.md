# Auditoria da integração do importador IRPF 2026

Data: 31/08/2026.

## Escopo deste checkpoint

Camada imediatamente posterior à EXTRAÇÃO: provar que o resultado dos três PDFs
sintéticos chega ao estado anual e ao histórico sem perda, e que a revisão exibida
antes da importação informa todas as estruturas que serão gravadas.

## Base reproduzida

- Suíte com fixtures reais obrigatórias: 561 aprovados, 1 pulado, 0 falhas.
- Build Vite de produção: aprovado.
- `git diff --check`: aprovado.
- A execução foi feita em cópia temporária local com dependências reinstaladas,
  porque o `node_modules` do checkout UNC/WSL não contém o binding nativo exigido
  pelo Vitest/Vite no Windows.

## Achado INT-01 — revisão pré-importação omitia quadros estruturados

A tela contava somente algumas listas. Resumo e cálculo do imposto, demonstrativo
de ganho de capital, fechamentos anuais de renda variável/FII e a apuração rural
eram importados, mas não apareciam em "Dados estruturados encontrados". Também
faltavam listas de ganho de capital e diversos quadros rurais.

Correção: `resumirImportacao` passou a separar e exibir coleções e quadros anuais.
Validação visual com o AJU-01: a revisão mostrou 86 itens, 5 quadros, identidade,
hash, 41 páginas e todos os avisos antes de qualquer gravação. A importação foi
cancelada; nenhum perfil foi criado ou alterado durante o teste.

## Prova de preservação parser → reducer → histórico

O teste `src/utils/importacaoDeclaracao.pipeline.test.js` usa os retornos reais
registrados em `AUDITORIA/saida-parsepdf/` para AJU-01, ESP-01 e SAI-01. Para cada
caso ele:

1. aplica `IMPORT_DECLARACAO` ao reducer;
2. compara cada chave devolvida pelo parser com o estado resultante;
3. cria o snapshot anual;
4. troca de ano e restaura o histórico;
5. repete a comparação campo a campo.

Veredito deste checkpoint: **Aprovada** para a preservação dos campos atualmente
estruturados entre parser, reducer e histórico.

## Limite que permanece aberto

Este checkpoint não transforma fichas marcadas como `nao_suportada` em estruturas
fiscais. No AJU-01, a revisão ainda informou 13 fichas não estruturadas; os textos
permanecem preservados e os avisos são explícitos. A próxima camada deve modelar ou
formalmente manter como não estruturado cada um desses casos, sem confundir aviso
de perda com importação concluída.
