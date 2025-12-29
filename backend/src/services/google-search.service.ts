import axios, { AxiosError } from "axios";
import * as cheerio from "cheerio";

interface SearchResult {
	title: string;
	url: string;
	snippet: string;
}

interface SerpApiResult {
	title: string;
	link: string;
	snippet: string;
}

interface SerpApiResponse {
	organic_results: SerpApiResult[];
}

class SearchServiceError extends Error {
	constructor(
		message: string,
		public readonly statusCode: number = 500,
		public readonly originalError?: unknown
	) {
		super(message);
		this.name = "SearchServiceError";
		Object.setPrototypeOf(this, SearchServiceError.prototype);
	}
}

const getErrorMessage = (error: unknown): string => {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "An unknown error occurred";
};

const isAxiosError = (error: unknown): error is AxiosError => {
	return (error as AxiosError).isAxiosError === true;
};

class GoogleSearchService {
	private readonly userAgent =
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
	private readonly timeout = 15000;
	private readonly maxRetries = 2;

	private readonly excludedDomains = [
		"youtube.com",
		"facebook.com",
		"twitter.com",
		"x.com",
		"instagram.com",
		"tiktok.com",
		"pinterest.com",
		"beyondchats.com",
	];

	/**
	 * Search Google and return top article results
	 * @param query Search query
	 * @param limit Number of results to return (default: 2)
	 * @returns Array of search results
	 * @throws SearchServiceError if search fails
	 */
	async searchArticles(
		query: string,
		limit: number = 2
	): Promise<SearchResult[]> {
		if (!query || query.trim().length === 0) {
			throw new SearchServiceError("Search query cannot be empty", 400);
		}

		if (limit < 1 || limit > 20) {
			throw new SearchServiceError("Limit must be between 1 and 20", 400);
		}

		try {
			const encodedQuery = encodeURIComponent(query.trim());
			const searchUrl = `https://www.google.com/search?q=${encodedQuery}&num=${
				limit * 3
			}`;

			const response = await this.fetchWithRetry(searchUrl);
			const results = this.parseSearchResults(response.data, limit);

			if (results.length === 0) {
				console.warn(`No results found for query: "${query}"`);
			}

			return results;
		} catch (error) {
			const errorMessage = getErrorMessage(error);
			console.error("Error searching Google:", {
				query,
				error: errorMessage,
				timestamp: new Date().toISOString(),
			});

			if (error instanceof SearchServiceError) {
				throw error;
			}

			throw new SearchServiceError(
				`Google search failed: ${errorMessage}`,
				500,
				error
			);
		}
	}

	/**
	 * Fetch URL with retry logic
	 * @param url URL to fetch
	 * @param retries Number of retries remaining
	 * @returns Axios response
	 */
	private async fetchWithRetry(
		url: string,
		retries: number = this.maxRetries
	): Promise<any> {
		try {
			return await axios.get(url, {
				headers: {
					"User-Agent": this.userAgent,
					"Accept-Language": "en-US,en;q=0.9",
					Accept:
						"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
					"Accept-Encoding": "gzip, deflate, br",
					Connection: "keep-alive",
					"Upgrade-Insecure-Requests": "1",
				},
				timeout: this.timeout,
				validateStatus: (status) => status === 200,
			});
		} catch (error) {
			if (retries > 0 && this.isRetryableError(error)) {
				console.warn(
					`Request failed, retrying... (${this.maxRetries - retries + 1}/${
						this.maxRetries
					})`
				);
				await this.delay(1000 * (this.maxRetries - retries + 1));
				return this.fetchWithRetry(url, retries - 1);
			}
			throw error;
		}
	}

	/**
	 * Check if error is retryable
	 */
	private isRetryableError(error: unknown): boolean {
		if (isAxiosError(error)) {
			return (
				!error.response ||
				(error.response.status >= 500 && error.response.status < 600) ||
				error.code === "ECONNABORTED" ||
				error.code === "ETIMEDOUT"
			);
		}
		return false;
	}

