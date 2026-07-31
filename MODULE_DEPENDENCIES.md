# MODULE_DEPENDENCIES.md

Regras de ativação/desativação dos 8 módulos comerciais e matriz de integrações condicionais entre eles. Toda checagem descrita aqui é implementada como `FeatureFlagGuard`/verificação de `FeatureFlag` (ver `DATABASE_DESIGN.md` §1) — nunca como dependência rígida de código entre módulos.

## 1. Módulos do painel da empresa

| Módulo | Sempre disponível? | Comercializável separadamente |
|---|---|---|
| Início | Sim (adaptável ao que estiver ativo) | Não é vendido separado |
| Atendimento | Depende de WhatsApp ou outro canal ativo | Sim |
| CRM | Não | Sim |
| Chatbot | Não | Sim |
| Automação | Não | Sim |
| WhatsApp | Não | Sim |
| Relatórios | Sim (abas variam conforme módulos ativos) | Não é vendido separado |
| Configurações | Sim | Não é vendido separado |

## 2. Regra de ativação de módulo

Ao ativar um módulo para um tenant (`FeatureFlag.enabled = true`):
1. Exibir item no menu do painel.
2. Liberar permissões associadas (`Permission` do módulo tornam-se atribuíveis a `Role`s do tenant).
3. Habilitar rotas de API do módulo (guard passa a permitir).
4. Exibir tela de configurações do módulo.
5. Liberar ações integradas nos módulos já ativos (ver matriz de integrações, §4).
6. Incluir métricas do módulo no dashboard "Início".
7. Incluir abas de relatório do módulo.
8. Registrar em `AuditLog` (`action: module.enabled`).

## 3. Regra de desativação de módulo

Ao desativar (`FeatureFlag.enabled = false`):
1. Ocultar item no menu.
2. Bloquear novas operações (guard passa a barrar criação/ação no módulo).
3. Interromper execuções relacionadas (ex.: pausar `Automation`s ativas do tenant sem cancelar histórico; `ChatbotExecution`s em andamento são marcadas para encerramento controlado, não abortadas abruptamente).
4. Ocultar **somente** as integrações dependentes desse módulo nos módulos ainda ativos (ex.: desativar Automação remove botão "criar automação" do CRM, mas não afeta CRM em si).
5. **Preservar**: dados, históricos, configurações, arquivos, auditoria.
6. Permitir reativação a qualquer momento, restaurando o comportamento anterior sem perda.
7. Registrar em `AuditLog` (`action: module.disabled`).

**Regra absoluta:** nenhuma desativação apaga dados automaticamente. Exclusão de dados é sempre uma ação explícita e auditada, separada da desativação de módulo.

## 4. Matriz de integrações condicionais

### CRM + WhatsApp
Quando ambos ativos:
- Criação automática de lead (`Contact`) a partir de nova conversa.
- Vínculo entre `Contact` e `Conversation`.
- Entrada automática no funil (conforme regra configurada — ver §10.10 do prompt mestre / `DATABASE_DESIGN.md`).
- Histórico de mensagens visível no CRM.
- Registro de origem do lead (número, campanha).
- Envio manual de mensagem a partir da ficha do contato.

Se WhatsApp for desativado: CRM continua funcionando com contatos e funis manuais; entrada automática de leads via WhatsApp para de ocorrer, mas leads já criados permanecem intactos.

### CRM + Chatbot
Quando ambos ativos:
- Criação de lead a partir de card de captura de dados do fluxo.
- Preenchimento de campos do `Contact` a partir de respostas do fluxo.
- Aplicação automática de tags.
- Qualificação e criação de `Opportunity`.
- Entrada no funil conforme configuração do fluxo.

Se Chatbot for desativado: CRM opera normalmente; leads antes criados via fluxo permanecem; não há mais preenchimento automático de campos por fluxo.

### CRM + Automação
Quando ambos ativos:
- Movimentação automática de `Opportunity` entre estágios.
- Criação automática de `Task`.
- Aplicação automática de tags.
- Alteração automática de responsável.
- Follow-ups por etapa do funil.
- Regras automáticas de ganho/perda.

Se Automação for desativada: CRM opera 100% manual; automações pausadas não apagam `Opportunity`s nem `Task`s já criadas.

### Chatbot + WhatsApp
Quando ambos ativos: habilita a execução do fluxo do Chatbot como canal real no número WhatsApp configurado (`ChatbotExecution` passa a processar mensagens reais, não apenas modo de teste interno).

Se WhatsApp for desativado: fluxos do Chatbot continuam editáveis/testáveis internamente, mas não executam em produção até reativação.

### Chatbot + Automação
Quando ambos ativos:
- Retomada de conversa abandonada.
- Follow-up após abandono de fluxo.
- Ações posteriores à conclusão do fluxo (`chatbot.flow.completed` → dispara automação).
- Reentrada em fluxo.
- Início programado de fluxo.

### WhatsApp + Automação
Quando ambos ativos:
- Envio automático de mensagens.
- Follow-ups agendados.
- Mensagens programadas.
- Pós-venda.
- Cobrança.
- Solicitação de avaliação.

Se WhatsApp for desativado: automações que dependem de envio de mensagem WhatsApp ficam com essa ação específica bloqueada (skip com log), demais ações da automação (criar task, mover funil, aplicar tag) continuam funcionando normalmente.

## 5. Implementação técnica da checagem

- Toda ação condicional é registrada em um `INTEGRATION_ACTIONS` catálogo (código), mapeando `ação → módulos requeridos`.
- Antes de expor uma ação integrada na UI (ex.: botão "criar automação" na ficha do contato do CRM), o backend expõe quais módulos estão ativos para o tenant (`GET /tenants/me/features`); o frontend usa essa lista para renderizar condicionalmente.
- No backend, cada handler de evento de domínio que implementa uma integração condicional verifica o `FeatureFlag` de **ambos** os módulos envolvidos antes de agir (ex.: handler de `conversation.started` que cria lead só executa se `crm.enabled && whatsapp.enabled` para aquele tenant).
- Testes automatizados obrigatórios (ver `ACCEPTANCE_CRITERIA.md`) cobrem: módulo ativo executa integração; módulo desativado não executa e não quebra o módulo dependente; reativação restaura o comportamento.
