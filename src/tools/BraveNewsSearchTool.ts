import type { BraveSearch } from 'brave-search';
import type { BraveMcpServer } from '../server.js';
import { z } from 'zod';
import { BaseTool } from './BaseTool.js';

const newsSearchInputSchema = z.object({
  query: z.string().describe('The term to search the internet for news articles, trending topics, or recent events'),
  count: z.number().min(1).max(20).default(10).optional().describe('The number of results to return, minimum 1, maximum 20'),
});

export class BraveNewsSearchTool extends BaseTool<typeof newsSearchInputSchema, any> {
  public readonly name = 'brave_news_search';
  public readonly description = 'Searches for news articles using the Brave Search API. '
    + 'Use this for recent events, trending topics, or specific news stories. '
    + 'Returns a list of articles with titles, URLs, and descriptions. '
    + 'Maximum 20 results per request.';

  public readonly inputSchema = newsSearchInputSchema;

  constructor(private braveMcpServer: BraveMcpServer, private braveSearch: BraveSearch) {
    super();
  }

  public async executeCore(input: z.infer<typeof newsSearchInputSchema>) {
    const { query, count } = input;
    const newsResult = await this.braveSearch.newsSearch(query, {
      count,
    });
    if (!newsResult.results || newsResult.results.length === 0) {
      this.braveMcpServer.log(`No news results found for "${query}"`);
      const text = `No news results found for "${query}"`;
      return { content: [{ type: 'text' as const, text }] };
    }

    const text = newsResult.results
      .map(result =>
        `Title: ${result.title}\n`
        + `URL: ${result.url}\n`
        + `Age: ${result.age}\n`
        + `Description: ${result.description}\n`,
      )
      .join('\n\n');
    return { content: [{ type: 'text' as const, text }] };
  }
}
