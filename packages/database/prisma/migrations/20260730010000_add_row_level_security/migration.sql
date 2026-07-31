-- Row-Level Security (Fase 19 do débito técnico consciente, ver DEVELOPMENT_PLAN.md).
--
-- Contexto: a aplicação conecta ao Postgres como o papel "postgres" (dono
-- das tabelas / superusuário) — Postgres NUNCA aplica RLS ao dono de uma
-- tabela nem a superusuários, por design, então simplesmente habilitar RLS
-- não teria efeito algum na conexão atual da aplicação. Esta migration cria
-- um segundo papel, sem privilégios de dono/superusuário, que fica sujeito
-- às políticas — a aplicação PRECISA se conectar com esse papel para a
-- proteção valer (ver nota "próximo passo consciente" no fim do arquivo).
--
-- Política: cada linha só é visível/gravável se
--   (a) "tenantId" for NULL (linhas de sistema, sem tenant — ex.: papéis
--       padrão, logs de e-mail do próprio Master), ou
--   (b) "tenantId" bater com a variável de sessão `app.tenant_id` (fluxo
--       normal de uma requisição de tenant autenticado), ou
--   (c) a variável de sessão `app.role` for 'master' (fluxo do Painel
--       Master e de jobs de sistema/scheduler, que legitimamente operam
--       entre tenants — a autorização já é garantida na camada de
--       aplicação por MasterAuthGuard/MasterRolesGuard).

-- `CREATE ROLE` é cluster-wide (não por database) — sem a checagem abaixo,
-- reaplicar esta migration num shadow database novo (ex.: `prisma migrate
-- dev` calculando o diff de uma migration seguinte) falha com "role already
-- exists", porque o papel sobrevive à criação/descarte do banco temporário.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime LOGIN PASSWORD 'vgBGEheekRh9v57O6ayAGZC4C7me47M' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;

ALTER TABLE "affiliate_referrals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "affiliate_referrals" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_logs" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "automation_executions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "automation_executions" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "automations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "automations" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "business_hours" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "business_hours" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "chatbot_executions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "chatbot_executions" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "chatbot_flows" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "chatbot_flows" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "contacts" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "conversation_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "conversation_events" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "conversations" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "crm_tasks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "crm_tasks" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "deduplication_rules" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "deduplication_rules" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "email_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "email_logs" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "feature_flags" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "feature_flags" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "files" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "follow_up_schedules" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "follow_up_schedules" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "funnels" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "funnels" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "invoices" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "knowledge_base_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "knowledge_base_items" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "messages" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "opportunities" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "opportunities" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "queues" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "queues" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "refresh_tokens" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "risk_acceptances" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "risk_acceptances" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "roles" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "subscriptions" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "teams" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "tenant_ai_credentials" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_ai_credentials" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "tenant_users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_users" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "whatsapp_numbers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "whatsapp_numbers" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');
ALTER TABLE "whatsapp_templates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "whatsapp_templates" USING ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master') WITH CHECK ("tenantId" IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true) OR current_setting('app.role', true) = 'master');

-- Próximo passo consciente (não feito nesta migration, ver DEVELOPMENT_PLAN.md
-- Fase 19): trocar a conexão de runtime da aplicação (PrismaService) de
-- DATABASE_URL (papel "postgres", dono das tabelas) para uma URL usando o
-- papel "app_runtime" recém-criado, e envolver toda chamada Prisma em uma
-- transação que primeiro executa
--   SELECT set_config('app.tenant_id', '<tenantId>', true)
-- (contexto de tenant) ou
--   SELECT set_config('app.role', 'master', true)
-- (contexto Master/sistema) antes da query real — um refactor que toca
-- literalmente todo ponto de acesso ao banco no backend (dezenas de
-- serviços), por isso não foi feito junto com a criação das políticas:
-- fazer errado quebraria isolamento de dados silenciosamente, o oposto do
-- que esta migration existe para proteger contra. Esta migration deixa a
-- infraestrutura pronta e comprovada (ver
-- apps/api/src/test/row-level-security.spec.ts, que conecta diretamente
-- como app_runtime e prova o isolamento a nível de banco) sem alterar o
-- comportamento de runtime atual, que continua usando DATABASE_URL.
