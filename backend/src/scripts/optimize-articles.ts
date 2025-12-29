import dotenv from "dotenv";
import axios from "axios";
import database from "../config/database";
import Article from "../models/Article";
import googleSearchService from "../services/google-search.service";
import scraperService from "../services/scraper.service";
import llmService from "../services/llm.service";

dotenv.config();

class ArticleOptimizer {
	private readonly apiBaseUrl =
		process.env.API_BASE_URL || "http://localhost:5000/api";
	private readonly delayBetweenRequests = 3000;

	async run() {
		try {
			console.log("🚀 Starting article optimization process...\n");

			console.log("🔍 Testing Hugging Face API connection...");
			await llmService.testConnection();

			await database.connect();

			const articles = await Article.find({ isOriginal: true }).limit(5);

			if (articles.length === 0) {
				console.log("❌ No articles found. Please run scraping first.");
				return;
			}

			console.log(`📚 Found ${articles.length} articles to optimize\n`);

			for (let i = 0; i < articles.length; i++) {
				const article = articles[i];

				try {
					console.log(`\n[${i + 1}/${articles.length}] Processing article...`);
					await this.optimizeArticle(article);

					if (i < articles.length - 1) {
						console.log(
							`⏳ Waiting ${
								this.delayBetweenRequests / 1000
							}s before next article...`
						);
						await this.sleep(this.delayBetweenRequests);
					}
				} catch (error: any) {
					console.error(
						`❌ Failed to optimize article "${article.title}":`,
						error.message
					);

					if (error.message?.includes("rate limit")) {
						console.log("⏳ Rate limit hit. Waiting 60 seconds...");
						await this.sleep(60000);
					}
				}
			}

			console.log("\n✅ Article optimization completed!");
			await database.disconnect();
		} catch (error) {
			console.error("Fatal error:", error);
			process.exit(1);
		}
	}

	private async optimizeArticle(article: any) {
		console.log(`\n📝 Processing: "${article.title}"`);

		console.log("  🔍 Searching Google...");
		const searchResults = await googleSearchService.searchArticles(
			article.title,
			2
		);

		if (searchResults.length === 0) {
			console.log("  ⚠️  No search results found, skipping...");
			return;
		}

		console.log(`  ✓ Found ${searchResults.length} reference articles`);

		console.log("  📥 Scraping reference articles...");
		const referenceArticles = [];

		for (const result of searchResults) {
			try {
				const content = await scraperService.scrapeExternalArticle(result.url);
				referenceArticles.push({
					title: result.title,
					url: result.url,
					content,
				});
				console.log(`    ✓ Scraped: ${result.title.substring(0, 50)}...`);
				await this.sleep(1000);
			} catch (error) {
				console.log(`    ✗ Failed: ${result.url}`);
			}
		}

		if (referenceArticles.length === 0) {
			console.log("  ⚠️  Could not scrape any reference articles, skipping...");
			return;
		}

		console.log(
			"  🤖 Optimizing content with AI (this may take 30-60 seconds)..."
		);

		let optimized;
		try {
			optimized = await llmService.optimizeContent({
				originalTitle: article.title,
				originalContent: article.content,
				referenceArticles,
			});
		} catch (error: any) {
			if (error.message?.includes("rate limit")) {
				console.log("  ⚠️  Rate limit hit, trying fallback model...");
				optimized = await llmService.optimizeContentFallback({
					originalTitle: article.title,
					originalContent: article.content,
					referenceArticles,
				});
			} else {
				throw error;
			}
		}

		console.log("  ✓ Content optimized");

		const referencesSection = this.formatReferences(referenceArticles);
		const finalContent = `${optimized.optimizedContent}\n\n${referencesSection}`;

		console.log("  💾 Publishing optimized article...");

		const response = await axios.post(`${this.apiBaseUrl}/articles`, {
			title: `${article.title} (Optimized)`,
			content: article.content,
			updatedContent: finalContent,
			url: `${article.url}-optimized-${Date.now()}`,
			isOriginal: false,
			originalArticleId: article._id,
			author: article.author,
			references: referenceArticles.map((ref) => ({
				title: ref.title,
				url: ref.url,
			})),
		});

		console.log("  ✅ Successfully published optimized version");
	}

	private formatReferences(
		references: Array<{ title: string; url: string }>
	): string {
		let section = "## References\n\n";
		section += "This article was optimized based on insights from:\n\n";

		references.forEach((ref, index) => {
			section += `${index + 1}. [${ref.title}](${ref.url})\n`;
		});

		return section;
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

const optimizer = new ArticleOptimizer();
optimizer.run();