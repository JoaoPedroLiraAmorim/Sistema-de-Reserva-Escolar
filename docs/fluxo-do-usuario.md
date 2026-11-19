ALCEU RESERVAS
Fluxo do usuário — Professor e Coordenação
Base para documentação e apresentação do projeto | 28 de outubro de 2026

1. Objetivo
Organizar a reserva de salas e notebooks da escola, permitindo que professores planejem suas aulas e que a Coordenação acompanhe a disponibilidade e a entrega dos equipamentos.

2. Visão geral das duas jornadas
Professor: acessar → consultar agenda → escolher recursos e horário → confirmar reserva → acompanhar → utilizar.
Coordenação/Proatec: acessar → acompanhar agenda → administrar recursos e bloqueios → conferir reserva → confirmar retirada → acompanhar uso.

A reserva e a retirada são etapas diferentes. Na interface atual, a reserva válida fica confirmada após a verificação de disponibilidade. A Coordenação confirma a retirada dos notebooks quando chega o horário; não há uma etapa geral de aprovação prévia de toda reserva.

3. Jornada do Professor
Acesso
O professor entra no sistema e chega à sua área, com agenda, próximas reservas e ações para solicitar recursos. O acesso institucional é uma evolução prevista; o login atual é demonstrativo.

Consulta da agenda
O professor consulta a data e o período desejados, observa as reservas existentes e identifica uma oportunidade para sua aula.

Criação da reserva
Ao selecionar uma nova reserva, informa data, horário e recursos necessários, conforme os campos disponíveis. Pode reservar sala e/ou notebooks. Antes de confirmar, confere os dados.

Validação e confirmação
O sistema verifica conflitos de sala, disponibilidade de notebooks e bloqueios da Coordenação. Uma solicitação válida é registrada e aparece nas próximas reservas. Se houver impedimento, o professor recebe uma mensagem e deve escolher outra combinação de recursos ou horário. Datas passadas não são aceitas.

Acompanhamento e cancelamento
O professor consulta os detalhes e acompanha suas reservas. Quando o cancelamento está disponível, confirma a ação e libera os recursos para outros professores. Um bloqueio da Coordenação pode tornar uma reserva indisponível; essa condição deve ser observada antes do uso.

Uso dos notebooks
No dia da reserva, o professor aguarda a liberação da Coordenação. Depois que a retirada é confirmada, fica disponível o registro dos alunos que utilizarão os notebooks. Uma reserva somente de sala não exige essa etapa de equipamentos.

4. Jornada da Coordenação/Proatec
Acesso e acompanhamento
A Coordenação entra em sua área e acompanha a agenda para organizar o uso dos ambientes e dos notebooks.

Gestão dos recursos
Consulta as telas de salas e equipamentos para acompanhar os recursos cadastrados e sua disponibilidade. As ações devem refletir as condições reais da escola.

Gestão de bloqueios
Quando um período não pode receber reservas, a Coordenação informa data, intervalo e motivo do bloqueio. Novas solicitações nesse período são impedidas. Reservas atingidas aparecem como indisponíveis por bloqueio. Ao remover o bloqueio, o período volta a permitir reservas, respeitando os demais conflitos.

Conferência e entrega
A Coordenação localiza a reserva, confere os dados e confirma a retirada dos notebooks quando chega o horário de início. O sistema impede a confirmação antecipada e a retirada de reservas canceladas ou bloqueadas.

Acompanhamento do uso
Após a confirmação, o professor pode registrar os alunos vinculados ao uso dos equipamentos. A área de relatórios apoia a consulta das informações disponíveis na demonstração; não deve ser apresentada como um histórico permanente já consolidado.

5. Pontos de encontro entre as duas partes
Disponibilidade: o professor escolhe os recursos e a gestão acompanha a organização da agenda.
Bloqueios: a Coordenação sinaliza impedimentos e o professor ajusta seu planejamento.
Entrega: a Coordenação confirma a retirada e o professor passa à etapa de registro dos alunos.
Cancelamento: a liberação dos recursos permite que outros professores façam novas reservas.

