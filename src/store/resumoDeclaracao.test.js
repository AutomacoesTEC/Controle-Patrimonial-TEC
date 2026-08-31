// Os valores esperados aqui NÃO foram digitados de memória: saem do retorno
// real de parsePDF sobre os PDFs sintéticos (AUDITORIA/saida-parsepdf/*.json,
// gerados por src/irpf/dumpParsePdf.audit.test.js) e cada um é conferido
// contra a linha impressa correspondente, citada no comentário
// (AUDITORIA/rows-pdfjs/AJU-01.rows.txt, páginas 40 e 41).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { blocosResumoDeclaracao, conferenciasResumo } from './resumoDeclaracao';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const saida = (caso) => {
  const caminho = `${RAIZ}AUDITORIA/saida-parsepdf/${caso}.json`;
  return existsSync(caminho) ? JSON.parse(readFileSync(caminho, 'utf8')).resultado : null;
};

const aju = saida('AJU-01');
const esp = saida('ESP-01');

const bloco = (blocos, id) => blocos.find(b => b.id === id);
const valorDe = (bl, rotulo) => bl.linhas.find(l => l.rotulo === rotulo)?.valor;

describe.skipIf(!aju)('blocos do RESUMO a partir da declaração de ajuste anual (AJU-01)', () => {
  const blocos = blocosResumoDeclaracao(aju.impostoDevido);

  it('monta os sete blocos do quadro impresso', () => {
    expect(blocos.map(b => b.id)).toEqual([
      'rendimentos', 'deducoes', 'devido', 'pago', 'resultado', 'evolucao', 'outras',
    ]);
  });

  it('rendimentos tributáveis: as sete linhas e o TOTAL impressos (p40 r5 a r12)', () => {
    const b = bloco(blocos, 'rendimentos');
    expect(b.linhas).toHaveLength(7);
    expect(valorDe(b, 'Recebidos de Pessoa Jurídica pelo titular')).toBeCloseTo(51101.11, 2);
    expect(valorDe(b, 'Recebidos de Pessoa Jurídica pelos dependentes')).toBeCloseTo(12201.21, 2);
    expect(valorDe(b, 'Recebidos de Pessoa Física/Exterior pelo titular')).toBeCloseTo(14239.58, 2);
    expect(valorDe(b, 'Recebidos de Pessoa Física/Exterior pelos dependentes')).toBeCloseTo(3814.27, 2);
    // p40 r9: zero impresso é zero exibido. "0,00" na declaração é informação,
    // não ausência, e some da tela se for tratado como campo vazio.
    expect(valorDe(b, 'Recebidos acumuladamente pelo titular')).toBe(0);
    expect(valorDe(b, 'Recebidos acumuladamente pelos dependentes')).toBeCloseTo(9811.06, 2);
    expect(valorDe(b, 'Resultado tributável da Atividade Rural')).toBeCloseTo(120529.23, 2);
    expect(b.total.valor).toBeCloseTo(211696.46, 2); // p40 r12
  });

  it('deduções: as dez linhas e o TOTAL impressos (p40 r14 a r26)', () => {
    const b = bloco(blocos, 'deducoes');
    expect(b.titulo).toBe('Deduções');
    expect(b.linhas).toHaveLength(10);
    expect(valorDe(b, 'Contribuições às previdências oficial e complementar')).toBeCloseTo(6304.34, 2);
    expect(valorDe(b, 'Dependentes')).toBeCloseTo(2275.08, 2);
    expect(valorDe(b, 'Despesas médicas')).toBeCloseTo(6303.23, 2);
    expect(valorDe(b, 'Pensão alimentícia judicial')).toBeCloseTo(6006.28, 2);
    expect(valorDe(b, 'Livro caixa')).toBeCloseTo(3020.40, 2);
    expect(b.total.valor).toBeCloseTo(33595.97, 2); // p40 r26
  });

  it('imposto devido: o cálculo passo a passo, com a alíquota como percentual (p40 r29 a r37)', () => {
    const b = bloco(blocos, 'devido');
    expect(valorDe(b, 'Base de cálculo do imposto')).toBeCloseTo(178100.49, 2);
    expect(valorDe(b, 'Imposto devido')).toBeCloseTo(38123.85, 2);
    expect(valorDe(b, 'Dedução de incentivo')).toBeCloseTo(1707.34, 2);
    expect(valorDe(b, 'Imposto devido I')).toBeCloseTo(36416.51, 2);
    expect(valorDe(b, 'Imposto Lei 14.754/2023')).toBeCloseTo(242.40, 2);
    // Alíquota efetiva é percentual, não moeda: exibir 17,20 como R$ 17,20
    // seria erro de leitura fiscal, não de estilo.
    const aliquota = b.linhas.find(l => l.rotulo === 'Alíquota efetiva (%)');
    expect(aliquota.valor).toBeCloseTo(17.20, 2);
    expect(aliquota.formato).toBe('percentual');
    expect(b.total.valor).toBeCloseTo(36658.91, 2); // p40 r37
  });

  it('imposto pago: os oito componentes e o total (p40 r41 a r52)', () => {
    const b = bloco(blocos, 'pago');
    expect(b.linhas).toHaveLength(8);
    expect(valorDe(b, 'Imposto retido na fonte do titular')).toBeCloseTo(4104.14, 2);
    expect(valorDe(b, 'Imposto retido na fonte dos dependentes')).toBeCloseTo(1818.33, 2);
    expect(valorDe(b, 'Carnê-Leão do titular')).toBeCloseTo(918.80, 2);
    expect(valorDe(b, 'Carnê-Leão dos dependentes')).toBeCloseTo(204.64, 2);
    expect(valorDe(b, 'Imposto complementar')).toBeCloseTo(1901.11, 2);
    expect(valorDe(b, 'Imposto retido RRA')).toBeCloseTo(4804.04, 2);
    expect(b.total.valor).toBeCloseTo(13751.06, 2); // p40 r52
  });

  it('resultado: saldo a pagar com quota e número de quotas, sem linha de restituição (p40 r29, r33, r34)', () => {
    const b = bloco(blocos, 'resultado');
    expect(valorDe(b, 'Saldo de imposto a pagar')).toBeCloseTo(22907.85, 2);
    expect(valorDe(b, 'Valor da quota')).toBeCloseTo(22907.85, 2);
    const quotas = b.linhas.find(l => l.rotulo === 'Número de quotas');
    expect(quotas.valor).toBe(1);
    expect(quotas.formato).toBe('inteiro');
    // Paga OU restitui. Esta declaração paga, então a linha de restituição não
    // pode aparecer ao lado sugerindo uma segunda obrigação.
    expect(b.linhas.some(l => l.rotulo === 'Imposto a restituir')).toBe(false);
  });

  it('evolução patrimonial e outras informações (p41 r4 a r22)', () => {
    const ev = bloco(blocos, 'evolucao');
    // O título precisa dizer que o número é o DECLARADO: a mesma tela mostra,
    // logo abaixo, a evolução que o app calcula dos bens importados.
    expect(ev.titulo).toBe('Evolução patrimonial informada na declaração');
    expect(valorDe(ev, 'Bens e direitos na situação anterior')).toBeCloseTo(107537.85, 2);
    expect(valorDe(ev, 'Bens e direitos na situação atual')).toBeCloseTo(444846.93, 2);
    expect(valorDe(ev, 'Dívidas e ônus reais na situação anterior')).toBeCloseTo(102606.45, 2);
    expect(valorDe(ev, 'Dívidas e ônus reais na situação atual')).toBeCloseTo(79608.47, 2);

    const ou = bloco(blocos, 'outras');
    expect(ou.linhas).toHaveLength(14);
    expect(valorDe(ou, 'Rendimentos isentos e não tributáveis')).toBeCloseTo(45523.70, 2);
    expect(valorDe(ou, 'Rendimentos sujeitos à tributação exclusiva/definitiva')).toBeCloseTo(142197.69, 2);
    expect(valorDe(ou, 'Rendimentos tributáveis com imposto com exigibilidade suspensa')).toBeCloseTo(26413.87, 2);
    expect(valorDe(ou, 'Depósitos judiciais do imposto')).toBeCloseTo(11415.89, 2);
    expect(valorDe(ou, 'Imposto devido sobre Ganhos de Capital')).toBeCloseTo(13824.36, 2);
    expect(valorDe(ou, 'Imposto devido sobre ganhos líquidos em Renda Variável')).toBeCloseTo(862.82, 2);
    expect(valorDe(ou, 'Imposto pago sobre Renda Variável')).toBeCloseTo(1670.93, 2);
    expect(valorDe(ou, 'Doações a Partidos Políticos e Candidatos a Cargos Eletivos')).toBeCloseTo(1201.44, 2);
  });

  it('as somas do quadro fecham, então não há aviso de conferência', () => {
    expect(conferenciasResumo(aju.impostoDevido)).toEqual([]);
  });
});

