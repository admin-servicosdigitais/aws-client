import {
  AssociateAgentKnowledgeBaseCommand,
  CreateAgentAliasCommand,
  CreateAgentCommand,
  CreateDataSourceCommand,
  CreateKnowledgeBaseCommand,
  DeleteAgentAliasCommand,
  DeleteAgentCommand,
  DeleteDataSourceCommand,
  DeleteKnowledgeBaseCommand,
  GetAgentAliasCommand,
  GetAgentCommand,
  GetDataSourceCommand,
  GetKnowledgeBaseCommand,
  ListAgentKnowledgeBasesCommand,
  PrepareAgentCommand,
  StartIngestionJobCommand,
  UpdateAgentCommand,
  type Agent,
  type AgentAlias,
  type BedrockAgentClient as BedrockAgentSDKClient,
  type DataSource,
  type KnowledgeBase,
} from "@aws-sdk/client-bedrock-agent";
import {
  InvokeAgentCommand,
  RetrieveCommand,
  type BedrockAgentRuntimeClient as BedrockRuntimeSDKClient,
} from "@aws-sdk/client-bedrock-agent-runtime";
import type { IBedrockClient } from "../interfaces/bedrock.interface.js";
import type {
  AgentCitation,
  AgentInvocationResult,
  CreateAgentAliasInput,
  CreateAgentInput,
  CreateDataSourceInput,
  CreateKnowledgeBaseInput,
  InvokeAgentInput,
  RetrievalResult,
  RetrievalResultItem,
  RetrieveInput,
  StartIngestionJobInput,
  UpdateAgentInput,
} from "../types/bedrock.types.js";
import type { PaginatedResult } from "../types/common.types.js";
import { AwsClientError } from "../errors/aws-client.error.js";
import { toAwsClientError } from "../internal/utils/error.util.js";

export class BedrockClientImpl implements IBedrockClient {
  constructor(
    private readonly agentSdk: BedrockAgentSDKClient,
    private readonly runtimeSdk: BedrockRuntimeSDKClient,
  ) {}

  createAgent(input: CreateAgentInput): Promise<Agent> {
    return this.executeWithErrorMapping("BedrockClientImpl.createAgent", async () => {
      const output = await this.agentSdk.send(new CreateAgentCommand(input));

      if (!output.agent) {
        throw new AwsClientError("BedrockClientImpl.createAgent: AWS Bedrock returned empty agent", output);
      }

      return output.agent;
    });
  }

  getAgent(agentId: string): Promise<Agent> {
    return this.executeWithErrorMapping("BedrockClientImpl.getAgent", async () => {
      const output = await this.agentSdk.send(new GetAgentCommand({ agentId }));

      if (!output.agent) {
        throw new AwsClientError("BedrockClientImpl.getAgent: AWS Bedrock returned empty agent", output);
      }

      return output.agent;
    });
  }

  updateAgent(agentId: string, input: UpdateAgentInput): Promise<Agent> {
    return this.executeWithErrorMapping("BedrockClientImpl.updateAgent", async () => {
      const currentAgent = await this.getAgent(agentId);

      const output = await this.agentSdk.send(new UpdateAgentCommand({
        agentId,
        agentName: input.agentName ?? currentAgent.agentName,
        foundationModel: input.foundationModel ?? currentAgent.foundationModel,
        instruction: input.instruction ?? currentAgent.instruction,
        description: input.description ?? currentAgent.description,
        idleSessionTTLInSeconds: input.idleSessionTTLInSeconds ?? currentAgent.idleSessionTTLInSeconds,
        agentResourceRoleArn: currentAgent.agentResourceRoleArn,
      }));

      if (!output.agent) {
        throw new AwsClientError("BedrockClientImpl.updateAgent: AWS Bedrock returned empty agent", output);
      }

      return output.agent;
    });
  }

  deleteAgent(agentId: string): Promise<void> {
    return this.executeWithErrorMapping("BedrockClientImpl.deleteAgent", async () => {
      await this.agentSdk.send(new DeleteAgentCommand({ agentId }));
    });
  }

  prepareAgent(agentId: string): Promise<void> {
    return this.executeWithErrorMapping("BedrockClientImpl.prepareAgent", async () => {
      await this.agentSdk.send(new PrepareAgentCommand({ agentId }));
    });
  }