	/**
	 * Parse Google search results HTML
	 */
	private parseSearchResults(html: string, limit: number): SearchResult[] {
		const $ = cheerio.load(html);
		const results: SearchResult[] = [];

		const selectors = [".g", ".tF2Cxc", "div[data-sokoban-container]"];

		for (const selector of selectors) {
			if (results.length >= limit) break;

			$(selector).each((_, element) => {
				if (results.length >= limit) return false;

				const $result = $(element);

				const linkElement = $result.find("a[href]").first();
				const url = linkElement.attr("href");

				if (!this.isValidUrl(url)) return;

				const title = $result
					.find("h3, .LC20lb, .DKV0Md")
					.first()
					.text()
					.trim();

				const snippet = $result
					.find(".VwiC3b, .s, .st, .lEBKkf")
					.first()
					.text()
					.trim();

				if (title && url && !this.isDuplicateResult(results, url)) {
					results.push({
						title: this.sanitizeText(title),
						url,
						snippet: this.sanitizeText(snippet),
					});
				}
			});

			if (results.length >= limit) break;
		}

		return results.slice(0, limit);
	}

	/**
	 * Validate URL
	 */
	private isValidUrl(url: string | undefined): url is string {
		if (!url || !url.startsWith("http")) return false;

		try {
			const urlObj = new URL(url);
			return !this.excludedDomains.some((domain) =>
				urlObj.hostname.includes(domain)
			);
		} catch {
			return false;
		}
	}

	/**
	 * Check for duplicate results
	 */
	private isDuplicateResult(results: SearchResult[], url: string): boolean {
		return results.some((result) => result.url === url);
	}

	/**
	 * Sanitize text content
	 */
	private sanitizeText(text: string): string {
		return text
			.replace(/\s+/g, " ")
			.replace(/[\r\n\t]/g, " ")
			.trim()
			.slice(0, 500);
	}

	/**
	 * Delay utility for retry logic
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Alternative: Use SerpApi (more reliable, requires API key)
	 * @param query Search query
	 * @param limit Number of results to return (default: 2)
	 * @returns Array of search results
	 * @throws SearchServiceError if search fails
	 */
	async searchWithSerpApi(
		query: string,
		limit: number = 2
	): Promise<SearchResult[]> {
		const apiKey = process.env.SERPAPI_KEY;

		if (!apiKey) {
			throw new SearchServiceError(
				"SERPAPI_KEY environment variable not configured",
				500
			);
		}

		if (!query || query.trim().length === 0) {
			throw new SearchServiceError("Search query cannot be empty", 400);
		}

		if (limit < 1 || limit > 20) {
			throw new SearchServiceError("Limit must be between 1 and 20", 400);
		}

		try {
			const response = await axios.get<SerpApiResponse>(
				"https://serpapi.com/search",
				{
					params: {
						q: query.trim(),
						api_key: apiKey,
						num: limit,
						engine: "google",
					},
					timeout: this.timeout,
				}
			);

			if (!response.data.organic_results) {
				return [];
			}

			return response.data.organic_results
				.slice(0, limit)
				.map((result: SerpApiResult) => ({
					title: this.sanitizeText(result.title),
					url: result.link,
					snippet: this.sanitizeText(result.snippet || ""),
				}))
				.filter((result) => this.isValidUrl(result.url));
		} catch (error) {
			const errorMessage = getErrorMessage(error);
			console.error("SerpApi error:", {
				query,
				error: errorMessage,
				timestamp: new Date().toISOString(),
			});

			if (isAxiosError(error) && error.response) {
				const status = error.response.status;
				if (status === 401) {
					throw new SearchServiceError("Invalid SerpApi API key", 401, error);
				} else if (status === 429) {
					throw new SearchServiceError(
						"SerpApi rate limit exceeded",
						429,
						error
					);
				}
			}

			throw new SearchServiceError(
				`SerpApi search failed: ${errorMessage}`,
				500,
				error
			);
		}
	}

	/**
	 * Search with fallback: Try Google first, then SerpApi if configured
	 */
	async searchWithFallback(
		query: string,
		limit: number = 2
	): Promise<SearchResult[]> {
		try {
			return await this.searchArticles(query, limit);
		} catch (error) {
			console.warn("Google search failed, trying SerpApi fallback...");

			if (process.env.SERPAPI_KEY) {
				return await this.searchWithSerpApi(query, limit);
			}

			throw error;
		}
	}
}

export default new GoogleSearchService();
export { SearchServiceError, SearchResult };