6. Exemplo para a apresentação
Uma professora pretende realizar uma atividade com notebooks. Ela consulta a agenda, escolhe um período livre e informa a quantidade necessária. O sistema valida a disponibilidade e confirma a reserva.
No dia da aula, a Coordenação encontra a reserva e, a partir do horário de início, confirma a retirada. A professora registra os alunos que utilizarão os equipamentos.
Se o período estiver bloqueado ou não houver quantidade suficiente, a reserva não é concluída nessa combinação; a professora ajusta sua escolha.
O cenário é ilustrativo e deve ser demonstrado com dados fictícios.

7. Estado atual e evolução prevista
Já demonstrado na interface: áreas de Professor e Coordenação, agenda, criação e cancelamento de reservas, validação local de disponibilidade, bloqueios e confirmação de retirada com registro de alunos.
Limite atual: as telas armazenam os dados no navegador. Isso não garante sincronização entre computadores nem controle de acesso no servidor.
Integração inicial: existe uma consulta de salas no banco, ainda sem ligação com as telas.
Evolução prevista: conectar os fluxos ao servidor e ao banco compartilhado, implementar autenticação institucional e permissões, e definir a política de retenção dos registros.
Pontos a definir: processo de devolução e conferência física, tratamento de atrasos e avarias, notificações e manutenção de histórico. Esses itens não devem ser apresentados como funcionalidades concluídas.
Na implementação atual, reservas encerradas podem ser removidas pelo armazenamento local; um histórico permanente exige uma decisão e implementação específicas.

8. Roteiro sugerido para os futuros slides
Slide 1 — Problema e proposta
Mensagem: organizar o uso dos recursos escolares em um único fluxo.
Visual: nome do projeto e ícones de sala, calendário e notebook.

Slide 2 — Os dois perfis
Mensagem: o professor planeja a aula; a Coordenação organiza recursos e entrega.
Visual: duas colunas com responsabilidades resumidas.

Slide 3 — Fluxo do Professor
Mensagem: consultar → reservar → acompanhar → utilizar.
Visual: sequência de quatro etapas e captura da agenda.

Slide 4 — Fluxo da Coordenação
Mensagem: acompanhar → organizar → conferir → liberar.
Visual: sequência de quatro etapas e captura da área de gestão.

Slide 5 — Encontro dos fluxos
Mensagem: a retirada conecta a organização da Coordenação ao uso pelo professor.
Visual: duas faixas paralelas conectadas na confirmação de retirada.

Slide 6 — Regras e exceções
Mensagem: disponibilidade, conflitos, bloqueios e cancelamentos orientam a reserva.
Visual: exemplo de reserva válida e exemplo de impedimento.

Slide 7 — Demonstração e próximos passos
Mensagem: demonstrar o fluxo atual e explicar a evolução para dados compartilhados e acesso institucional.
Visual: capturas reais com legendas “demonstração atual” e “evolução prevista”.

Para animação futura, revelar cada etapa por clique e destacar a passagem da Coordenação para o Professor na retirada. Este documento oferece o roteiro; não contém animações incorporadas.

9. Base do documento
Elaborado a partir do README e dos fluxos presentes nos arquivos de Professor, armazenamento local e bloqueios do projeto Alceu Reservas. O texto descreve o comportamento demonstrativo identificado e separa as decisões ainda pendentes.



## Ideia mapeada: Nova reserva na navbar do professor (não implementada)

- Desktop: colocar “+ Nova reserva” no lado direito da navbar, antes do perfil.
- Celular: manter uma ação compacta “+ Reservar” no topo, com área de toque de pelo menos 44 px, sem encobrir o título ou o menu.
- A ação abre o mesmo formulário atual, preservando a agenda e seus filtros.
- Ao implementar, retirar o botão equivalente do conteúdo para evitar duplicação; manter as ações de reservar um horário da agenda.
- Validar o espaço disponível em telas de 320 px e a navegação por teclado antes de aprovar a mudança.

Esta proposta é apenas um mapeamento. A posição atual do botão foi preservada.
