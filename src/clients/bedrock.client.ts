import type { BedrockAgentClient as BedrockAgentSDKClient } from "@aws-sdk/client-bedrock-agent";
import type { BedrockAgentRuntimeClient as BedrockRuntimeSDKClient } from "@aws-sdk/client-bedrock-agent-runtime";
import type { IBedrockClient } from "../interfaces/bedrock.interface.js";
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
import { NotImplementedError } from "../errors/aws-client.error.js";

export class BedrockClientImpl implements IBedrockClient {
  constructor(
    private readonly agentSdk: BedrockAgentSDKClient,
    private readonly runtimeSdk: BedrockRuntimeSDKClient,
  ) {}

  createAgent(_input: CreateAgentInput): Promise<Agent> {
    throw new NotImplementedError("BedrockClientImpl.createAgent");
  }

  getAgent(_agentId: string): Promise<Agent> {
    throw new NotImplementedError("BedrockClientImpl.getAgent");
  }

  updateAgent(_agentId: string, _input: UpdateAgentInput): Promise<Agent> {
    throw new NotImplementedError("BedrockClientImpl.updateAgent");
  }

  deleteAgent(_agentId: string): Promise<void> {
    throw new NotImplementedError("BedrockClientImpl.deleteAgent");
  }

  prepareAgent(_agentId: string): Promise<void> {
    throw new NotImplementedError("BedrockClientImpl.prepareAgent");
  }

  createAgentAlias(_agentId: string, _input: CreateAgentAliasInput): Promise<AgentAlias> {
    throw new NotImplementedError("BedrockClientImpl.createAgentAlias");
  }

  getAgentAlias(_agentId: string, _aliasId: string): Promise<AgentAlias> {
    throw new NotImplementedError("BedrockClientImpl.getAgentAlias");
  }

  deleteAgentAlias(_agentId: string, _aliasId: string): Promise<void> {
    throw new NotImplementedError("BedrockClientImpl.deleteAgentAlias");
  }

  createKnowledgeBase(_input: CreateKnowledgeBaseInput): Promise<KnowledgeBase> {
    throw new NotImplementedError("BedrockClientImpl.createKnowledgeBase");
  }

  getKnowledgeBase(_knowledgeBaseId: string): Promise<KnowledgeBase> {
    throw new NotImplementedError("BedrockClientImpl.getKnowledgeBase");
  }

  deleteKnowledgeBase(_knowledgeBaseId: string): Promise<void> {
    throw new NotImplementedError("BedrockClientImpl.deleteKnowledgeBase");
  }

  associateAgentKnowledgeBase(
    _agentId: string,
    _agentVersion: string,
    _knowledgeBaseId: string,
    _description: string,
  ): Promise<void> {
    throw new NotImplementedError("BedrockClientImpl.associateAgentKnowledgeBase");
  }

  listAgentKnowledgeBases(_agentId: string, _agentVersion: string): Promise<PaginatedResult<KnowledgeBase>> {
    throw new NotImplementedError("BedrockClientImpl.listAgentKnowledgeBases");
  }

  createDataSource(_knowledgeBaseId: string, _input: CreateDataSourceInput): Promise<DataSource> {
    throw new NotImplementedError("BedrockClientImpl.createDataSource");
  }

  getDataSource(_knowledgeBaseId: string, _dataSourceId: string): Promise<DataSource> {
    throw new NotImplementedError("BedrockClientImpl.getDataSource");
  }

  deleteDataSource(_knowledgeBaseId: string, _dataSourceId: string): Promise<void> {
    throw new NotImplementedError("BedrockClientImpl.deleteDataSource");
  }

  startIngestionJob(
    _knowledgeBaseId: string,
    _dataSourceId: string,
    _input?: StartIngestionJobInput,
  ): Promise<string> {
    throw new NotImplementedError("BedrockClientImpl.startIngestionJob");
  }

  invokeAgent(_agentId: string, _agentAliasId: string, _input: InvokeAgentInput): Promise<AgentInvocationResult> {
    throw new NotImplementedError("BedrockClientImpl.invokeAgent");
  }

  retrieve(_knowledgeBaseId: string, _input: RetrieveInput): Promise<RetrievalResult> {
    throw new NotImplementedError("BedrockClientImpl.retrieve");
  }
}
