# Visibilidade das pendências preservadas

Falha: a nova proteção da retificadora conserva conflitos em ajustesLocaisRetificadora, mas a tela ainda anuncia apenas sucesso. O usuário não tem ciência imediata de quais valores locais divergiram do documento novo.

Previsão antes da implementação: após conciliação com conflito, a tela de importação exibirá ficha, registro, campo, valor local preservado e novo valor declarado; uma conciliação sem conflito não exibirá o aviso. Critério determinístico, não estimativa estatística.

Antes: busca em ImportPage não encontra o campo nem painel de pendências (aviso-retificadora-antes.txt vazio, comando rg com saída1). Fixture nova, sintética, sem aleatoriedade; não se apresenta isso como campanha pareada de agentes. Camada: apresentação das pendências já persistidas, sem mudar a decisão do reducer nem o cálculo.

Decisão: MANTER. Dois testes passaram em aviso-retificadora-depois.txt e o navegador confirmou exibição dos dois valores conflitantes em importacao-perfis-depois.txt. A revisão do valor ocorre na ficha indicada; o registro da divergência histórica não é apagado automaticamente ao editar.
