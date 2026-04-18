import type { IBedrockClient } from "../interfaces/bedrock.interface.js";
import type { IOpenSearchClient } from "../interfaces/opensearch.interface.js";
import type { IRagAgentOrchestrator } from "../interfaces/rag-agent.interface.js";
import type { RagAgentConfig, RagAgentResult } from "../types/rag-agent.types.js";

export class RagAgentOrchestrator implements IRagAgentOrchestrator {
  constructor(
    private readonly bedrock: IBedrockClient,
    private readonly openSearch: IOpenSearchClient,
  ) {}

  async create(config: RagAgentConfig): Promise<RagAgentResult> {
    const indexName = this.buildIndexName(config.agentName);

    await this.ensureVectorIndex(indexName, config);

    const kb = await this.bedrock.createKnowledgeBase({
      name: `${config.agentName}-kb`,
      ...(config.kbDescription !== undefined && { description: config.kbDescription }),
      roleArn: config.kbRoleArn,
      knowledgeBaseConfiguration: {
        type: "VECTOR",
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: config.embeddingModelArn,
        },
      },
      storageConfiguration: {
        type: "OPENSEARCH_SERVERLESS",
        opensearchServerlessConfiguration: {
          collectionArn: config.collectionArn,
          vectorIndexName: indexName,
          fieldMapping: {
            vectorField: config.vectorFieldName ?? "embedding",
            textField: config.textFieldName ?? "text",
            metadataField: config.metadataFieldName ?? "metadata",
          },
        },
      },
    });

    const kbId = kb.knowledgeBaseId!;

    const ds = await this.bedrock.createDataSource(kbId, {
      name: `${config.agentName}-s3-source`,
      ...(config.dataSourceDescription !== undefined && { description: config.dataSourceDescription }),
      dataSourceConfiguration: {
        type: "S3",
        s3Configuration: { bucketArn: config.s3BucketArn },
      },
      vectorIngestionConfiguration: {
        chunkingConfiguration: {
          chunkingStrategy: "FIXED_SIZE",
          fixedSizeChunkingConfiguration: {
            maxTokens: config.chunkingConfig?.maxTokens ?? 512,
            overlapPercentage: config.chunkingConfig?.overlapPercentage ?? 20,
          },
        },
      },
    });

    const dsId = ds.dataSourceId!;

    const result: RagAgentResult = {
      agentId: "",
      agentAliasId: "",
      knowledgeBaseId: kbId,
      dataSourceId: dsId,
      indexName,
    };

    if (config.startIngestion !== false) {
      result.ingestionJobId = await this.bedrock.startIngestionJob(kbId, dsId);
    }

    const agent = await this.bedrock.createAgent({
      agentName: config.agentName,
      foundationModel: config.foundationModel,
      instruction: config.instruction,
      ...(config.agentDescription !== undefined && { description: config.agentDescription }),
      agentResourceRoleArn: config.agentResourceRoleArn,
      ...(config.idleSessionTTLInSeconds !== undefined && {
        idleSessionTTLInSeconds: config.idleSessionTTLInSeconds,
      }),
    });

    const agentId = agent.agentId!;
    const kbDescription = config.kbDescription ?? `Knowledge base para ${config.agentName}`;

    await this.bedrock.associateAgentKnowledgeBase(agentId, "DRAFT", kbId, kbDescription);
    await this.bedrock.prepareAgent(agentId);

    const alias = await this.bedrock.createAgentAlias(agentId, {
      aliasName: config.aliasName ?? "producao",
      routingConfiguration: [{ agentVersion: "1" }],
    });

    result.agentId = agentId;
    result.agentAliasId = alias.agentAliasId!;

    return result;
  }

  private async ensureVectorIndex(indexName: string, config: RagAgentConfig): Promise<void> {
    const exists = await this.openSearch.indexExists(indexName);
    if (exists) return;

    const vectorField = config.vectorFieldName ?? "embedding";
    const textField = config.textFieldName ?? "text";
    const metadataField = config.metadataFieldName ?? "metadata";

    await this.openSearch.createIndex(indexName, {
      settings: { numberOfShards: 1, numberOfReplicas: 0 },
      mappings: {
        properties: {
          [textField]: { type: "text" },
          [metadataField]: { type: "object" },
          [vectorField]: {
            type: "dense_vector",
            dims: config.embeddingDimensions ?? 1536,
          },
        },
      },
    });
  }

  private buildIndexName(agentName: string): string {
    return agentName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }
}
