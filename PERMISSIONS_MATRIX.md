# PERMISSIONS_MATRIX.md

Modelo RBAC (Role-Based Access Control). Autorização é sempre verificada no backend; o frontend apenas reflete o que a API expõe.

## 1. Dois planos de acesso separados

- **Painel Master** — `MasterUser`, papéis internos da plataforma. Nunca compartilha sessão/token com `TenantUser`.
- **Painel da Empresa** — `TenantUser`, papéis definidos por tenant (papéis padrão do sistema + papéis customizados por tenant, ver `Role.tenantId` em `DATABASE_DESIGN.md`).

## 2. Papéis padrão do Painel Master

| Papel | Descrição |
|---|---|
| super_admin | Acesso total: empresas, planos, financeiro, afiliados, usuários Master, configurações, impersonação |
| financeiro | Planos, assinaturas, cobrança, afiliados/comissões — sem acesso a impersonação |
| suporte | Visualização de empresas, acesso assistido (impersonação) somente leitura, sem alteração de plano/financeiro |

## 3. Papéis padrão sugeridos do Painel da Empresa

| Papel | Descrição |
|---|---|
| admin (dono da empresa) | Acesso total aos módulos ativos e a Configurações |
| gestor | Acesso operacional total exceto Configurações sensíveis (usuários, plano, segurança) |
| atendente | Acesso a Atendimento e ações do CRM relacionadas aos seus contatos/filas |

Tenants podem criar papéis customizados combinando as permissões da matriz de ações abaixo.

## 4. Ações por módulo (RBAC)

Ações padronizadas: `view`, `create`, `edit`, `delete`, `send`, `transfer`, `publish`, `approve`, `export`, `administer`.

| Módulo | view | create | edit | delete | send | transfer | publish | approve | export | administer |
|---|---|---|---|---|---|---|---|---|---|---|
| Início | ✓ | – | – | – | – | – | – | – | – | – |
| Atendimento | ✓ | ✓ (nova conversa manual) | ✓ (anotações, tags) | – | ✓ | ✓ | – | – | ✓ | ✓ (filas, horários, distribuição) |
| CRM | ✓ | ✓ | ✓ | ✓ (soft delete) | ✓ (mensagem manual) | – | – | – | ✓ | ✓ (funis, dedup, campos) |
| Chatbot | ✓ | ✓ | ✓ | ✓ | – | – | ✓ | – | – | ✓ (base de conhecimento, IA) |
| Automação | ✓ | ✓ | ✓ | ✓ | – | – | ✓ (ativar) | – | – | ✓ |
| WhatsApp | ✓ | ✓ (conectar número) | ✓ | ✓ (desconectar) | ✓ | – | ✓ (templates) | ✓ (templates internos antes de enviar à Meta) | – | ✓ |
| Relatórios | ✓ | – | – | – | – | – | – | – | ✓ | – |
| Configurações | ✓ | ✓ (usuários) | ✓ | ✓ | – | – | – | – | – | ✓ (plano, domínio, segurança) |

Legenda: "✓" = ação existe e é atribuível; "–" = ação não se aplica ao módulo.

## 5. Granularidade de escopo (`Permission.scope`)

Além de módulo+ação, uma permissão pode ser restrita por escopo, conforme seção 16.3 do prompt mestre:

- **número** (WhatsApp) — ex.: atendente só vê/envia por números específicos.
- **fila** — ex.: atendente só atua nas filas atribuídas.
- **equipe** — ex.: supervisor só administra sua equipe.
- **departamento**.
- **campanha** — ex.: gestor de campanha só vê leads daquela campanha.
- **fluxo** (Chatbot) — ex.: editor só edita fluxos específicos.
- **carteira** (CRM) — ex.: vendedor só vê contatos da própria carteira.
- **unidade** — para empresas com múltiplas unidades/filiais.

Quando `Permission.scope` é nulo, a permissão vale para todos os registros do módulo dentro do tenant. Quando preenchido, o filtro de escopo é aplicado **depois** do filtro de `tenantId` (nunca substitui o isolamento multi-tenant).

## 6. Regras de aplicação

1. Toda rota de API declara o par `(module, action)` mínimo exigido via decorator/guard (`@RequirePermission('crm', 'edit')`).
2. O guard resolve as `Permission`s do `Role` do `TenantUser` autenticado, filtra por `tenantId` do contexto, e valida escopo quando o recurso acessado tiver escopo aplicável (ex.: editar `Opportunity` de uma `carteira` que não é do usuário → 403).
3. Ações administrativas de módulo (`administer`) são pré-requisito para acessar a tela de Configurações daquele módulo.
4. Nenhuma permissão do Painel Master concede acesso automático ao Painel da Empresa e vice-versa — impersonação (`acesso assistido`, seção 19.1) é o único mecanismo formal de ponte, sempre auditado.
5. Alterações em `Role`/`Permission` de um tenant são elas mesmas auditadas (`AuditLog`, entity `Role`/`Permission`).

## 7. Acesso assistido (impersonação) — Painel Master

Níveis, conforme seção 19.1 do prompt mestre:
- Nenhum acesso.
- Leitura.
- Leitura e edição.

Configurável por empresa e por módulo. Toda ação executada durante impersonação é registrada em `AuditLog` com `actorType: master`, `actorId` do `MasterUser`, e um campo adicional `onBehalfOfTenantId`.
