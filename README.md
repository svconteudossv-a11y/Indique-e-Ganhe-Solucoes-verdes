# Indique e Ganhe — Soluções Verdes

Primeira versão do portal web com backend Parse/Back4App. A comissão é **5%, 7% ou 10% do valor do contrato de serviços fechado com a Soluções Verdes**, selecionada pela empresa no fechamento. Não usa o valor da dívida, do veículo ou do financiamento como base. Não inclui recompensa fixa ou isenção de mensalidade.

## O que está implementado

- Cadastro e login por e-mail/senha, telefone e código aleatório do indicador.
- Área do indicador: campanhas ativas, histórico e comissão por contrato.
- Links com indicador, campanha e origem; abertura do compartilhamento no WhatsApp/Facebook e cópia de legenda/link para Instagram.
- Página pública para o próprio indicado solicitar análise e autorizar contato.
- Painel administrativo: criação de campanhas com URLs de mídia, lista das últimas 100 indicações e avanço das etapas.
- Cálculo no servidor, em centavos. Percentual e valor ficam registrados no contrato; futuras categorias não alteram esse histórico.
- Regras de transição: novo → em atendimento → contrato fechado → comissão liberada → comissão paga.
- Controle administrativo por Parse.Role `admin`, sem confiar no campo de perfil enviado pelo navegador.

## Estado da entrega

Código inicial para instalação e validação em ambiente de testes. **Não está hospedado nem conectado a uma conta Back4App ou a um número WhatsApp.** Não realiza pagamentos Pix.

A automação de conversa no WhatsApp, notificações, upload direto de arquivos, edição de campanhas, cadastro manual do indicado na interface, rastreamento de cliques e gestão de categorias ainda não estão implementados. ShareLog registra a geração do link, não comprova publicação nem clique. Vídeos podem ser cadastrados por URL, mas ainda não têm prévia no portal.

## Configurar o Back4App

1. Crie uma aplicação Parse de testes com login habilitado. Configure a política de senha no servidor para exigir pelo menos 12 caracteres e habilite verificação de e-mail antes de produção.
2. Faça upload de `cloud/main.js` e `cloud/policy.js` para o diretório Cloud Code e configure `main.js` como entrada. O runtime precisa oferecer `node:crypto` e suporte a `Parse.Cloud.define` com `rateLimit`; confirme compatibilidade na versão do Parse Server da conta.
3. Defina a variável de servidor `PUBLIC_APP_URL` com a URL HTTPS da página, por exemplo `https://seu-dominio.com/`. Não coloque Master Key no frontend.
4. Crie as classes `Campaign`, `Referral` e `ShareLog` no dashboard. Configure as permissões de classe para negar a clientes todas as operações diretas, inclusive leitura. As Cloud Functions acessam os objetos usando Master Key no servidor. Desabilite criação de classes pelo cliente.
5. Restrinja `_User`: sem find/get públicos; cadastro permitido; atualização somente do próprio usuário. Restrinja `_Role`: sem criação/alteração por clientes. Não conceda acesso público aos dados de indicadores.
6. Preencha `public/config.js` com Application ID, JavaScript Key pública e Server URL de sua aplicação. Esses identificadores são públicos; proteja os dados com ACL e permissões de classe.
7. Cadastre uma conta normalmente. No dashboard, crie a função/papel Parse.Role de nome `admin`, adicione essa conta à relação `users` e deixe o papel sem permissão pública de escrita. O campo `role` no perfil não concede administração.
8. Hospede `public/` em HTTPS. Entre como admin, crie uma campanha e compartilhe seu link. Abra o link em janela anônima para testar a captura como indicado.

O esquema é criado pelas operações do Cloud Code. `Referral` contém ponteiros `indicator` e `campaign`, `referredName`, `referredPhone`, `hasFinancing`, `bank`, `source`, `consentAt`, `status`, `contractValueCents`, `commissionRate`, `rewardValueCents`, `commissionMode`, `closedAt` e `lastChangedBy`. `createdAt` é automático. `category` fica reservado no usuário, sem definir regras de categoria nesta versão.

