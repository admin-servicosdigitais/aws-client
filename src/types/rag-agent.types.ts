export interface RagAgentConfig {
  agentName: string;
  foundationModel: string;
  instruction: string;
  agentResourceRoleArn: string;
  kbRoleArn: string;
  collectionArn: string;
  s3BucketArn: string;
  embeddingModelArn: string;
  embeddingDimensions?: number;
  agentDescription?: string;
  kbDescription?: string;
  dataSourceDescription?: string;
  aliasName?: string;
  idleSessionTTLInSeconds?: number;
  startIngestion?: boolean;
  chunkingConfig?: {
    maxTokens?: number;
    overlapPercentage?: number;
  };
  vectorFieldName?: string;
  textFieldName?: string;
  metadataFieldName?: string;
}

export interface RagAgentResult {
  agentId: string;
  agentAliasId: string;
  knowledgeBaseId: string;
  dataSourceId: string;
  indexName: string;
  ingestionJobId?: string;
}
