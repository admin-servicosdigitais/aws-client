# @erick/aws-client

Biblioteca TypeScript para acesso unificado aos serviços AWS. Expõe um `AwsProvider` que instancia clientes tipados para S3, SQS, DynamoDB, Bedrock Agents, OpenSearch Serverless e STS — todos com interfaces segregadas para injeção de dependência e testabilidade.

## Requisitos

- Node.js >= 18
- TypeScript >= 5.x (strict recomendado)
- AWS SDK v3 (peer dependencies — ver abaixo)

## Instalação

### 1. Instalar a biblioteca

```bash
npm install @erick/aws-client
```

### 2. Instalar as peer dependencies do AWS SDK v3

Instale apenas os pacotes dos serviços que você vai usar:

```bash
# Essencial — provedor de credenciais
npm install @aws-sdk/credential-provider-node

# S3
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# SQS
npm install @aws-sdk/client-sqs

# DynamoDB
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb

# Bedrock Agents
npm install @aws-sdk/client-bedrock-agent @aws-sdk/client-bedrock-agent-runtime

# STS
npm install @aws-sdk/client-sts

# OpenSearch Serverless
npm install @opensearch-project/opensearch
```

## Build

```bash
# Compilar
npm run build

# Type check sem emitir arquivos
npm run typecheck

# Limpar dist/
npm run clean
```

O output é gerado em `dist/` com declarations (`.d.ts`), source maps e suporte a ESM/CJS via NodeNext.

## Importando em um novo projeto

```typescript
// tsconfig.json do projeto consumidor deve ter:
// "moduleResolution": "NodeNext" (ou "Bundler")
// "module": "NodeNext" (ou "ESNext")

import {
  AwsProvider,
  type AwsProviderConfig,
  type IS3Client,
  type IDynamoClient,
} from '@erick/aws-client';
```

### Configuração do provider

```typescript
import { AwsProvider } from '@erick/aws-client';

// Credenciais explícitas
const provider = new AwsProvider({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    sessionToken: process.env.AWS_SESSION_TOKEN, // opcional
  },
});

// Credenciais do ambiente (IAM role, ~/.aws/credentials, env vars)
const provider = new AwsProvider({ region: 'us-east-1' });

// Assume role automática com refresh contínuo (STS)
process.env.AWS_ASSUME_ROLE = 'arn:aws:iam::999888777666:role/BedrockDeployRole';
const assumedRoleProvider = new AwsProvider({ region: 'us-east-1' });

// Endpoint customizado (LocalStack, por exemplo)
const provider = new AwsProvider({
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
});
```

### Comportamento automático por env

O `AwsProvider` aplica automaticamente a mesma estratégia de credenciais para todos os clientes (S3, SQS, DynamoDB, Bedrock, OpenSearch Serverless e STS):

- `AWS_ASSUME_ROLE` **definida**: o provider sempre opera em **cross-account** via STS `AssumeRole`, com refresh automático de credenciais temporárias.
- `AWS_ASSUME_ROLE` **ausente ou vazia**: o provider usa a credencial base da conta de origem (chain padrão do AWS SDK: env vars, profile, IAM role etc.).

> Se `credentials` for informado explicitamente no construtor, ele tem precedência sobre o comportamento automático por variável de ambiente.

## RagAgentOrchestrator

Abstração de alto nível que orquestra a criação completa de um Agente Bedrock com RAG em uma única chamada: cria o índice vetorial no OpenSearch Serverless (collection pré-existente), configura a Knowledge Base, aponta o Data Source para o S3, dispara a ingestão, cria o Agente, associa a KB e publica o alias — retornando `agentId` e `agentAliasId` prontos para `invokeAgent`.

### Pré-requisitos na conta AWS

Antes de executar o orquestrador, os seguintes recursos precisam existir na sua conta:

| Recurso | O que você precisa |
|---|---|
| **IAM Role — Agente** | Role com trust policy para `bedrock.amazonaws.com`, permissão para invocar foundation models |
| **IAM Role — Knowledge Base** | Role com trust policy para `bedrock.amazonaws.com`, permissão para `aoss:APIAccessAll` na collection e `s3:GetObject` no bucket |
| **AOSS Collection** | Collection do tipo **Vector search** criada no OpenSearch Serverless |
| **AOSS Data Access Policy** | Policy que dá ao role da KB permissão de leitura/escrita de índices na collection |
| **S3 Bucket** | Bucket com os documentos a serem ingeridos |