describe.skipIf(!esp)('declaração final de espólio (ESP-01)', () => {
  it('não inventa a linha da Lei 14.754 quando a declaração não a informa', () => {
    const blocos = blocosResumoDeclaracao(esp.impostoDevido);
    const devido = bloco(blocos, 'devido');
    // No ESP-01 a extração devolve lei14754Imposto ausente. Campo ausente é
    // "este documento não informa", diferente de zero, e não pode virar uma
    // linha "R$ 0,00" que a declaração não imprime.
    expect(esp.impostoDevido.lei14754Imposto == null).toBe(true);
    expect(devido.linhas.some(l => l.rotulo === 'Imposto Lei 14.754/2023')).toBe(false);
  });
});

describe('regras do quadro que não dependem de arquivo', () => {
  it('quando há imposto a restituir, não mostra saldo a pagar nem quotas', () => {
    const blocos = blocosResumoDeclaracao({
      modeloDeclaracao: 'completa', saldoPagar: 0, impostoRestituir: 1234.56,
      valorQuota: 0, numeroQuotas: 0,
    });
    const b = bloco(blocos, 'resultado');
    expect(valorDe(b, 'Imposto a restituir')).toBeCloseTo(1234.56, 2);
    expect(b.linhas.some(l => l.rotulo === 'Saldo de imposto a pagar')).toBe(false);
    expect(b.linhas.some(l => l.rotulo === 'Número de quotas')).toBe(false);
  });

  it('no modelo simplificado o desconto ocupa o lugar das deduções legais', () => {
    const blocos = blocosResumoDeclaracao({
      modeloDeclaracao: 'simplificada', descontoSimplificado: 16754.34,
      totalDeducoes: 16754.34, dependentes: 0, despesasMedicas: 0,
    });
    const b = bloco(blocos, 'deducoes');
    expect(b.titulo).toBe('Desconto simplificado');
    expect(b.linhas).toHaveLength(1);
    expect(valorDe(b, 'Desconto simplificado')).toBeCloseTo(16754.34, 2);
    // A conferência por soma de linhas não vale neste modelo: o total É o
    // desconto, e cobrar a soma das deduções legais acusaria divergência falsa.
    expect(conferenciasResumo({
      modeloDeclaracao: 'simplificada', totalDeducoes: 16754.34, dependentes: 0,
    })).toEqual([]);
  });

  it('avisa quando o total informado não fecha com as linhas do bloco', () => {
    const avisos = conferenciasResumo({
      modeloDeclaracao: 'completa',
      rendimentosPjTitular: 1000, rendimentosTributaveisTotal: 2500,
      irrfTitular: 100, impostoPagoTotal: 100,
    });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('rendimentos tributáveis');
  });

  it('sem quadro importado, não monta bloco nenhum', () => {
    expect(blocosResumoDeclaracao(null)).toEqual([]);
    expect(blocosResumoDeclaracao(undefined)).toEqual([]);
  });
});
