import type {
  Agent,
  AgentAlias,
  AgentInvocationResult,
  CreateAgentAliasInput,
  CreateAgentInput,
  CreateDataSourceInput,
  CreateKnowledgeBaseInput,
  DataSource,
  InvokeAgentInput,
  KnowledgeBase,
  RetrievalResult,
  RetrieveInput,
  StartIngestionJobInput,
  UpdateAgentInput,
} from "../types/bedrock.types.js";
import type { PaginatedResult } from "../types/common.types.js";

export interface IBedrockClient {
  // --- Agentes ---
  createAgent(input: CreateAgentInput): Promise<Agent>;
  getAgent(agentId: string): Promise<Agent>;
  updateAgent(agentId: string, input: UpdateAgentInput): Promise<Agent>;
  deleteAgent(agentId: string): Promise<void>;
  prepareAgent(agentId: string): Promise<void>;

  // --- Aliases ---
  createAgentAlias(agentId: string, input: CreateAgentAliasInput): Promise<AgentAlias>;
  getAgentAlias(agentId: string, aliasId: string): Promise<AgentAlias>;
  deleteAgentAlias(agentId: string, aliasId: string): Promise<void>;

  // --- Knowledge Bases ---
  createKnowledgeBase(input: CreateKnowledgeBaseInput): Promise<KnowledgeBase>;
  getKnowledgeBase(knowledgeBaseId: string): Promise<KnowledgeBase>;
  deleteKnowledgeBase(knowledgeBaseId: string): Promise<void>;
  associateAgentKnowledgeBase(
    agentId: string,
    agentVersion: string,
    knowledgeBaseId: string,
    description: string
  ): Promise<void>;
  listAgentKnowledgeBases(agentId: string, agentVersion: string): Promise<PaginatedResult<KnowledgeBase>>;

  // --- Data Sources ---
  createDataSource(knowledgeBaseId: string, input: CreateDataSourceInput): Promise<DataSource>;
  getDataSource(knowledgeBaseId: string, dataSourceId: string): Promise<DataSource>;
  deleteDataSource(knowledgeBaseId: string, dataSourceId: string): Promise<void>;
  startIngestionJob(
    knowledgeBaseId: string,
    dataSourceId: string,
    input?: StartIngestionJobInput
  ): Promise<string>;

  // --- Runtime ---
  invokeAgent(agentId: string, agentAliasId: string, input: InvokeAgentInput): Promise<AgentInvocationResult>;
  retrieve(knowledgeBaseId: string, input: RetrieveInput): Promise<RetrievalResult>;
}
