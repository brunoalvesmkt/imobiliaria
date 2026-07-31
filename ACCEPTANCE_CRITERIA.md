# ACCEPTANCE_CRITERIA.md

Checklist reutilizável para toda feature futura + casos de teste críticos obrigatórios.

## 1. Critérios gerais de aceite (aplicar a toda funcionalidade)

Uma funcionalidade só é considerada concluída quando:

- [ ] Frontend está funcional (não é protótipo estático; conectado ao backend real).
- [ ] Backend está funcional (endpoint real, sem mock permanente).
- [ ] Banco está migrado (migration versionada aplicada, não só schema local).
- [ ] Validações estão implementadas (DTO/Zod no backend; formulário no frontend).
- [ ] Permissões estão aplicadas (RBAC verificado no backend, ver `PERMISSIONS_MATRIX.md`).
- [ ] Isolamento multiempresa está protegido (tenant nunca confiado por input do cliente, ver `SECURITY.md` §2).
- [ ] Erros estão tratados (mensagens claras, sem stack trace exposto ao usuário final).
- [ ] Estados de loading e vazio existem na UI.
- [ ] Auditoria está integrada quando a ação for auditável (ver lista em `SECURITY.md` §6).
- [ ] Testes automatizados relevantes estão passando.
- [ ] Documentação está atualizada (README do módulo, Swagger, este conjunto de documentos quando a mudança afeta arquitetura/permissões/banco).
- [ ] Interface está responsiva (desktop, tablet, mobile conforme aplicável ao módulo).
- [ ] Fluxo foi validado manualmente ponta a ponta antes de reportar como concluído.

Regras adicionais permanentes (seção 30 do prompt mestre):
- Não substituir código funcional sem necessidade.
- Não executar comandos destrutivos sem proteção/confirmação.
- Não remover migrations antigas.
- Não apagar dados.
- Não usar mocks permanentes em funcionalidades que deveriam ser reais.
- Não deixar botões sem ação.
- Não criar telas desconectadas do backend.

## 2. Casos de teste críticos obrigatórios

Estes casos devem existir como testes automatizados (integração/E2E) antes de qualquer release, e são reavaliados a cada nova feature que toque as áreas envolvidas:

1. **Isolamento de tenant**: Empresa A não acessa dados de Empresa B (contatos, conversas, arquivos, relatórios, WebSocket, filas) mesmo manipulando IDs diretamente na URL/payload.
2. **Autorização**: usuário sem permissão não executa a ação (tentativa retorna 403, não apenas esconde botão na UI).
3. **Desativação não quebra dependentes indevidamente**: desativar Automação não quebra CRM (CRM continua 100% operável manualmente).
4. **Desativação não quebra dependentes indevidamente**: desativar CRM não quebra WhatsApp (conversas continuam funcionando sem criação de lead).
5. **Reativação restaura**: reativar um módulo restaura o acesso aos dados e configurações preservados, sem perda.
6. **Idempotência de webhook**: webhook duplicado (reentrega do provedor) não cria mensagens duplicadas.
7. **Deduplicação de lead**: lead duplicado (mesmo WhatsApp/telefone/e-mail/CPF/CNPJ, conforme regra ativa) é tratado corretamente — vinculado ao cadastro existente, não duplicado.
8. **Idempotência de automação**: uma automação não executa duas vezes indevidamente para o mesmo gatilho/contato.
9. **Cancelamento de follow-up**: follow-up é cancelado automaticamente após resposta do cliente, encerramento do atendimento, venda concluída, oportunidade perdida ou cancelamento manual.
10. **Aceite de risco obrigatório**: automações/envios em número WhatsApp na modalidade não oficial são bloqueados até o aceite de risco (`RiskAcceptance`) existir para aquele número.

## 3. Casos de teste adicionais por área (complementares aos 10 críticos)

- **Multiempresa**: criação de recurso sem `tenantId` explícito no payload do cliente não é aceita nem inferida incorretamente.
- **Chatbot / Flow Builder**: fluxo com loop de retorno respeita limite de repetições e não trava em loop infinito; fluxo não publicável se inválido (nós órfãos, ciclo sem saída).
- **Automação**: falha em uma ação aciona retry conforme configurado e, ao esgotar tentativas, vai para dead-letter com alerta, sem travar a fila.
- **WhatsApp**: falha de envio é registrada com status `failed` e motivo, sem re-tentativa silenciosa indefinida.
- **CRM**: alteração de etapa do funil respeita campos obrigatórios da etapa antes de permitir a movimentação, quando configurado.
- **Auditoria**: toda ação da lista obrigatória (`SECURITY.md` §6) gera exatamente um registro de `AuditLog` coerente (sem duplicar, sem omitir).
- **Painel Master / impersonação**: ações feitas durante acesso assistido são registradas com `onBehalfOfTenantId` e nível de acesso (leitura/leitura+edição) é respeitado (edição bloqueada quando o nível é só leitura).

## 4. Cobertura mínima de testes por camada

- **Unitários**: regras de negócio isoladas (cálculo de comissão, validação de dedup, avaliação de condição de automação, motor de distribuição de fila).
- **Integração**: services + banco real (ou testcontainer) cobrindo os casos críticos da seção 2.
- **E2E**: fluxos completos de usuário (login → criar lead → mover funil; conectar WhatsApp → receber mensagem → criar conversa → responder; publicar fluxo de chatbot → executar → concluir).
- **Autorização**: matriz de permissões testada por amostragem representativa (não é preciso testar toda combinação, mas cada módulo × ação crítica precisa de ao menos um teste negativo e um positivo).
- **Multiempresa**: suíte dedicada, executada isoladamente, focada exclusivamente em tentativas de vazamento entre tenants (ver `SECURITY.md` §2 para a lista de camadas a cobrir).
