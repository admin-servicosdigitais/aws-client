import { describe, expect, it, vi, beforeEach } from "vitest";
import { RagAgentOrchestrator } from "../src/orchestration/rag-agent.orchestrator.js";
import type { IBedrockClient } from "../src/interfaces/bedrock.interface.js";
import type { IOpenSearchClient } from "../src/interfaces/opensearch.interface.js";
import type { RagAgentConfig } from "../src/types/rag-agent.types.js";

function createBaseConfig(overrides: Partial<RagAgentConfig> = {}): RagAgentConfig {
  return {
    agentName: "Assistente Suporte #1",
    foundationModel: "anthropic.claude-sonnet-4-6",
    instruction: "Responda com base nos documentos.",
    agentResourceRoleArn: "arn:aws:iam::123456789012:role/BedrockAgentRole",
    kbRoleArn: "arn:aws:iam::123456789012:role/BedrockKnowledgeBaseRole",
    collectionArn: "arn:aws:aoss:us-east-1:123456789012:collection/abc123",
    s3BucketArn: "arn:aws:s3:::meus-documentos-rag",
    embeddingModelArn: "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1",
    ...overrides,
  };
}

function createBedrockMock(): IBedrockClient {
  return {
    createAgent: vi.fn().mockResolvedValue({ agentId: "agent-1" }),
    getAgent: vi.fn(),
    updateAgent: vi.fn(),
    deleteAgent: vi.fn(),
    prepareAgent: vi.fn().mockResolvedValue(undefined),
    createAgentAlias: vi.fn().mockResolvedValue({ agentAliasId: "alias-1" }),
    getAgentAlias: vi.fn(),
    deleteAgentAlias: vi.fn(),
    createKnowledgeBase: vi.fn().mockResolvedValue({ knowledgeBaseId: "kb-1" }),
    getKnowledgeBase: vi.fn(),
    deleteKnowledgeBase: vi.fn(),
    associateAgentKnowledgeBase: vi.fn().mockResolvedValue(undefined),
    listAgentKnowledgeBases: vi.fn(),
    createDataSource: vi.fn().mockResolvedValue({ dataSourceId: "ds-1" }),
    getDataSource: vi.fn(),
    deleteDataSource: vi.fn(),
    startIngestionJob: vi.fn().mockResolvedValue("ingest-1"),
    invokeAgent: vi.fn(),
    retrieve: vi.fn(),
  } as unknown as IBedrockClient;
}

function createOpenSearchMock(indexExists = false): IOpenSearchClient {
  return {
    createIndex: vi.fn().mockResolvedValue(undefined),
    deleteIndex: vi.fn(),
    indexExists: vi.fn().mockResolvedValue(indexExists),
    getIndexInfo: vi.fn(),
    putMapping: vi.fn(),
    search: vi.fn(),
    count: vi.fn(),
  } as unknown as IOpenSearchClient;
}

