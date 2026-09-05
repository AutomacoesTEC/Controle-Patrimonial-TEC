# Tabelas redimensionáveis na impressão

Falha observada no PDF gerado pelo navegador: coluna Movimentações do Relatório IRPF fica cortada à direita. Larguras em pixels do redimensionamento de tela continuam aplicadas no papel; wrappers mantêm overflow. O PDF anterior está em artefato temporário externo cptec-perfis-auditoria-mc97pg28, não selado como conteúdo do repositório.

Previsão anterior à correção: em largura A4, todas as tabelas do fixture permanecerão dentro de seus contêineres (excesso horizontal menor que2px). Redimensionamento de tela permanecerá intacto. Camada: CSS da mídia de impressão; sem cálculo fiscal.

Fixture fixa: src/store/__fixtures__/perfil-aju01-atual.json; script auditar-impressao.py; Chromium instalado, viewport de tela1440x1000 e impressão794x1123; sem seed. Comando pareado: intérprete Playwright auditar-impressao.py. Valores sintéticos preservados.

Decisão: MANTER. Antes, a tabela excedia o contêiner em330px (impressao-tabelas-antes.txt); depois, excesso zero nas tabelas medidas (impressao-tabelas-depois.txt). As larguras de arraste valem somente para mídia screen; impressão usa largura da página e não recorta o contêiner. Não há mudança nas fórmulas nem nos valores exportados.
