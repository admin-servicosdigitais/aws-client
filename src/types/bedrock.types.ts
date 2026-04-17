import type {
  Agent,
  AgentAlias,
  DataSource,
  KnowledgeBase,
} from "@aws-sdk/client-bedrock-agent";

export type { Agent, AgentAlias, DataSource, KnowledgeBase };

export interface CreateAgentInput {
  agentName: string;
  foundationModel: string;
  instruction: string;
  description?: string;
  idleSessionTTLInSeconds?: number;
  agentResourceRoleArn: string;
}

export interface UpdateAgentInput {
  agentName?: string;
  foundationModel?: string;
  instruction?: string;
  description?: string;
  idleSessionTTLInSeconds?: number;
}

export interface CreateAgentAliasInput {
  aliasName: string;
  description?: string;
  routingConfiguration?: Array<{ agentVersion: string }>;
}

export type StorageConfigurationType =
  | "OPENSEARCH_SERVERLESS"
  | "PINECONE"
  | "RDS"
  | "MONGO_DB_ATLAS";

export interface CreateKnowledgeBaseInput {
  name: string;
  description?: string;
  roleArn: string;
  knowledgeBaseConfiguration: {
    type: "VECTOR";
    vectorKnowledgeBaseConfiguration: {
      embeddingModelArn: string;
    };
  };
  storageConfiguration: {
    type: StorageConfigurationType;
    opensearchServerlessConfiguration?: {
      collectionArn: string;
      vectorIndexName: string;
      fieldMapping: {
        vectorField: string;
        textField: string;
        metadataField: string;
      };
    };
  };
}

export interface CreateDataSourceInput {
  name: string;
  description?: string;
  dataSourceConfiguration: {
    type: "S3";
    s3Configuration: {
      bucketArn: string;
      inclusionPrefixes?: string[];
    };
  };
  vectorIngestionConfiguration?: {
    chunkingConfiguration?: {
      chunkingStrategy: "FIXED_SIZE" | "NONE";
      fixedSizeChunkingConfiguration?: {
        maxTokens: number;
        overlapPercentage: number;
      };
    };
  };
}

export interface InvokeAgentInput {
  inputText: string;
  sessionId: string;
  enableTrace?: boolean;
  endSession?: boolean;
  sessionState?: {
    sessionAttributes?: Record<string, string>;
    promptSessionAttributes?: Record<string, string>;
  };
}

export interface AgentCitation {
  retrievedReferences: Array<{
    content: { text: string };
    location: { s3Location?: { uri: string } };
  }>;
}

export interface AgentInvocationResult {
  sessionId: string;
  completion: string;
  citations?: AgentCitation[];
  traces?: unknown[];
}

export interface RetrieveInput {
  retrievalQuery: { text: string };
  retrievalConfiguration?: {
    vectorSearchConfiguration: {
      numberOfResults: number;
      overrideSearchType?: "HYBRID" | "SEMANTIC";
    };
  };
  nextToken?: string;
}

export interface RetrievalResultItem {
  content: { text: string };
  location: { s3Location?: { uri: string } };
  score: number;
  metadata?: Record<string, unknown>;
}

export interface RetrievalResult {
  retrievalResults: RetrievalResultItem[];
  nextToken?: string;
}

export interface StartIngestionJobInput {
  description?: string;
  clientToken?: string;
}
