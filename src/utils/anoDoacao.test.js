import { expect, it } from 'vitest';
import { anoFiscalDoacao } from './anoDoacao';
it('doação comum fica no ano do pagamento',()=>expect(anoFiscalDoacao({data:'2026-05-10'})).toBe(2026));
it('destinação na DAA deriva ano-base anterior sem seletor anual',()=>expect(anoFiscalDoacao({data:'2026-05-10',diretamenteNaDeclaracao:true})).toBe(2025));
it('informar pagamento de DAA importada não transporta sua ficha fiscal',()=>expect(anoFiscalDoacao({data:'2026-05-10',diretamenteNaDeclaracao:true,editando:true,anoAtivo:2025})).toBe(2025));
