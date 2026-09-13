# Correções locais — 12/09/2026

Estado: alterações preparadas no código, ainda sem publicação da API, das regras Firebase ou das aplicações. A permissão `admin: true` foi atribuída e confirmada na conta indicada pelo proprietário (`admin@votasnap.com`). Não foram feitas cobranças. A aplicação não deve ser lançada com as regras antigas sem revisão.

## Concluído e validado localmente

- TypeScript: os 59 erros iniciais foram corrigidos. `npx tsc --noEmit` passa.
- Contrato único entre o modal, o hook e o resultado do pagamento; removido endereço IP privado fixo. A API é configurada com `EXPO_PUBLIC_BACKEND_URL` e precisa de HTTPS em produção.
- Pedido manual pendente já não permite submeter como se estivesse pago. Estado é confirmado pela API; não há fallback para um perfil local modificável pelo cliente.
- Backend M-Pesa: validação TLS ativa, referência aleatória, reserva persistida antes da cobrança e gravação atómica da confirmação. Resposta incerta mantém a reserva: precisa de reconciliação, não de cobrança repetida.
- Cobranças e novos pedidos manuais ficam desativados por padrão no backend. `ENABLE_PAID_CHALLENGES=true` só deve ser usado depois de completar a reconciliação, validar regras e aprovar o modelo de inscrições pagas. Não há rotina automática de reconciliação nesta entrega.
- Votos no feed, no hook, no ecrã de votação e no link de entrada usam `/api/challenges/vote`. O backend verifica identidade, prazo, participação existente, suspensão, voto próprio e duplicado. Voto e contadores são alterados na mesma transação.
- Removido encerramento e atribuição de pontos no telemóvel. `/api/challenges/close` exige `admin: true` no token e processa o resultado uma vez. O painel pode solicitar o processamento após o prazo. Ainda falta configurar execução automática/agendada; por enquanto o administrador aciona o processamento.
- Backend: sete testes locais passam, incluindo repetição de votos, empate, encerramento repetido e autorização das rotas. O teste HTTP usa uma base em memória; não substitui testes das regras com o emulador Firebase.
- App: bloqueio/desbloqueio de utilizadores, filtragem no feed/explorar/detalhe/link, termos acessíveis, link de privacidade e limites de upload de 10 MB para fotos e 50 MB para vídeos. Os limites precisam também de ser impostos no Storage; a verificação atual acontece depois de carregar o blob em memória.
- Persistência Firebase diferenciada entre web e nativo; inicialização não ignora erros arbitrários. Removido ficheiro App Check não utilizado que importava um pacote ausente e continha configuração de exemplo. App Check ainda não está implementado.
- Notificações remotas não são inicializadas no Expo Go; listeners usam a API de remoção atual. As notificações de voto foram retiradas da escrita no cliente; falta implementar o envio no servidor após a confirmação do voto.
- Conta: verificação de autenticação recente antes de começar a apagar dados. A eliminação ainda precisa de ser migrada para um processo retomável no servidor e integrada com as novas regras de voto.
- Credencial Admin retirada do índice Git, mantendo a cópia local. Isto não revoga a chave nem apaga o histórico: ambas as ações continuam pendentes de verificação da infraestrutura.
- Bundle Android e painel web compilaram nesta sessão; não foi efetuado teste num dispositivo físico.

## Administração: primeira configuração

O painel agora exige uma custom claim Firebase `admin: true`. Ter email, telefone ou um campo `role` no perfil não concede essa permissão. O UID da sessão aparece no ecrã de acesso recusado.

No backend `C:/Users/moham/MPESA/mpesa_api_votasnap`, foi preparado:

```powershell
node scripts/grant-admin.cjs --uid UID_DA_CONTA
node scripts/grant-admin.cjs --uid UID_DA_CONTA --apply
```

O primeiro comando apenas identifica a conta e a permissão atual. O segundo atribui a claim, preservando outras claims. Pode usar `--email EMAIL` em vez de `--uid`. Exige credenciais administrativas válidas em `FIREBASE_SERVICE_ACCOUNT` ou Application Default Credentials. Não colocar credenciais no browser. Após atribuir a permissão, clicar em **Atualizar acesso** no painel.

O painel requer `REACT_APP_BACKEND_URL` com a mesma API utilizada pela aplicação. O fornecedor de autenticação email/palavra-passe deve estar ativo para o login administrativo; contas da aplicação continuam a usar o fluxo SMS existente. Não foi criada uma nova conta administrativa.

## Diagnóstico anterior à publicação de 12/09 (histórico)