  createAgentAlias(agentId: string, input: CreateAgentAliasInput): Promise<AgentAlias> {
    return this.executeWithErrorMapping("BedrockClientImpl.createAgentAlias", async () => {
      const output = await this.agentSdk.send(new CreateAgentAliasCommand({
        agentId,
        agentAliasName: input.aliasName,
        description: input.description,
        routingConfiguration: input.routingConfiguration?.map((item) => ({ agentVersion: item.agentVersion })),
      }));

      if (!output.agentAlias) {
        throw new AwsClientError("BedrockClientImpl.createAgentAlias: AWS Bedrock returned empty agentAlias", output);
      }

      return output.agentAlias;
    });
  }

  getAgentAlias(agentId: string, aliasId: string): Promise<AgentAlias> {
    return this.executeWithErrorMapping("BedrockClientImpl.getAgentAlias", async () => {
      const output = await this.agentSdk.send(new GetAgentAliasCommand({
        agentId,
        agentAliasId: aliasId,
      }));

      if (!output.agentAlias) {
        throw new AwsClientError("BedrockClientImpl.getAgentAlias: AWS Bedrock returned empty agentAlias", output);
      }

      return output.agentAlias;
    });
  }

  deleteAgentAlias(agentId: string, aliasId: string): Promise<void> {
    return this.executeWithErrorMapping("BedrockClientImpl.deleteAgentAlias", async () => {
      await this.agentSdk.send(new DeleteAgentAliasCommand({
        agentId,
        agentAliasId: aliasId,
      }));
    });
  }

  createKnowledgeBase(input: CreateKnowledgeBaseInput): Promise<KnowledgeBase> {
    return this.executeWithErrorMapping("BedrockClientImpl.createKnowledgeBase", async () => {
      const output = await this.agentSdk.send(new CreateKnowledgeBaseCommand(input));

      if (!output.knowledgeBase) {
        throw new AwsClientError("BedrockClientImpl.createKnowledgeBase: AWS Bedrock returned empty knowledgeBase", output);
      }

      return output.knowledgeBase;
    });
  }

  getKnowledgeBase(knowledgeBaseId: string): Promise<KnowledgeBase> {
    return this.executeWithErrorMapping("BedrockClientImpl.getKnowledgeBase", async () => {
      const output = await this.agentSdk.send(new GetKnowledgeBaseCommand({ knowledgeBaseId }));

      if (!output.knowledgeBase) {
        throw new AwsClientError("BedrockClientImpl.getKnowledgeBase: AWS Bedrock returned empty knowledgeBase", output);
      }

      return output.knowledgeBase;
    });
  }

  deleteKnowledgeBase(knowledgeBaseId: string): Promise<void> {
    return this.executeWithErrorMapping("BedrockClientImpl.deleteKnowledgeBase", async () => {
      await this.agentSdk.send(new DeleteKnowledgeBaseCommand({ knowledgeBaseId }));
    });
  }

  associateAgentKnowledgeBase(
    agentId: string,
    agentVersion: string,
    knowledgeBaseId: string,
    description: string,
  ): Promise<void> {
    return this.executeWithErrorMapping("BedrockClientImpl.associateAgentKnowledgeBase", async () => {
      await this.agentSdk.send(new AssociateAgentKnowledgeBaseCommand({
        agentId,
        agentVersion,
        knowledgeBaseId,
        description,
        knowledgeBaseState: "ENABLED",
      }));
    });
  }

  listAgentKnowledgeBases(agentId: string, agentVersion: string): Promise<PaginatedResult<KnowledgeBase>> {
    return this.executeWithErrorMapping("BedrockClientImpl.listAgentKnowledgeBases", async () => {
      const output = await this.agentSdk.send(new ListAgentKnowledgeBasesCommand({ agentId, agentVersion }));

      const items = (output.agentKnowledgeBaseSummaries ?? []).map((summary) => ({
        knowledgeBaseId: summary.knowledgeBaseId,
        description: summary.description,
        updatedAt: summary.updatedAt,
      } as KnowledgeBase));

      return {
        items,
        count: items.length,
        ...(output.nextToken !== undefined && { nextToken: output.nextToken }),
      };
    });
  }

  createDataSource(knowledgeBaseId: string, input: CreateDataSourceInput): Promise<DataSource> {
    return this.executeWithErrorMapping("BedrockClientImpl.createDataSource", async () => {
      const output = await this.agentSdk.send(new CreateDataSourceCommand({
        knowledgeBaseId,
        ...input,
      }));

      if (!output.dataSource) {
        throw new AwsClientError("BedrockClientImpl.createDataSource: AWS Bedrock returned empty dataSource", output);
      }

      return output.dataSource;
    });
  }

