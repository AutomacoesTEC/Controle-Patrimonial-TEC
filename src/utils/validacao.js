// Validação de campo obrigatório dos formulários de cadastro.
//
// Até a auditoria de 21/08/2026 não existia UM atributo `required` no app
// inteiro, e só três lugares validavam alguma coisa antes de gravar. Abrir
// qualquer cadastro e clicar em Salvar sem digitar nada criava o registro e
// mostrava a mensagem de sucesso: um bem em branco entrava na contagem do
// Dashboard (173 itens viraram 174), ia para a exportação e sumia do radar
// por não ter texto nenhum para reconhecer.
//
// A guarda é em JavaScript, e não no atributo `required` do HTML, por três
// motivos concretos deste app: MoneyInput é um <input type="text"> com
// máscara (o `required` do navegador não sabe ler o valor numérico por trás);
// o Bloco 1 do BemModal fica em `display: none` quando recolhido, e um campo
// obrigatório invisível trava o submit com um erro que a pessoa não vê nem
// consegue corrigir; e assim a regra fica testável sem montar componente.

// Recebe pares [rótulo, valor] na ordem em que os campos aparecem na tela e
// devolve o rótulo do PRIMEIRO que estiver vazio, ou null se estiver tudo
// preenchido. Texto em branco não conta como preenchido.
export function primeiroCampoVazio(pares) {
  for (const [rotulo, valor] of pares) {
    if (valor === null || valor === undefined) return rotulo;
    if (typeof valor === 'string' && valor.trim() === '') return rotulo;
    if (Array.isArray(valor) && valor.length === 0) return rotulo;
  }
  return null;
}

// Mesma ideia para campo de dinheiro/quantidade, onde "vazio" e "zero" são a
// mesma coisa na prática: um rendimento de R$ 0,00 ou uma despesa de R$ 0,00
// não é um lançamento, é um formulário esquecido. Aceita o texto cru do
// MoneyInput ou o número já convertido.
export function primeiroValorZerado(pares) {
  for (const [rotulo, valor] of pares) {
    const n = typeof valor === 'number' ? valor : parseFloat(valor);
    if (!Number.isFinite(n) || n === 0) return rotulo;
  }
  return null;
}

// Monta a mensagem exibida no toast. Uma frase só, direta, dizendo o que
// falta e onde.
export function mensagemObrigatorio(rotulo) {
  return `Preencha o campo ${rotulo} antes de salvar.`;
}
