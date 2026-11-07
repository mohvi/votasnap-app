# VotaSnap — equipa de marketing (agentes de IA) e orçamento Nov 2026 – Abr 2027

Data: 7 de novembro de 2026. Câmbio usado: **1 USD ≈ 64 MT** (a validar no dia do pagamento). Preços de ferramentas a confirmar no site de cada uma antes de pagar.

## A ideia em uma frase

A equipa é feita de agentes de IA que preparam quase todo o trabalho. **Uma pessoa** (o fundador) aprova, publica, envia e faz o que exige presença física: visitas a marcas, entrega de prémios, pagamentos e assinaturas.

**O que os agentes não podem fazer sozinhos** (por regra nossa, da lei ou das plataformas):
- enviar mensagens ou emails em nome da VotaSnap sem aprovação;
- publicar nas redes sem aprovação;
- assinar acordos, receber ou fazer pagamentos;
- entregar prémios ou verificar o BI;
- decidir moderação final de contas (banir).

## A equipa

| Agente | Faz | Ferramenta | Entrega | Quando |
| --- | --- | --- | --- | --- |
| **1. CEO / Estratégia** | Plano, metas, prioridades, revisão semanal | Claude + skill `votasnap-ceo` | Revisão de segunda-feira com 3 prioridades e 1 decisão | Todas as segundas |
| **2. Comercial (SDR)** | Lista de marcas, mensagens, propostas, follow-up, renovação | Claude + skill `votasnap-comercial` + Gmail (só rascunhos) | 10 marcas novas e 10 mensagens prontas por semana, propostas em 24 h | Terças e quintas |
| **3. Conteúdo e redes** | Calendário editorial, textos, roteiros de vídeo, legendas | Claude + skill `votasnap-comercial` (secção anúncios) | 4 posts e 2 roteiros de Reels/TikTok por semana, Estado do WhatsApp diário | Domingo prepara a semana |
| **4. Design** | Capas dos desafios, posts, gráficos da loja, propostas em PDF | Canva (ligado ao Claude) | Capa de cada desafio, 4 peças por semana | Com o calendário |
| **5. Desafios e comunidade** | Temas dos desafios, regras, prémios, textos "Em breve", respostas a comentários | Claude + painel VotaSnap | Próximos 2 desafios sempre prontos, respostas sugeridas | Diário (15 min) |
| **6. Dados** | Números do painel, funil, relatório PDF das marcas | Claude + painel (Métricas, Relatório da marca) | Números para a revisão, relatório da marca 3 dias após o fim | Segundas e fim de cada desafio |
| **7. Suporte e moderação** | Triagem de denúncias, respostas a utilizadores e revisores da loja | Claude + painel (Moderação) | Lista de denúncias com sugestão, respostas prontas | Diário (10 min) |

Os agentes 1 e 2 já existem como skills. Os outros usam os mesmos skills com tarefas diferentes. Podem ser criados como tarefas agendadas no Claude (por exemplo, a revisão de segunda às 8h), que deixam o trabalho pronto para o fundador aprovar.

### O dia do fundador (cerca de 2 horas)

1. **15 min**: ver o que os agentes deixaram (posts, mensagens, denúncias).
2. **30 min**: aprovar e publicar posts e Estados do WhatsApp; enviar as mensagens às marcas.
3. **30 min**: chamadas ou visitas a marcas (2–3 por semana).
4. **15 min**: moderação final e confirmar vencedores no painel.
5. **30 min**: entregas de prémios e conversas com utilizadores (quando houver).

## Orçamento real: 2.000 MT em caixa

Factos confirmados: **SMS a 1,35 MT**, **Google Play já paga**, **2.000 MT disponíveis**. O dinheiro serve para provar que as pessoas participam e que uma marca paga. Tudo o resto é financiado pela receita das marcas.

### Onde vão os 2.000 MT (Nov – Dez)

| Item | MT | O que compra |
| --- | --- | --- |
| SMS de login | 800 | ≈ 450 registos (contando ~1,3 SMS por registo, porque há quem peça o código duas vezes) |
| Prémios dos 2 primeiros desafios Comunidade | 800 | 2 × (200 + 120 + 80) em recargas ou dados |
| Dados móveis para trabalho | 200 | Publicar, responder e testar |
| Reserva | 200 | Imprevistos (SMS extra, um prémio a mais) |
| **Total** | **2.000** | |

**Zero em:** anúncios, Canva Pro, Vercel Pro, influenciadores pagos. Se o plano do Claude que usam hoje já está pago, os agentes trabalham com ele; não entra nestes 2.000 MT.

### Como funcionar sem dinheiro para prémios

- **A partir do 3.º desafio, os prémios vêm dos parceiros.** O piloto com uma barbearia, um salão ou um restaurante é trocado por exposição: a loja dá o prémio (um corte, uma refeição, um voucher) e a VotaSnap dá o desafio, a notificação e o relatório.
- **Os prémios Comunidade ficam pequenos e frequentes** (recargas de 80–200 MT). O que conta é que sejam entregues sempre, com foto.
- **Cada novo utilizador custa ≈ 1,75 MT de SMS.** 500 utilizadores ≈ 880 MT. É o custo que mais importa vigiar: não fazer campanhas que tragam registos falsos.

### Regra para a primeira receita

