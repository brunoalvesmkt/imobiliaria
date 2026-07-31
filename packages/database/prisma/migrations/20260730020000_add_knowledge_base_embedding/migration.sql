-- Busca semântica na Base de Conhecimento (Fase 25, ver DEVELOPMENT_PLAN.md).
-- Vetor de embedding cacheado por item — calculado sob demanda na primeira
-- busca (ver ChatbotEngineService.searchKnowledgeBase), não em lote aqui.
ALTER TABLE "knowledge_base_items" ADD COLUMN "embedding" JSONB;
