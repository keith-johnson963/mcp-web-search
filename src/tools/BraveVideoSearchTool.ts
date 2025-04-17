import type { BraveSearch } from 'brave-search';
import type { BraveMcpServer } from '../server.js';
import { SafeSearchLevel } from 'brave-search/dist/types.js';
import { z } from 'zod';
import { formatVideoResults } from '../utils.js';
import { BaseTool } from './BaseTool.js';

const videoSearchInputSchema = z.object({
  query: z.string().describe('The term to search the internet for videos of'),
  count: z.number().min(1).max(20).default(10).optional().describe('The number of results to return, minimum 1, maximum 20'),
});

export class BraveVideoSearchTool extends BaseTool<typeof videoSearchInputSchema, any> {
  public readonly name = 'brave_video_search';
  public readonly description = 'Searches for videos using the Brave Search API. '
    + 'Use this for video content, tutorials, or any media-related queries. '
    + 'Returns a list of videos with titles, URLs, and descriptions. '
    + 'Maximum 20 results per request.';

  public readonly inputSchema = videoSearchInputSchema;

  constructor(private braveMcpServer: BraveMcpServer, private braveSearch: BraveSearch) {
    super();
  }

  public async executeCore(input: z.infer<typeof videoSearchInputSchema>) {
    const { query, count } = input;
    const videoSearchResults = await this.braveSearch.videoSearch(query, {
      count,
      safesearch: SafeSearchLevel.Strict,
    });
    if (!videoSearchResults.results || videoSearchResults.results.length === 0) {
      this.braveMcpServer.log(`No video results found for "${query}"`);
      const text = `No video results found for "${query}"`;
      return { content: [{ type: 'text' as const, text }] };
    }

    const text = formatVideoResults(videoSearchResults.results);
    return { content: [{ type: 'text' as const, text }] };
  }
}
