import axios from "axios";
import * as cheerio from "cheerio";

interface ScrapedArticle {
    title: string;
    content: string;
    excerpt?: string;
    author?: string;
    publishedDate?: Date;
    url: string;
}

class ScraperService {
    private readonly baseUrl = "https://beyondchats.com/blogs";
    private readonly userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

    /**
     * Scrape articles from BeyondChats blog
     * @param limit Number of articles to scrape
     * @returns Array of scraped articles
     */
    async scrapeArticles(limit: number = 5): Promise<ScrapedArticle[]> {
        try {
            const response = await axios.get(this.baseUrl, {
                headers: {
                    "User-Agent": this.userAgent,
                },
                timeout: 10000,
            });

            const $ = cheerio.load(response.data);
            const articles: ScrapedArticle[] = [];

            const articleElements = $("article, .blog-post, .post-item").slice(
                -limit
            );

            for (const element of articleElements.toArray()) {
                const $article = $(element);

                const relativeUrl = $article.find("a").first().attr("href");
                if (!relativeUrl) continue;

                const articleUrl = relativeUrl.startsWith("http")
                    ? relativeUrl
                    : `https://beyondchats.com${relativeUrl}`;

                const article = await this.scrapeArticlePage(articleUrl);
                if (article) {
                    articles.push(article);
                }
            }

            return articles;
        } catch (error) {
            console.error("Error scraping articles:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to scrape articles: ${errorMessage}`);
        }
    }

    /**
     * Scrape individual article page
     * @param url Article URL
     * @returns Scraped article data
     */
    private async scrapeArticlePage(url: string): Promise<ScrapedArticle | null> {
        try {
            const response = await axios.get(url, {
                headers: {
                    "User-Agent": this.userAgent,
                },
                timeout: 10000,
            });

            const $ = cheerio.load(response.data);

            const title =
                $("h1").first().text().trim() ||
                $("article h1").first().text().trim() ||
                $("title").text().trim();

            const contentSelectors = [
                "article .content",
                "article .post-content",
                ".article-content",
                "article p",
                ".entry-content",
            ];

            let content = "";
            for (const selector of contentSelectors) {
                const extracted = $(selector).text().trim();
                if (extracted && extracted.length > 100) {
                    content = extracted;
                    break;
                }
            }

            const excerpt =
                $('meta[name="description"]').attr("content") ||
                $('meta[property="og:description"]').attr("content") ||
                content.substring(0, 200) + "...";

            const author =
                $(".author-name").text().trim() ||
                $('[rel="author"]').text().trim() ||
                $('meta[name="author"]').attr("content");

            const dateString =
                $("time").attr("datetime") ||
                $(".publish-date").text().trim() ||
                $('meta[property="article:published_time"]').attr("content");

            const publishedDate = dateString ? new Date(dateString) : undefined;

            if (!title || !content) {
                console.warn(`Incomplete data for ${url}`);
                return null;
            }

            return {
                title,
                content,
                excerpt,
                author,
                publishedDate,
                url,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Error scraping article ${url}:`, errorMessage);
            return null;
        }
    }

    /**
     * Scrape content from Google search results
     * @param url Article URL from Google results
     * @returns Scraped content
     */
    async scrapeExternalArticle(url: string): Promise<string> {
        try {
            const response = await axios.get(url, {
                headers: {
                    "User-Agent": this.userAgent,
                },
                timeout: 10000,
            });

            const $ = cheerio.load(response.data);

            $("script, style, nav, header, footer, aside, .advertisement").remove();

            const contentSelectors = [
                "article",
                ".post-content",
                ".entry-content",
                ".article-content",
                "main",
                '[role="main"]',
            ];

            for (const selector of contentSelectors) {
                const content = $(selector).text().trim();
                if (content && content.length > 200) {
                    return this.cleanContent(content);
                }
            }

            const paragraphs = $("p")
                .map((_, el) => $(el).text().trim())
                .get()
                .filter((text) => text.length > 50)
                .join("\n\n");

            return this.cleanContent(paragraphs);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Error scraping external article ${url}:`, errorMessage);
            throw error;
        }
    }

    /**
     * Clean and normalize content
     * @param content Raw content
     * @returns Cleaned content
     */
    private cleanContent(content: string): string {
        return content
            .replace(/\s+/g, " ")
            .replace(/\n\s*\n/g, "\n\n")
            .trim();
    }
}

export default new ScraperService();