Quando uma marca pagar (meta: Janeiro, 7.500–15.000 MT):
1. **25%** para prémios Comunidade e SMS dos meses seguintes.
2. **Vercel Pro** (~1.280 MT/mês), obrigatório a partir do momento em que há uso comercial.
3. **25%** guardado como reserva.
4. O resto paga, por esta ordem: Canva Pro, anúncios (só com D7 ≥ 15%), plano maior do Claude.

Os cenários abaixo só se aplicam a partir dessa receita.

## Orçamento de 6 meses (financiado pela receita)

Dois cenários. O **mínimo** cabe numa operação de uma pessoa sem investidor. O **recomendado** acelera o crescimento, mas só deve ser gasto quando as metas o justificarem (ver "Portões" abaixo).

Só se gasta acima dos 2.000 MT iniciais com dinheiro que as marcas já pagaram.

### Custos mensais

| Item | Mínimo | Recomendado | Notas |
| --- | --- | --- | --- |
| Claude (os agentes) | Pro, ~20 USD ≈ 1.280 MT | Max, ~100 USD ≈ 6.400 MT | O Max dá muito mais uso por dia para 7 agentes |
| Canva | Grátis | Pro, ~15 USD ≈ 960 MT | Pro: kit de marca, remover fundos, redimensionar |
| Vercel (painel e API) | Pro, ~20 USD ≈ 1.280 MT | igual | O plano grátis (Hobby) não permite uso comercial; passar a Pro quando a primeira marca pagar |
| Firebase (SMS de login + servidor) | ~600 MT | igual | SMS a 1,35 MT; ~2.000 registos em 6 meses × 1,3 SMS ≈ 3.500 MT, mais o servidor |
| Expo (builds e updates) | Grátis | Grátis | O plano grátis chega para este volume |
| Internet e dados | 1.000 MT | 1.000 MT | |
| Prémios dos desafios Comunidade | 3.200 MT (4 × 800) | 5.000 MT | Os prémios dos desafios patrocinados são pagos pelas marcas |
| Anúncios (a partir do mês 3) | 2.000 MT | 5.000 MT | Só se o retorno ao 7.º dia (D7) for ≥ 15% |
| Micro-influenciadores (a partir do mês 3) | 0 | 2.000 MT | Preferir pagar com produto ou prémio |

### Total dos 6 meses

| Item | Mínimo (MT) | Recomendado (MT) |
| --- | --- | --- |
| Claude | 7.680 | 38.400 |
| Canva | 0 | 5.760 |
| Vercel (5 meses) | 6.400 | 6.400 |
| Firebase / SMS | 3.600 | 3.600 |
| Internet e dados | 6.000 | 6.000 |
| Prémios Comunidade | 19.200 | 30.000 |
| Anúncios (4 meses) | 8.000 | 20.000 |
| Micro-influenciadores (4 meses) | 0 | 8.000 |
| Reserva (10%) | 5.100 | 11.800 |
| **Total** | **≈ 56.000 MT (~875 USD)** | **≈ 130.000 MT (~2.030 USD)** |
| Por mês, em média | ≈ 9.300 MT | ≈ 21.700 MT |

Não incluído: Apple (99 USD/ano, só quando lançarem no iPhone), salário do fundador, impostos e contabilidade, telemóvel e transporte para visitas e entregas.

### Receita para compensar (metas a validar)

| Mês | Meta comercial |
| --- | --- |
| Nov – Dez | 2 pilotos (grátis ou simbólicos) e 2 relatórios PDF entregues |
| Jan | 1.ª marca a pagar (Desafio, 7.500–15.000 MT) |
| Fev – Mar | 2 marcas a pagar por mês |
| Abr | 1 Campanha mensal (25.000–45.000 MT) ou 4 Desafios |

Se as metas forem cumpridas, a receita de Janeiro a Abril (~90.000–150.000 MT) cobre o cenário mínimo e grande parte do recomendado.

### Portões: quando gastar mais

| Antes de… | É preciso… |
| --- | --- |
| Passar do Claude Pro ao Max | Os agentes já usam o limite diário do Pro em 3 ou mais dias por semana |
| Pagar anúncios | D7 ≥ 15% e pelo menos 1 desafio com mais de 30 publicações |
| Subir os prémios Comunidade | Pessoas a votar por semana a crescer 2 semanas seguidas |
| Pagar influenciadores | Um piloto de marca com relatório entregue (para mostrar resultados) |
| Contratar uma pessoa | 3 marcas a pagar por mês durante 2 meses |

## Calendário de arranque da equipa

| Data | Passo |
| --- | --- |
| 8 Nov | Activar o Claude e ligar o Canva e o Gmail (só rascunhos) |
| 9 Nov | Agendar a revisão semanal do CEO (segundas, 8h) e o rascunho de conteúdo (domingos, 18h) |
| 9 – 15 Nov | Agente Comercial prepara a lista das 30 primeiras marcas locais e as mensagens |
| 16 Nov | Primeira revisão semanal com números reais |
| 1 Dez | Rever este orçamento com os números de Novembro |

## O que o fundador tem de decidir

1. **A comunidade semente** (define onde vão os primeiros 450 registos).
2. **Os 3 negócios** a quem pedir o prémio do 1.º piloto, em troca de exposição.
3. **Se o plano do Claude actual chega** para os agentes nos primeiros 2 meses.