describe("RagAgentOrchestrator", () => {
  let bedrock: IBedrockClient;
  let openSearch: IOpenSearchClient;

  beforeEach(() => {
    bedrock = createBedrockMock();
    openSearch = createOpenSearchMock(false);
  });

  it("executa fluxo completo quando índice não existe", async () => {
    const orchestrator = new RagAgentOrchestrator(bedrock, openSearch);

    const result = await orchestrator.create(createBaseConfig());

    expect(result).toEqual({
      agentId: "agent-1",
      agentAliasId: "alias-1",
      knowledgeBaseId: "kb-1",
      dataSourceId: "ds-1",
      indexName: "assistente-suporte-1",
      ingestionJobId: "ingest-1",
    });

    expect(openSearch.indexExists).toHaveBeenCalledWith("assistente-suporte-1");
    expect(openSearch.createIndex).toHaveBeenCalledTimes(1);
    expect(bedrock.startIngestionJob).toHaveBeenCalledWith("kb-1", "ds-1");

    const callOrder = [
      (openSearch.indexExists as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
      (openSearch.createIndex as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
      (bedrock.createKnowledgeBase as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
      (bedrock.createDataSource as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
      (bedrock.startIngestionJob as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
      (bedrock.createAgent as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
      (bedrock.associateAgentKnowledgeBase as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
      (bedrock.prepareAgent as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
      (bedrock.createAgentAlias as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    ];

    expect(callOrder).toEqual([...callOrder].sort((a, b) => a - b));
  });

  it("não recria índice quando já existe", async () => {
    openSearch = createOpenSearchMock(true);
    const orchestrator = new RagAgentOrchestrator(bedrock, openSearch);

    await orchestrator.create(createBaseConfig());

    expect(openSearch.indexExists).toHaveBeenCalledWith("assistente-suporte-1");
    expect(openSearch.createIndex).not.toHaveBeenCalled();
  });

  it("não inicia ingestão quando startIngestion=false", async () => {
    const orchestrator = new RagAgentOrchestrator(bedrock, openSearch);

    const result = await orchestrator.create(createBaseConfig({ startIngestion: false }));

    expect(bedrock.startIngestionJob).not.toHaveBeenCalled();
    expect(result.ingestionJobId).toBeUndefined();
  });

  it("propaga erro em etapa intermediária e interrompe fluxo", async () => {
    (bedrock.prepareAgent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("prepare failed"));
    const orchestrator = new RagAgentOrchestrator(bedrock, openSearch);

    await expect(orchestrator.create(createBaseConfig())).rejects.toThrow("prepare failed");
    expect(bedrock.createAgentAlias).not.toHaveBeenCalled();
  });

  it("envia payload esperado para OpenSearch e Bedrock com defaults documentados", async () => {
    const orchestrator = new RagAgentOrchestrator(bedrock, openSearch);

    await orchestrator.create(createBaseConfig());

    expect(openSearch.createIndex).toHaveBeenCalledWith("assistente-suporte-1", {
      settings: { numberOfShards: 1, numberOfReplicas: 0 },
      mappings: {
        properties: {
          text: { type: "text" },
          metadata: { type: "object" },
          embedding: { type: "dense_vector", dims: 1536 },
        },
      },
    });

    expect(bedrock.createKnowledgeBase).toHaveBeenCalledWith({
      name: "Assistente Suporte #1-kb",
      roleArn: "arn:aws:iam::123456789012:role/BedrockKnowledgeBaseRole",
      knowledgeBaseConfiguration: {
        type: "VECTOR",
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1",
        },
      },
      storageConfiguration: {
        type: "OPENSEARCH_SERVERLESS",
        opensearchServerlessConfiguration: {
          collectionArn: "arn:aws:aoss:us-east-1:123456789012:collection/abc123",
          vectorIndexName: "assistente-suporte-1",
          fieldMapping: {
            vectorField: "embedding",
            textField: "text",
            metadataField: "metadata",
          },
        },
      },
    });

    expect(bedrock.createDataSource).toHaveBeenCalledWith("kb-1", {
      name: "Assistente Suporte #1-s3-source",
      dataSourceConfiguration: {
        type: "S3",
        s3Configuration: { bucketArn: "arn:aws:s3:::meus-documentos-rag" },
      },
      vectorIngestionConfiguration: {
        chunkingConfiguration: {
          chunkingStrategy: "FIXED_SIZE",
          fixedSizeChunkingConfiguration: {
            maxTokens: 512,
            overlapPercentage: 20,
          },
        },
      },
    });

    expect(bedrock.createAgentAlias).toHaveBeenCalledWith("agent-1", {
      aliasName: "producao",
      routingConfiguration: [{ agentVersion: "1" }],
    });
  });

  it("buildIndexName é determinístico para mesmo agentName", async () => {
    const orchestrator = new RagAgentOrchestrator(bedrock, openSearch);

    await orchestrator.create(createBaseConfig({ agentName: "Meu Agent -- 2026!!" }));
    await orchestrator.create(createBaseConfig({ agentName: "Meu Agent -- 2026!!" }));

    expect(openSearch.indexExists).toHaveBeenNthCalledWith(1, "meu-agent-2026");
    expect(openSearch.indexExists).toHaveBeenNthCalledWith(2, "meu-agent-2026");
  });
});
