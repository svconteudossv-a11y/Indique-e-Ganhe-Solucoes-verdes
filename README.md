# Indique e Ganhe — Soluções Verdes

Primeira versão do portal web com backend Parse/Back4App. Cada novo fechamento gera **10% para o indicador e 0,6% para o administrador** sobre o valor do contrato de serviços. Os contratos já fechados preservam suas comissões. Não usa o valor da dívida, do veículo ou do financiamento como base. Não inclui recompensa fixa ou isenção de mensalidade.

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

A automação de conversa no WhatsApp, notificações, edição de campanhas, cadastro manual do indicado na interface, rastreamento de cliques e gestão de categorias ainda não estão implementados. ShareLog registra a geração do link, não comprova publicação nem clique. Imagens e vídeos podem ser cadastrados por URL ou upload, com prévia no portal.

## Configurar o Back4App

1. Crie uma aplicação Parse de testes com login habilitado. Configure a política de senha no servidor para exigir pelo menos 12 caracteres e habilite verificação de e-mail antes de produção.
2. Faça upload de `cloud/main.js` e `cloud/policy.js` para o diretório Cloud Code e configure `main.js` como entrada. O runtime precisa oferecer `node:crypto` e suporte a `Parse.Cloud.define` com `rateLimit`; confirme compatibilidade na versão do Parse Server da conta.
3. Defina a variável de servidor `PUBLIC_APP_URL` com a URL HTTPS da página, por exemplo `https://seu-dominio.com/`. Não coloque Master Key no frontend.
4. Crie as classes `Campaign`, `Referral` e `ShareLog` no dashboard. Configure as permissões de classe para negar a clientes todas as operações diretas, inclusive leitura. As Cloud Functions acessam os objetos usando Master Key no servidor. Desabilite criação de classes pelo cliente.
5. Restrinja `_User`: sem find/get públicos; cadastro permitido; atualização somente do próprio usuário. Restrinja `_Role`: sem criação/alteração por clientes. Não conceda acesso público aos dados de indicadores.
6. Preencha `public/config.js` com Application ID, JavaScript Key pública e Server URL de sua aplicação. Esses identificadores são públicos; proteja os dados com ACL e permissões de classe.
7. Cadastre uma conta normalmente. No dashboard, crie a função/papel Parse.Role de nome `admin`, adicione essa conta à relação `users` e deixe o papel sem permissão pública de escrita. O campo `role` no perfil não concede administração.
8. Hospede `public/` em HTTPS. Entre como admin, crie uma campanha e compartilhe seu link. Abra o link em janela anônima para testar a captura como indicado.

O esquema é criado pelas operações do Cloud Code. `Referral` contém ponteiros `indicator` e `campaign`, `referredName`, `referredPhone`, `hasFinancing`, `bank`, `source`, `consentAt`, `status`, `contractValueCents`, `commissionRate`, `rewardValueCents`, `adminCommissionRate`, `adminCommissionValueCents`, `commissionMode`, `closedAt` e `lastChangedBy`. `createdAt` é automático. `category` fica reservado no usuário, sem definir regras de categoria nesta versão.

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
4. Avançar para atendimento e fechar contrato de R$4.500: R$450 para o indicador e R$27 para o administrador.
5. Conferir que o servidor recusa saltos de etapa e calcula os percentuais fixos mesmo com um percentual diferente enviado pelo cliente.
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

## Arquivar e restaurar indicações

O painel da empresa oferece Arquivar indicação, com confirmação, e Ver indicações arquivadas / Restaurar indicação. Apenas usuários no papel admin podem executar setReferralArchived. Arquivamento mantém status, vínculo e valores de comissão e registra archiveChangedAt e archiveChangedBy. Indicações arquivadas não aparecem na lista ativa nem no histórico ativo do indicador, e não podem avançar de status sem restauração. As listas mantêm o limite atual de 100 registros.

