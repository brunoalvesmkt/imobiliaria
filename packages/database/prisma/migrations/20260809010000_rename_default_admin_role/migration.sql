-- Migration de dados: renomeia o papel padrão do sistema de "admin" para
-- "Admin" em tenants já existentes — a migration anterior mudou só o valor
-- criado a partir de agora (auth.service.ts / master-tenants.service.ts),
-- deixando tenants criados antes deste deploy com o papel ainda chamado
-- "admin" (minúsculo). Como a busca do papel padrão do sistema é sempre
-- por nome exato (isSystem=true AND nome="Admin", ver getLoginUser/
-- impersonate em master-tenants.service.ts), esses tenants ficavam sem
-- conseguir usar Acesso Assistido, redefinição de senha administrativa
-- etc. — bug real encontrado em produção logo após este deploy.
UPDATE "roles" SET "nome" = 'Admin' WHERE "isSystem" = true AND "nome" = 'admin';
