import type { RagAgentConfig, RagAgentResult } from "../types/rag-agent.types.js";

export interface IRagAgentOrchestrator {
  create(config: RagAgentConfig): Promise<RagAgentResult>;
}
