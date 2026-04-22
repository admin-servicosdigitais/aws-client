import { defaultProvider } from "@aws-sdk/credential-provider-node";
import type { AwsCredentialIdentity, AwsCredentialIdentityProvider } from "@aws-sdk/types";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws-v3";
import { Client } from "@opensearch-project/opensearch";
import type { AwsCredentialInput } from "../config/aws.config.js";
import type { IOpenSearchClient } from "../interfaces/opensearch.interface.js";
import type {
  CreateIndexOptions,
  IndexInfo,
  IndexMappings,
  MappingProperty,
  SearchHit,
  SearchQuery,
  SearchResult,
  SearchTotal,
} from "../types/opensearch.types.js";
import { AwsClientError } from "../errors/aws-client.error.js";
import { toAwsClientError } from "../internal/utils/error.util.js";
import { createCredentialProvider } from "../internal/utils/credentials.util.js";

interface CatIndexResponseItem {
  health?: string;
  status?: string;
  index?: string;
  "docs.count"?: string;
  "docs.deleted"?: string;
  "store.size"?: string;
}

export class OpenSearchServerlessClientImpl implements IOpenSearchClient {
  private client?: Client;

  constructor(
    private readonly node: string,
    private readonly region: string,
    private readonly credentials?: AwsCredentials | AwsCredentialIdentityProvider,
  ) {}

  createIndex(indexName: string, options?: CreateIndexOptions): Promise<void> {
    return this.executeWithErrorMapping("OpenSearchServerlessClientImpl.createIndex", async () => {
      await this.getClient().indices.create({
        index: indexName,
        body: {
          ...(options?.settings !== undefined && { settings: this.mapSettings(options.settings) }),
          ...(options?.mappings !== undefined && { mappings: this.mapMappings(options.mappings) }),
        },
      });
    });
  }

  deleteIndex(indexName: string): Promise<void> {
    return this.executeWithErrorMapping("OpenSearchServerlessClientImpl.deleteIndex", async () => {
      await this.getClient().indices.delete({ index: indexName });
    });
  }

  indexExists(indexName: string): Promise<boolean> {
    return this.executeWithErrorMapping("OpenSearchServerlessClientImpl.indexExists", async () => {
      const output = await this.getClient().indices.exists({ index: indexName });
      return output.body;
    });
  }

  getIndexInfo(indexName?: string): Promise<IndexInfo[]> {
    return this.executeWithErrorMapping("OpenSearchServerlessClientImpl.getIndexInfo", async () => {
      const output = await this.getClient().cat.indices({
        format: "json",
        ...(indexName !== undefined && { index: indexName }),
      });

      const body = output.body as CatIndexResponseItem[];

      return body.map((item) => this.mapIndexInfo(item));
    });
  }

  putMapping(indexName: string, mappings: IndexMappings): Promise<void> {
    return this.executeWithErrorMapping("OpenSearchServerlessClientImpl.putMapping", async () => {
      await this.getClient().indices.putMapping({
        index: indexName,
        body: this.mapMappings(mappings),
      });
    });
  }

  search<T>(indexName: string, query: SearchQuery): Promise<SearchResult<T>> {
    return this.executeWithErrorMapping("OpenSearchServerlessClientImpl.search", async () => {
      const output = await this.getClient().search({
        index: indexName,
        body: this.mapSearchQuery(query),
      });

      const responseBody = output.body as {
        hits?: {
          total?: number | SearchTotal;
          hits?: Array<{ _id?: string; _score?: number | null; _source?: T; highlight?: Record<string, string[]>; sort?: unknown[] }>;
        };
        aggregations?: Record<string, unknown>;
        took?: number;
        timed_out?: boolean;
      };

      return {
        total: this.mapTotal(responseBody.hits?.total),
        hits: (responseBody.hits?.hits ?? []).map((hit) => this.mapHit(hit)),
        ...(responseBody.aggregations !== undefined && { aggregations: responseBody.aggregations }),
        took: responseBody.took ?? 0,
        timedOut: responseBody.timed_out ?? false,
      };
    });
  }

  count(indexName: string, query?: Pick<SearchQuery, "query">): Promise<number> {
    return this.executeWithErrorMapping("OpenSearchServerlessClientImpl.count", async () => {
      const output = await this.getClient().count({
        index: indexName,
        ...(query?.query !== undefined && { body: { query: query.query } }),
      });

      return (output.body as { count?: number }).count ?? 0;
    });
  }

  private getClient(): Client {
    if (!this.client) {
      const explicitCredentials = this.credentials;
      const getCredentials: () => Promise<AwsCredentialIdentity> = explicitCredentials
        ? () => Promise.resolve(typeof explicitCredentials === "function" ? explicitCredentials() : explicitCredentials)
        : () => defaultProvider()();

      this.client = new Client({
        ...AwsSigv4Signer({
          region: this.region,
          service: "aoss",
          getCredentials,
        }),
        node: this.node,
      });
    }

    return this.client;
  }

