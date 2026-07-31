import { Prisma } from "@chatbot-saas/database";

/** True quando o erro é uma violação de constraint única (P2002) — usado para idempotência (ver ACCEPTANCE_CRITERIA.md, caso crítico #6). */
export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