Atualização: implante cloud/main.js no backend antes de publicar public/app.js no container. policy.js não precisa mudar. O servidor grava archived (Boolean), archiveChangedAt (Date) e archiveChangedBy (Pointer para _User) com Master Key; não libere Add field para o público. Se a instância restringir alterações de esquema mesmo com Master Key, crie esses campos no dashboard.

Validação local com consultas simuladas: recusa acesso sem administrador, valida Boolean, preserva comissão/status, evita gravação repetida, restaura e bloqueia mudança de status enquanto arquivada. Validar no Back4App após deploy.

## Upload de imagem e vídeo nas campanhas

No painel da empresa, selecione uma imagem PNG/JPG/WebP (até 5 MB) e/ou um vídeo MP4/WebM/MOV (até 20 MB). A prévia local aparece antes de ativar a campanha. Os arquivos são enviados usando Parse.File e as URLs resultantes ficam em imageUrl/videoUrl. Links HTTPS continuam disponíveis como alternativa; o arquivo selecionado tem prioridade. Campanhas mostram o vídeo com controles, sem reprodução automática.

Implante cloud/main.js no backend **antes** de publicar o portal via Deploy the latest commit. policy.js não muda. O novo beforeSave de Parse.File exige o papel admin, valida assinaturas básicas e tamanho. Caso a instância já tenha outro beforeSave de arquivos, unifique as regras em vez de cadastrar dois handlers para Parse.File.

Mantenha upload restrito a usuários autenticados no Parse; não habilite envio público para contornar erros. Confirme no painel do Back4App que o armazenamento e o limite de upload do plano atendem ao arquivo; se o provedor aplicar um limite menor, ele prevalece. MOV selecionado no formulário é convertido no servidor para MP4 H.264/AAC antes do upload. HEIC não é aceito nesta versão. Arquivos de campanha são materiais públicos acessíveis por URL; não envie contratos ou dados privados nesses campos.

O formulário valida os dois arquivos antes do envio. Reutiliza uploads concluídos ao tentar salvar novamente sem sair do formulário. Se a campanha falhar ou o usuário abandonar a página após um upload, o arquivo pode permanecer sem campanha associada; limpeza de arquivos órfãos fica para a gestão do armazenamento.

Validação local: sintaxe e testes com SDK/consultas simulados cobrindo permissões, assinaturas, tamanhos, formatos e reaproveitamento de upload. O envio real ao armazenamento e a reprodução devem ser conferidos após instalar no Back4App.

MOV: validação básica de contêiner QuickTime (moderno ou legado), extensão e limite de 20 MB. A prévia informa quando o navegador não consegue reproduzir, sem impedir o envio. Para ativar, atualize cloud/main.js e depois publique o portal. Testes locais simulados cobrem MOV moderno, legado e conteúdo inválido; testar um arquivo real após implantação.

## Conversão automática MOV → MP4

Ao ativar a campanha, o portal envia o MOV para POST /api/convert-mov. O servidor verifica a sessão do administrador na função authorizeCampaignUpload do Parse, processa com FFmpeg e devolve um MP4; o navegador então salva apenas esse MP4 no armazenamento da campanha. MP4/WebM seguem o fluxo direto. Não há fallback para salvar o MOV original se a conversão falhar.

Ordem de implantação: primeiro cloud/main.js no backend, depois Deploy the latest commit no container. A dependência ffmpeg-static fornece o executável durante a instalação npm; confira o log do build. É possível definir FFMPEG_PATH no container para um binário instalado manualmente. Não é necessário alterar policy.js.

server-config.json contém somente os mesmos identificadores públicos usados pelo frontend. Se trocar de app Parse, atualize esse arquivo e public/config.js juntos. Nenhuma Master Key é usada na conversão.