### Exemplo completo

```typescript
import {
  AwsProvider,
  RagAgentOrchestrator,
  type RagAgentConfig,
} from '@erick/aws-client';

// 1. Provider — use credenciais explícitas ou deixe o SDK resolver
//    via env vars (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY),
//    IAM role anexada à instância/task, ou ~/.aws/credentials
const provider = new AwsProvider({
  region: 'us-east-1',
  // credentials: {                        // omita para usar credenciais do ambiente
  //   accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  //   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  //   sessionToken: process.env.AWS_SESSION_TOKEN,
  // },
});

// 2. Instanciar o orquestrador com os dois clientes que ele precisa
const orchestrator = new RagAgentOrchestrator(
  provider.bedrock(),
  provider.opensearchServerless(
    'https://<collection-id>.us-east-1.aoss.amazonaws.com',
  ),
);

// 3. Criar o agente RAG completo
const config: RagAgentConfig = {
  // — Agente —
  agentName:            'assistente-suporte',
  foundationModel:      'anthropic.claude-sonnet-4-6',
  instruction:          'Responda exclusivamente com base nos documentos da base de conhecimento.',
  agentResourceRoleArn: 'arn:aws:iam::123456789012:role/BedrockAgentRole',
  idleSessionTTLInSeconds: 1800,

  // — Knowledge Base —
  kbRoleArn:        'arn:aws:iam::123456789012:role/BedrockKnowledgeBaseRole',
  collectionArn:    'arn:aws:aoss:us-east-1:123456789012:collection/<collection-id>',
  embeddingModelArn:'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1',

  // — Data Source —
  s3BucketArn: 'arn:aws:s3:::meus-documentos-rag',

  // — Opcionais (valores padrão mostrados) —
  aliasName:           'producao',       // nome do alias publicado
  startIngestion:      true,             // dispara o job de ingestão imediatamente
  embeddingDimensions: 1536,             // Titan Text V1 = 1536
  chunkingConfig: {
    maxTokens:         512,
    overlapPercentage: 20,
  },
  vectorFieldName:   'embedding',
  textFieldName:     'text',
  metadataFieldName: 'metadata',
};

const { agentId, agentAliasId, knowledgeBaseId, ingestionJobId } =
  await orchestrator.create(config);

console.log({ agentId, agentAliasId, knowledgeBaseId, ingestionJobId });

// 4. Pronto — invocar o agente
const bedrock = provider.bedrock();

const resposta = await bedrock.invokeAgent(agentId, agentAliasId, {
  inputText:  'Como faço para cancelar meu pedido?',
  sessionId:  `sessao-${crypto.randomUUID()}`,
  enableTrace: false,
});

console.log(resposta.completion);
```

### O que o orquestrador faz internamente

```
1. openSearch.indexExists(indexName)
   └── se não existe → openSearch.createIndex(indexName, { mappings, settings })

2. bedrock.createKnowledgeBase({ ..., opensearchServerlessConfiguration })

3. bedrock.createDataSource(kbId, { ..., s3Configuration })

4. bedrock.startIngestionJob(kbId, dsId)          ← se startIngestion !== false

5. bedrock.createAgent({ agentName, foundationModel, instruction, ... })

6. bedrock.associateAgentKnowledgeBase(agentId, 'DRAFT', kbId, description)

7. bedrock.prepareAgent(agentId)

8. bedrock.createAgentAlias(agentId, { aliasName, routingConfiguration })

→ retorna { agentId, agentAliasId, knowledgeBaseId, dataSourceId, indexName, ingestionJobId }
```

> **Nota sobre ingestão:** `startIngestionJob` é assíncrono — o job roda em background na AWS. O `ingestionJobId` retornado pode ser monitorado via console ou via API do Bedrock para saber quando os documentos estarão disponíveis para o agente.

### Cross-account com STS

Você ainda pode usar STS manualmente quando quiser controle fino sobre sessão/opções. Porém, na maioria dos casos, basta usar `AWS_ASSUME_ROLE` e deixar o provider resolver automaticamente.

#### Exemplo mínimo (sem chamada manual de `assumeRole`)

