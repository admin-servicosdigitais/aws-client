// Autenticação via AWS SigV4 (IAM) — para Amazon OpenSearch Serverless (aoss).
// Na implementação concreta, usar:
//   import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws-v3";
//   import { defaultProvider } from "@aws-sdk/credential-provider-node";
//
//   const client = new Client({
//     ...AwsSigv4Signer({
//       region,
//       service: "aoss",
//       getCredentials: credentials
//         ? () => Promise.resolve(credentials)
//         : () => defaultProvider()(),
//     }),
//     node,
//   });
import type { AwsCredentials } from "../config/aws.config.js";
import type { IOpenSearchClient } from "../interfaces/opensearch.interface.js";
import type {
  CreateIndexOptions,
  IndexInfo,
  IndexMappings,
  SearchQuery,
  SearchResult,
} from "../types/opensearch.types.js";
import { NotImplementedError } from "../errors/aws-client.error.js";

export class OpenSearchServerlessClientImpl implements IOpenSearchClient {
  constructor(
    private readonly node: string,
    private readonly region: string,
    private readonly credentials?: AwsCredentials,
  ) {}

  createIndex(_indexName: string, _options?: CreateIndexOptions): Promise<void> {
    throw new NotImplementedError("OpenSearchServerlessClientImpl.createIndex");
  }

  deleteIndex(_indexName: string): Promise<void> {
    throw new NotImplementedError("OpenSearchServerlessClientImpl.deleteIndex");
  }

  indexExists(_indexName: string): Promise<boolean> {
    throw new NotImplementedError("OpenSearchServerlessClientImpl.indexExists");
  }

  getIndexInfo(_indexName?: string): Promise<IndexInfo[]> {
    throw new NotImplementedError("OpenSearchServerlessClientImpl.getIndexInfo");
  }

  putMapping(_indexName: string, _mappings: IndexMappings): Promise<void> {
    throw new NotImplementedError("OpenSearchServerlessClientImpl.putMapping");
  }

  search<T>(_indexName: string, _query: SearchQuery): Promise<SearchResult<T>> {
    throw new NotImplementedError("OpenSearchServerlessClientImpl.search");
  }

  count(_indexName: string, _query?: Pick<SearchQuery, "query">): Promise<number> {
    throw new NotImplementedError("OpenSearchServerlessClientImpl.count");
  }
}