Limites: 20 MB na entrada e na saída, um processamento por vez por instância e até 90 segundos de conversão. Vídeo H.264, áudio AAC quando houver, resolução preservada (dimensões ímpares ganham no máximo um pixel para compatibilidade) e otimização para streaming. É uma recodificação e pode haver alteração de qualidade/tamanho. Arquivos temporários são removidos ao terminar ou falhar. Há progresso textual; não há percentual de transcodificação.

Vídeos de alta resolução/complexidade podem exceder os recursos ou timeout do plano atual. Validar no Back4App com um MOV pequeno antes de usar em produção. Teste local executou conversão real e verificou H.264/AAC, além de recusar acesso sem autorização e arquivo inválido. O teste de regressão usa FFmpeg disponível no ambiente ou pula quando ausente.

## Compartilhar o arquivo de vídeo

Campanhas com videoUrl HTTPS exibem Compartilhar vídeo, Baixar vídeo e Copiar legenda e link. O botão original passa a se chamar Compartilhar link no WhatsApp, para distinguir o compartilhamento de texto/link do arquivo.

Primeiro toque em Compartilhar vídeo: carrega o arquivo (até 20 MB), gera o link do indicador com src=whatsapp e prepara a legenda. Segundo toque em Escolher WhatsApp e compartilhar: chama navigator.share diretamente no gesto do usuário, com File e texto. O usuário escolhe o WhatsApp na folha de compartilhamento e confirma o destinatário/envio. O site não envia automaticamente mensagens nem consegue confirmar entrega ou forçar um aplicativo específico. Alguns destinos podem descartar a legenda; confira e use Copiar legenda e link se necessário.

Em navegadores sem suporte a Web Share com arquivos, use Baixar vídeo e Copiar legenda e link. Download usa Blob URL; se o servidor de origem bloquear CORS, falhar ou exceder o limite, o portal oferece Abrir vídeo para salvar manualmente no navegador. URLs externas precisam permitir a leitura por fetch para compartilhar arquivos. Links HTTPS existentes não precisam de conversão para esta função.

Um arquivo é mantido em cache temporário em memória; ao atualizar o painel, é liberada a referência principal. Não há pré-carregamento automático de todos os vídeos. Baixar o arquivo isoladamente não atribui leads; é necessário enviar também o link individual. ShareLog registra geração do link, sem comprovar envio ao WhatsApp.

Implantação desta função: somente Web Deployment → Action → Deploy the latest commit. Não altera o Cloud Code. Testes com APIs de navegador simuladas verificam anexo, link, gesto no segundo toque, cópia, download, cache, ausência de suporte e cancelamento. Validar no WhatsApp de um celular real após a publicação.

## Gerenciar campanhas: arquivar, restaurar e excluir

O painel da empresa agora lista campanhas na seção Gerenciar campanhas, com filtro entre não arquivadas e arquivadas. Ações exigem confirmação e papel admin.

- Arquivar: salva o estado ativo anterior, desativa a campanha e impede novos links e envios pelo formulário público até restauração.
- Restaurar: volta ao estado anterior ao arquivamento.
- Excluir campanha: exclusão lógica (deleted=true), remove das listas administrativas e de indicadores e desativa os links, sem opção de restauração no painel. O objeto permanece no banco para preservar ponteiros em indicações e ShareLog. Não apaga arquivos de mídia, indicações nem comissões.
- Campos de auditoria: archiveChangedAt/archiveChangedBy, deletedAt/deletedBy; o servidor grava com Master Key.

Implante cloud/main.js no backend antes de publicar o portal. policy.js não muda. Se necessário criar campos manualmente em Campaign: archived (Boolean), activeBeforeArchive (Boolean), archiveChangedAt (Date), archiveChangedBy (Pointer _User), deleted (Boolean), deletedAt (Date), deletedBy (Pointer _User). Não libere Add field ao público.

Testes locais com consultas simuladas verificam restrição administrativa, arquivamento/restauração, exclusão lógica, indisponibilidade dos links e preservação do objeto. Valide no Back4App após implantação.