```typescript
import { AwsProvider, RagAgentOrchestrator } from '@erick/aws-client';

// Com AWS_ASSUME_ROLE definido no ambiente, o provider assume a role automaticamente.
const provider = new AwsProvider({ region: 'us-east-1' });

const orchestrator = new RagAgentOrchestrator(
  provider.bedrock(),
  provider.opensearchServerless('https://<collection-id>.us-east-1.aoss.amazonaws.com'),
);
```

#### Exemplo manual com STS (opcional)

```typescript
import { AwsProvider, RagAgentOrchestrator } from '@erick/aws-client';

process.env.AWS_ASSUME_ROLE = 'arn:aws:iam::999888777666:role/BedrockDeployRole';
// opcional (senão usa aws-client-${Date.now()})
process.env.AWS_ASSUME_ROLE_SESSION_NAME = 'sessao-rag-deploy';

const provider = new AwsProvider({ region: 'us-east-1' });

const orchestrator = new RagAgentOrchestrator(
  provider.bedrock(),
  provider.opensearchServerless('https://<collection-id>.us-east-1.aoss.amazonaws.com'),
);
```

> **Importante:** no STS não existe sessão "permanente". O que existe aqui é renovação automática e contínua das credenciais temporárias enquanto o processo estiver ativo.

---

## Exemplos de uso

### S3

```typescript
import { AwsProvider } from '@erick/aws-client';

const s3 = new AwsProvider({ region: 'us-east-1' }).s3('meu-bucket');

// Upload de arquivo
await s3.uploadFile('uploads/relatorio.pdf', fileBuffer, {
  contentType: 'application/pdf',
  metadata: { origem: 'sistema-x' },
});

// Download
const buffer = await s3.getFile('uploads/relatorio.pdf');

// Verificar existência
const exists = await s3.fileExists('uploads/relatorio.pdf');

// URL pré-assinada para download (válida por 15 minutos)
const url = await s3.getPresignedGetUrl('uploads/relatorio.pdf', {
  expiresIn: 900,
});

// URL pré-assinada para upload direto pelo cliente
const uploadUrl = await s3.getPresignedPutUrl('uploads/novo.pdf', {
  expiresIn: 300,
  contentType: 'application/pdf',
});

// Listar objetos com prefixo
const resultado = await s3.listFiles({ prefix: 'uploads/', maxKeys: 50 });
console.log(resultado.objects.map(o => o.key));

// Upload multipart (arquivos grandes)
const uploadId = await s3.createMultipartUpload('videos/grande.mp4', {
  contentType: 'video/mp4',
});
const etag1 = await s3.uploadPart('videos/grande.mp4', uploadId, 1, part1Buffer);
const etag2 = await s3.uploadPart('videos/grande.mp4', uploadId, 2, part2Buffer);
await s3.completeMultipartUpload('videos/grande.mp4', uploadId, [
  { partNumber: 1, etag: etag1 },
  { partNumber: 2, etag: etag2 },
]);

// Deleção em lote
const { deleted, failed } = await s3.deleteFiles(['tmp/a.txt', 'tmp/b.txt']);
```

### SQS

```typescript
const sqs = new AwsProvider({ region: 'us-east-1' }).sqs(
  'https://sqs.us-east-1.amazonaws.com/123456789/minha-fila'
);

// Enviar mensagem (qualquer tipo serializável)
const messageId = await sqs.sendMessage({ pedidoId: 42, status: 'aprovado' });

// Com opções de delay e deduplicação (FIFO)
const messageId = await sqs.sendMessage(
  { pedidoId: 42 },
  {
    delaySeconds: 30,
    messageGroupId: 'pedidos',
    messageDeduplicationId: `pedido-42-${Date.now()}`,
  }
);

// Atributos da fila
const attrs = await sqs.getQueueAttributes();
console.log(`Mensagens pendentes: ${attrs.approximateNumberOfMessages}`);

// Purgar fila
await sqs.purgeQueue();
```

### DynamoDB