1. As regras Database foram obtidas via API administrativa, em leitura apenas: a configuração atual tem `.read: true` e `.write: true` na raiz. Isto confirma leitura e escrita públicas, um bloqueador crítico. A cópia está em `.expo/current-database.rules.json`. Ainda falta obter regras Storage e código das Cloud Functions de SMS. Preparar migração de consultas e regras restritivas antes de publicação; não considerar a proteção do painel suficiente.
2. Publicar/testar a API com as novas rotas e configurar os URLs nos ambientes local e EAS. Sem essa publicação, a nova app não conseguirá votar nem usar as novas rotas de pagamento.
3. Integrar permissões: clientes não devem alterar contadores, vencedores, pontos, pagamentos ou pedidos de confirmação. Somente o backend e as operações administrativas autorizadas podem fazê-lo. Regras permissivas em nós superiores invalidam restrições nos nós inferiores.
4. Adicionar `blocks/{uid}/{blockedUid}`: leitura apenas pelo próprio utilizador; escrita apenas pelo próprio, proibindo auto-bloqueio; valores `true` ou remoção. Validar com emulador antes de publicar. Sem estas permissões, o bloqueio pode ser recusado pelo Firebase.
5. Migrar os perfis públicos para um nó separado. Os feeds e várias consultas ainda leem `users`; não basta apertar permissões sem adaptar essas consultas e migrar os dados. Retirar deteção de partilha de push token do cliente e fazê-la no servidor.
6. Impor tamanho e tipo de ficheiro, propriedade da entrada, prazo e autorização de submissão no servidor/Storage. O cliente ainda publica entradas diretamente, portanto a verificação local não constitui uma barreira de segurança.
7. Migrar a eliminação de conta e a seleção manual de vencedores para operações de servidor. O painel ainda faz outras alterações diretas e exige regras administrativas corretas.
8. Rever os termos de participação, regras de cada concurso, política publicada e contactos antes da submissão às lojas.
9. Testar num Android físico e no emulador Firebase: duas sessões simultâneas, rede interrompida, repetição, conta comum/anónima, expiração e encerramento. Confirmar permissões de câmara/media, links e eliminação.

## Limitação da migração de votos

O esquema existente distribui desafios, entradas, votos e pontos por nós de topo diferentes. Para manter atomicidade sem migrar dados silenciosamente, a implementação usa uma transação na raiz **apenas no servidor**. Isso lê o conjunto da base e pode criar contenção e custo; não é uma arquitetura aprovada para crescimento. Antes de produção com volume, agrupar os dados transacionais por desafio ou usar uma base com transações adequadas. Testar volume e latência antes de decidir a publicação.

As regras Database foram lidas pela API, sem alterações. Storage, SMS e permissões dos restantes serviços ainda precisam de verificação. A compilação e os testes locais não demonstram que as permissões em produção estejam corretas.


## Publicação e verificação — 13/09/2026

- API publicada: https://us-central1-votasnap.cloudfunctions.net/votasnapApi. Codebase `votasnap-api`, Node 22, máximo uma instância, mínimo zero. Funções SMS existentes preservadas. Pagamentos continuam desativados na nova API.
- Regras Database e Storage publicadas e comparadas com os ficheiros testados. Leitura anónima de `users` recusada em produção. Cópias anteriores em `.expo/security-backups/`.
- 51 perfis migrados para `publicProfiles`, excluindo telefone, pagamentos e tokens. Registo de perfil, submissão e eliminação usam API autenticada.
- 11 testes de backend e 6 testes de regras passaram; TypeScript, exportação Android e compilação do painel passaram. Os testes não substituem a validação num dispositivo físico.
- Corrigido erro de JSON na submissão: o endereço antigo Vercel devolve HTML/404. `.env`, EAS e painel local configurados com a nova API. Metro iniciado com cache limpo; bundle servido confirmado com URL nova, sem URL antiga. Três testes adicionais cobrem HTML, JSON inválido e erros da API.
- Verificação reproduzível: `node scripts/verify-api.cjs`, `node scripts/firebase-security.cjs verify`, `node --test scripts/api-response.test.cjs`.
- Pendências: renovar login Vercel para publicar o painel e rever/retirar a API antiga; rotação de credenciais expostas no histórico; migração da seleção manual de desempate para transação de servidor; revisão de SMS, pagamentos, termos e teste completo em dispositivo antes das lojas. A API antiga não foi desativada nesta sessão.


## M-Pesa: configuração existente reutilizada — 13/09/2026

A pedido do utilizador, as inscrições pagas foram ativadas na API Firebase. Foram reutilizados o endpoint, a chave e SERVICE_PROVIDER_CODE do backend existente. A chave fica no Secret Manager como VOTASNAP_MPESA_API_KEY, ligada à função; não está no bundle nem no código publicado. A API aceita os nomes antigos de configuração. Quinze testes locais passaram, incluindo três testes de pagamento com fornecedor simulado. A configuração e publicação são descritas em mpesa_api_votasnap/PAGAMENTOS.md. Uma cobrança real não foi realizada nesta alteração.