  getDataSource(knowledgeBaseId: string, dataSourceId: string): Promise<DataSource> {
    return this.executeWithErrorMapping("BedrockClientImpl.getDataSource", async () => {
      const output = await this.agentSdk.send(new GetDataSourceCommand({ knowledgeBaseId, dataSourceId }));

      if (!output.dataSource) {
        throw new AwsClientError("BedrockClientImpl.getDataSource: AWS Bedrock returned empty dataSource", output);
      }

      return output.dataSource;
    });
  }

  deleteDataSource(knowledgeBaseId: string, dataSourceId: string): Promise<void> {
    return this.executeWithErrorMapping("BedrockClientImpl.deleteDataSource", async () => {
      await this.agentSdk.send(new DeleteDataSourceCommand({ knowledgeBaseId, dataSourceId }));
    });
  }

  startIngestionJob(
    knowledgeBaseId: string,
    dataSourceId: string,
    input?: StartIngestionJobInput,
  ): Promise<string> {
    return this.executeWithErrorMapping("BedrockClientImpl.startIngestionJob", async () => {
      const output = await this.agentSdk.send(new StartIngestionJobCommand({
        knowledgeBaseId,
        dataSourceId,
        description: input?.description,
        clientToken: input?.clientToken,
      }));

      const ingestionJobId = output.ingestionJob?.ingestionJobId;
      if (!ingestionJobId) {
        throw new AwsClientError("BedrockClientImpl.startIngestionJob: AWS Bedrock returned empty ingestionJobId", output);
      }

      return ingestionJobId;
    });
  }

  invokeAgent(agentId: string, agentAliasId: string, input: InvokeAgentInput): Promise<AgentInvocationResult> {
    return this.executeWithErrorMapping("BedrockClientImpl.invokeAgent", async () => {
      const output = await this.runtimeSdk.send(new InvokeAgentCommand({
        agentId,
        agentAliasId,
        inputText: input.inputText,
        sessionId: input.sessionId,
        enableTrace: input.enableTrace,
        endSession: input.endSession,
        sessionState: input.sessionState,
      }));

      const completionChunks: string[] = [];
      const citations: AgentCitation[] = [];
      const traces: unknown[] = [];

      for await (const event of output.completion ?? []) {
        if ("chunk" in event && event.chunk) {
          const text = this.decodeBytes(event.chunk.bytes);
          if (text.length > 0) {
            completionChunks.push(text);
          }

          const eventCitations = event.chunk.attribution?.citations;
          if (eventCitations && eventCitations.length > 0) {
            citations.push(...eventCitations.map((citation) => ({
              retrievedReferences: (citation.retrievedReferences ?? []).map((reference) => ({
                content: { text: reference.content?.text ?? "" },
                location: {
                  ...(reference.location?.s3Location?.uri !== undefined && {
                    s3Location: { uri: reference.location.s3Location.uri },
                  }),
                },
              })),
            })));
          }
        }

        if (input.enableTrace && "trace" in event && event.trace) {
          traces.push(event.trace);
        }
      }

      return {
        sessionId: output.sessionId ?? input.sessionId,
        completion: completionChunks.join(""),
        ...(citations.length > 0 && { citations }),
        ...(traces.length > 0 && { traces }),
      };
    });
  }

  retrieve(knowledgeBaseId: string, input: RetrieveInput): Promise<RetrievalResult> {
    return this.executeWithErrorMapping("BedrockClientImpl.retrieve", async () => {
      const output = await this.runtimeSdk.send(new RetrieveCommand({
        knowledgeBaseId,
        retrievalQuery: input.retrievalQuery,
        retrievalConfiguration: input.retrievalConfiguration,
        nextToken: input.nextToken,
      }));

      const retrievalResults: RetrievalResultItem[] = (output.retrievalResults ?? []).map((item) => ({
        content: { text: item.content?.text ?? "" },
        location: {
          ...(item.location?.s3Location?.uri !== undefined && { s3Location: { uri: item.location.s3Location.uri } }),
        },
        score: item.score ?? 0,
        ...(item.metadata !== undefined && { metadata: item.metadata as Record<string, unknown> }),
      }));

      return {
        retrievalResults,
        ...(output.nextToken !== undefined && { nextToken: output.nextToken }),
      };
    });
  }

  private decodeBytes(bytes: Uint8Array | undefined): string {
    if (!bytes || bytes.byteLength === 0) {
      return "";
    }

    return new TextDecoder().decode(bytes);
  }

  private async executeWithErrorMapping<T>(context: string, executor: () => Promise<T>): Promise<T> {
    try {
      return await executor();
    } catch (error) {
      throw toAwsClientError(error, `${context} failed`);
    }
  }
}