## Verificação local

Requer Node.js 20+; o preview usa Python 3.

```sh
npm test
npm run check
npm run preview
```

Abra `http://localhost:8080`. Sem configuração, a página informa a necessidade de conexão; não apresenta dados fictícios como reais. Os testes cobrem cálculo, entradas inválidas, transições e normalização de telefone. Testes de integração com Parse e testes de navegador ainda precisam ser realizados após configurar a conta.

## Antes de operar com clientes reais

- Criar índices únicos e atribuição idempotente para evitar indicações duplicadas; definir a política comercial quando dois indicadores indicarem a mesma pessoa.
- Adicionar atualização atômica/controle de concorrência no fechamento e pagamento, além de um histórico de auditoria separado. A versão atual bloqueia repetição sequencial, mas não garante exclusão entre solicitações simultâneas.
- Adicionar paginação, recuperação de senha na interface, proteção antiautomação distribuída e validar permissões com duas contas independentes.
- Conectar o webhook e API do WhatsApp no servidor, validar assinatura e deduplicar eventos. Usar uma fila de notificações com chave única e tentativas de reenvio. Tokens e credenciais somente em variáveis de servidor.
- Implementar a coleta conversacional nome → telefone → financiamento com sessão persistente. O formulário atual é preenchido pelo próprio indicado.
- Notificar o indicador no fechamento com o percentual e valor calculados. A confirmação de pagamento deve ocorrer somente depois da operação financeira efetiva.

## Roteiro de validação

1. Criar indicador e admin; conferir que o indicador não acessa `companyDashboard`.
2. Criar campanha e gerar links para cada canal; conferir `ref`, `camp` e `src`.
3. Enviar formulário público; conferir autoria, autorização e status novo.
4. Avançar para atendimento e fechar contrato de R$4.500: 5%=R$225, 7%=R$315, 10%=R$450.
5. Tentar pular etapas e informar percentual diferente; o servidor deve recusar.
6. Liberar e marcar a comissão como paga; conferir o histórico no portal do indicador.

## Atualização: códigos com nome e sobrenome

Novos códigos usam o nome cadastrado, em maiúsculas e sem acentos: `Daniel Souza` → `DANIEL-SOUZA`. Nomes repetidos recebem `-002`, `-003`, etc. Um nome único como `Daniel` gera `DANIEL`. A busca considera códigos atuais e anteriores.

### Preparação obrigatória antes de atualizar o Cloud Code

1. Em `_User`, crie a coluna `previousReferralCode` do tipo String. Mantenha Add field público desabilitado.
2. Em Database → Index Manager, crie um **índice UNIQUE** na classe `_User`, campo `referralCode`, ordem ascendente. Confirme que foi concluído com sucesso. Se a interface/plano não disponibilizar índices únicos, não implante esta atualização até configurar a restrição no banco.
3. Para contas existentes, confira o nome completo no campo `name` antes de acessar o portal. Não altere `referralCode` manualmente.
4. Atualize **ambos** `cloud/main.js` e `cloud/policy.js` e faça Deploy.
5. Ao abrir o painel ou gerar um link, contas antigas com código `SV-` seguido de 24 caracteres hexadecimais são convertidas uma única vez. O código anterior é salvo em `previousReferralCode`; a captura aceita ambos os códigos.
6. Códigos novos não são recalculados quando o nome muda. Indicações já cadastradas continuam ligadas ao mesmo usuário por ponteiro.

A consulta escolhe o próximo número livre; o índice único é a garantia contra gravações simultâneas. Em uma colisão simultânea, uma solicitação pode ser recusada pelo banco: tente novamente para obter o próximo número. A migração preserva a consulta dos códigos antigos, mas o domínio da hospedagem também precisa continuar acessível para que o link abra.

Validação local: seis testes de política aprovados (incluindo acentos e homônimos) e sintaxe do Cloud Code verificada. Validar migração e resolução de links no Back4App depois do deploy.
