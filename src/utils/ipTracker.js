// Rastreamento leve do IP público de quem está usando o app, só para
// enriquecer o Histórico de Alterações (ver reducer.js, reducerComHistorico)
// com "de onde" cada alteração partiu. Limitação aceita pela usuária: só
// funciona com internet (o app é desktop via pywebview) e só traz o IP
// PÚBLICO (não identifica a máquina/usuário do Windows).
//
// Variável de módulo cacheada (não React/estado) de propósito: a busca roda
// UMA VEZ, cedo, no carregamento do app (ver App.jsx) — não é algo que muda
// durante a sessão, então não precisa de re-render nem de Context. Qualquer
// lugar que precise do IP (ex.: reducer.js montando a entrada do histórico)
// só lê a variável já resolvida via getIpAtual(), sem esperar promise nenhuma.
let ipAtual = null;

// Dispara a busca do IP público (api.ipify.org) e guarda o resultado na
// variável de módulo quando resolver. Sem internet ou com o serviço fora do
// ar, o catch fica vazio de propósito: ipAtual continua null e nada quebra —
// a entrada do histórico simplesmente não tem IP (ver HistoricoPage.jsx, que
// mostra '-' quando não disponível).
export function iniciarBuscaIp() {
  fetch('https://api.ipify.org?format=json')
    .then(res => res.json())
    .then(data => { ipAtual = data.ip; })
    .catch(() => {});
}

export function getIpAtual() {
  return ipAtual;
}