```typescript
const dynamo = new AwsProvider({ region: 'us-east-1' }).dynamo('Pedidos');

// Put com condição
await dynamo.putItem(
  { pedidoId: '123', userId: 'u-456', total: 199.9, status: 'pendente' },
  { conditionExpression: 'attribute_not_exists(pedidoId)' }
);

// Get
const pedido = await dynamo.getItem<Pedido>({ pedidoId: '123' });

// Update
await dynamo.updateItem(
  { pedidoId: '123' },
  'SET #status = :status, updatedAt = :now',
  {
    expressionAttributeNames: { '#status': 'status' },
    expressionAttributeValues: { ':status': 'pago', ':now': new Date().toISOString() },
    returnValues: 'ALL_NEW',
  }
);

// Query por índice secundário
const resultado = await dynamo.query<Pedido>(
  'userId = :uid AND #status = :status',
  {
    indexName: 'userId-status-index',
    expressionAttributeNames: { '#status': 'status' },
    expressionAttributeValues: { ':uid': 'u-456', ':status': 'pendente' },
    scanIndexForward: false,
    limit: 20,
  }
);

// Batch get
const pedidos = await dynamo.batchGetItems<Pedido>([
  { pedidoId: '123' },
  { pedidoId: '124' },
]);

// Transação atômica
await dynamo.transactWrite([
  {
    type: 'Put',
    tableName: 'Pedidos',
    item: { pedidoId: '125', status: 'novo' },
  },
  {
    type: 'Update',
    tableName: 'Estoque',
    key: { produtoId: 'p-99' },
    updateExpression: 'SET quantidade = quantidade - :qtd',
    expressionAttributeValues: { ':qtd': 1, ':zero': 0 },
    conditionExpression: 'quantidade > :zero',
  },
]);
```

### Bedrock Agents

```typescript
const bedrock = new AwsProvider({ region: 'us-east-1' }).bedrock();

// Criar agente
const agent = await bedrock.createAgent({
  agentName: 'assistente-suporte',
  foundationModel: 'anthropic.claude-sonnet-4-6',
  instruction: 'Você é um assistente de suporte ao cliente. Responda de forma objetiva.',
  agentResourceRoleArn: 'arn:aws:iam::123456789:role/BedrockAgentRole',
  idleSessionTTLInSeconds: 1800,
});

// Criar alias de produção
const alias = await bedrock.createAgentAlias(agent.agentId!, {
  aliasName: 'producao',
  routingConfiguration: [{ agentVersion: '1' }],
});

// Knowledge base com OpenSearch Serverless
const kb = await bedrock.createKnowledgeBase({
  name: 'base-produto',
  roleArn: 'arn:aws:iam::123456789:role/BedrockKBRole',
  knowledgeBaseConfiguration: {
    type: 'VECTOR',
    vectorKnowledgeBaseConfiguration: {
      embeddingModelArn:
        'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1',
    },
  },
  storageConfiguration: {
    type: 'OPENSEARCH_SERVERLESS',
    opensearchServerlessConfiguration: {
      collectionArn: 'arn:aws:aoss:us-east-1:123456789:collection/minha-colecao',
      vectorIndexName: 'produto-index',
      fieldMapping: {
        vectorField: 'embedding',
        textField: 'text',
        metadataField: 'metadata',
      },
    },
  },
});

// Data source (S3) + ingestão
const ds = await bedrock.createDataSource(kb.knowledgeBaseId!, {
  name: 'docs-s3',
  dataSourceConfiguration: {
    type: 'S3',
    s3Configuration: { bucketArn: 'arn:aws:s3:::meus-documentos' },
  },
  vectorIngestionConfiguration: {
    chunkingConfiguration: {
      chunkingStrategy: 'FIXED_SIZE',
      fixedSizeChunkingConfiguration: { maxTokens: 512, overlapPercentage: 20 },
    },
  },
});

await bedrock.startIngestionJob(kb.knowledgeBaseId!, ds.dataSourceId!);

// Invocar agente
const resultado = await bedrock.invokeAgent(
  agent.agentId!,
  alias.agentAliasId!,
  {
    inputText: 'Como faço para cancelar meu pedido?',
    sessionId: 'sessao-usuario-789',
    enableTrace: false,
    sessionState: { sessionAttributes: { userId: 'u-456' } },
  }
);
console.log(resultado.completion);

// Busca semântica direta na knowledge base
const busca = await bedrock.retrieve(kb.knowledgeBaseId!, {
  retrievalQuery: { text: 'política de devolução' },
  retrievalConfiguration: {
    vectorSearchConfiguration: { numberOfResults: 5 },
  },
});
```

### OpenSearch Serverless