  private mapSettings(settings: NonNullable<CreateIndexOptions["settings"]>): Record<string, unknown> {
    return {
      ...(settings.numberOfShards !== undefined && { number_of_shards: settings.numberOfShards }),
      ...(settings.numberOfReplicas !== undefined && { number_of_replicas: settings.numberOfReplicas }),
      ...(settings.refreshInterval !== undefined && { refresh_interval: settings.refreshInterval }),
      ...(settings.maxResultWindow !== undefined && { max_result_window: settings.maxResultWindow }),
      ...(settings.analysis !== undefined && { analysis: settings.analysis }),
    };
  }

  private mapMappings(mappings: IndexMappings): { properties: Record<string, unknown> } {
    return {
      properties: this.mapMappingProperties(mappings.properties),
    };
  }

  private mapMappingProperties(properties: Record<string, MappingProperty>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(properties).map(([fieldName, definition]) => [fieldName, this.mapMappingProperty(definition)]),
    );
  }

  private mapMappingProperty(property: MappingProperty): Record<string, unknown> {
    if (property.type === "object" || property.type === "nested") {
      return {
        type: property.type,
        ...(property.properties !== undefined && {
          properties: this.mapMappingProperties(property.properties),
        }),
      };
    }

    if (property.type === "dense_vector") {
      return {
        type: property.type,
        dims: property.dims,
        ...(property.similarity !== undefined && { similarity: property.similarity }),
      };
    }

    return {
      ...property,
    };
  }

  private mapSearchQuery(query: SearchQuery): Record<string, unknown> {
    return {
      ...(query.query !== undefined && { query: query.query }),
      ...(query.knn !== undefined && { knn: this.mapKnn(query.knn) }),
      ...(query.aggs !== undefined && { aggs: query.aggs }),
      ...(query.sort !== undefined && { sort: query.sort }),
      ...(query._source !== undefined && { _source: query._source }),
      ...(query.from !== undefined && { from: query.from }),
      ...(query.size !== undefined && { size: query.size }),
      ...(query.highlight !== undefined && { highlight: query.highlight }),
      ...(query.searchAfter !== undefined && { search_after: query.searchAfter }),
    };
  }

  private mapKnn(knn: SearchQuery["knn"]): Record<string, unknown> {
    if (!knn) {
      return {};
    }

    const legacyKnn = knn as unknown as Record<string, { vector: number[]; k: number }>;
    const hasLegacyFormat = Object.values(legacyKnn).some((value) => value?.vector !== undefined && value?.k !== undefined);

    if (hasLegacyFormat) {
      return legacyKnn;
    }

    return {
      [knn.field]: {
        vector: knn.queryVector,
        k: knn.k,
      },
    };
  }

  private mapIndexInfo(item: CatIndexResponseItem): IndexInfo {
    if (!item.index) {
      throw new AwsClientError("OpenSearchServerlessClientImpl.getIndexInfo: OpenSearch returned index without name", item);
    }

    return {
      index: item.index,
      health: this.mapHealth(item.health),
      status: this.mapStatus(item.status),
      docsCount: this.parseNumericField(item["docs.count"]),
      docsDeleted: this.parseNumericField(item["docs.deleted"]),
      storeSize: item["store.size"] ?? "0b",
    };
  }

  private parseNumericField(value: string | undefined): number {
    if (!value) {
      return 0;
    }

    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private mapHealth(health: string | undefined): IndexInfo["health"] {
    return health === "green" || health === "yellow" || health === "red" ? health : "yellow";
  }

  private mapStatus(status: string | undefined): IndexInfo["status"] {
    return status === "open" || status === "close" ? status : "open";
  }

  private mapTotal(total: number | SearchTotal | undefined): SearchTotal {
    if (typeof total === "number") {
      return { value: total, relation: "eq" };
    }

    return {
      value: total?.value ?? 0,
      relation: total?.relation ?? "eq",
    };
  }

  private mapHit<T>(hit: { _id?: string; _score?: number | null; _source?: T; highlight?: Record<string, string[]>; sort?: unknown[] }): SearchHit<T> {
    return {
      id: hit._id ?? "",
      score: hit._score ?? null,
      source: hit._source as T,
      ...(hit.highlight !== undefined && { highlight: hit.highlight }),
      ...(hit.sort !== undefined && { sort: hit.sort }),
    };
  }

  private async executeWithErrorMapping<T>(context: string, executor: () => Promise<T>): Promise<T> {
    try {
      return await executor();
    } catch (error) {
      throw toAwsClientError(error, `${context} failed`);
    }
  }
}