```typescript
const os = new AwsProvider({ region: 'us-east-1' }).opensearchServerless(
  'https://abc123.us-east-1.aoss.amazonaws.com'
);

// Criar índice com mapeamento de vetores (k-NN)
await os.createIndex('produtos', {
  settings: { numberOfShards: 1, numberOfReplicas: 1 },
  mappings: {
    properties: {
      nome: { type: 'text' },
      categoria: { type: 'keyword' },
      preco: { type: 'float' },
      embedding: { type: 'dense_vector', dims: 1536 },
    },
  },
});

// Busca textual com filtro
const resultados = await os.search<Produto>('produtos', {
  query: {
    bool: {
      must: { match: { nome: 'tênis corrida' } },
      filter: { term: { categoria: 'esporte' } },
    },
  },
  sort: [{ preco: { order: 'asc' } }],
  size: 20,
});

// Busca k-NN (vetores)
const similares = await os.search<Produto>('produtos', {
  knn: {
    embedding: {
      vector: meuEmbedding,
      k: 10,
    },
  },
});

// Contar documentos
const total = await os.count('produtos', {
  query: { term: { categoria: 'esporte' } },
});

// Informações dos índices
const info = await os.getIndexInfo();
console.log(info.map(i => `${i.index}: ${i.docsCount} docs`));
```

### STS

```typescript
const sts = new AwsProvider({ region: 'us-east-1' }).sts();

// Identidade atual
const identidade = await sts.getCallerIdentity();
console.log(`Account: ${identidade.accountId}, ARN: ${identidade.arn}`);

// Assume role (cross-account ou permissões reduzidas)
const credenciais = await sts.assumeRole(
  'arn:aws:iam::987654321:role/AcessoLeitura',
  'sessao-servico-x',
  { durationSeconds: 3600, externalId: 'id-externo-secreto' }
);

// Usar credenciais assumidas em outro provider
const providerCrossAccount = new AwsProvider({
  region: 'us-east-1',
  credentials: credenciais,
});

// Assume role com OIDC (GitHub Actions, Kubernetes IRSA, etc.)
const credenciaisOidc = await sts.assumeRoleWithWebIdentity(
  'arn:aws:iam::123456789:role/GithubActions',
  'github-deploy',
  process.env.GITHUB_ID_TOKEN!,
  { durationSeconds: 900 }
);
```

## Injeção de dependência

Todas as implementações expõem interfaces (`IS3Client`, `ISQSClient`, `IDynamoClient`, etc.), permitindo substituição por mocks em testes sem depender de implementações concretas:

```typescript
// service.ts
import type { IS3Client } from '@erick/aws-client';

export class UploadService {
  constructor(private readonly s3: IS3Client) {}

  async upload(key: string, data: Buffer): Promise<void> {
    await this.s3.uploadFile(key, data, { contentType: 'application/octet-stream' });
  }
}
```

```typescript
// service.test.ts
import type { IS3Client } from '@erick/aws-client';
import { UploadService } from './service';

const mockS3 = {
  uploadFile: vi.fn().mockResolvedValue(undefined),
} as unknown as IS3Client;

const service = new UploadService(mockS3);
await service.upload('test.txt', Buffer.from('hello'));
expect(mockS3.uploadFile).toHaveBeenCalledWith(
  'test.txt',
  expect.any(Buffer),
  { contentType: 'application/octet-stream' }
);
```

## Tratamento de erros

```typescript
import { AwsClientError } from '@erick/aws-client';

try {
  const arquivo = await s3.getFile('nao-existe.txt');
} catch (err) {
  if (err instanceof AwsClientError) {
    console.error(`Erro AWS: ${err.message}`);
    if (err.cause) console.error(`Causa:`, err.cause);
  }
  throw err;
}
```

## Estrutura dos exports

```
@erick/aws-client
├── AwsProvider                  — factory principal
├── AwsClientError               — classe base de erros
├── Interfaces
│   ├── IS3Client
│   ├── ISQSClient
│   ├── IDynamoClient
│   ├── IBedrockClient
│   ├── IOpenSearchClient
│   └── IStsClient
├── Implementações
│   ├── S3ClientImpl
│   ├── SQSClientImpl
│   ├── DynamoClientImpl
│   ├── BedrockClientImpl
│   ├── OpenSearchServerlessClientImpl
│   └── StsClientImpl
└── Tipos — todos os tipos de entrada/saída de cada serviço
```
