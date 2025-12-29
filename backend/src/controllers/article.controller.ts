import { Request, Response } from "express";
import Article from "../models/Article";
import scraperService from "../services/scraper.service";

const getErrorMessage = (error: unknown): string => {
	if (error instanceof Error) return error.message;
	return String(error);
};

class ArticleController {
	/**
	 * Scrape and store articles
	 * POST /api/articles/scrape
	 */
	async scrapeAndStore(req: Request, res: Response): Promise<void> {
		try {
			const { limit = 5 } = req.body;

			const scrapedArticles = await scraperService.scrapeArticles(limit);

			const savedArticles = [];
			const errors = [];

			for (const articleData of scrapedArticles) {
				try {
					const existingArticle = await Article.findOne({
						url: articleData.url,
					});

					if (existingArticle) {
						errors.push({
							url: articleData.url,
							message: "Article already exists",
						});
						continue;
					}

					// Calculate metadata
					const wordCount = articleData.content.split(/\s+/).length;
					const readingTime = Math.ceil(wordCount / 200); // Avg reading speed: 200 wpm

					const article = new Article({
						...articleData,
						isOriginal: true,
						metadata: {
							wordCount,
							readingTime,
						},
					});

					await article.save();
					savedArticles.push(article);
				} catch (error) {
					errors.push({
						url: articleData.url,
						message: getErrorMessage(error),
					});
				}
			}

			res.status(201).json({
				success: true,
				message: `Successfully scraped and stored ${savedArticles.length} articles`,
				data: {
					articles: savedArticles,
					errors: errors.length > 0 ? errors : undefined,
				},
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				message: "Failed to scrape articles",
				error: getErrorMessage(error),
			});
		}
	}

	/**
	 * Get all articles
	 * GET /api/articles
	 */
	async getAllArticles(req: Request, res: Response): Promise<void> {
		try {
			const {
				page = 1,
				limit = 10,
				isOriginal,
				sortBy = "createdAt",
				order = "desc",
			} = req.query;

			const pageNum = parseInt(page as string);
			const limitNum = parseInt(limit as string);
			const skip = (pageNum - 1) * limitNum;

			const filter: any = {};
			if (isOriginal !== undefined) {
				filter.isOriginal = isOriginal === "true";
			}

			const sortOrder = order === "asc" ? 1 : -1;
			const sortOptions: any = { [sortBy as string]: sortOrder };

			const [articles, total] = await Promise.all([
				Article.find(filter)
					.sort(sortOptions)
					.skip(skip)
					.limit(limitNum)
					.populate("originalArticleId", "title url"),
				Article.countDocuments(filter),
			]);

			res.status(200).json({
				success: true,
				data: {
					articles,
					pagination: {
						currentPage: pageNum,
						totalPages: Math.ceil(total / limitNum),
						totalItems: total,
						itemsPerPage: limitNum,
					},
				},
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				message: "Failed to fetch articles",
				error: getErrorMessage(error),
			});
		}
	}

	/**
	 * Get article by ID
	 * GET /api/articles/:id
	 */
	async getArticleById(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;

			const article = await Article.findById(id).populate(
				"originalArticleId",
				"title url"
			);

			if (!article) {
				res.status(404).json({
					success: false,
					message: "Article not found",
				});
				return;
			}

			let updatedVersions = [];
			if (article.isOriginal) {
				updatedVersions = await Article.find({
					originalArticleId: article._id,
				}).select("title updatedContent references createdAt");
			}

			res.status(200).json({
				success: true,
				data: {
					article,
					updatedVersions:
						updatedVersions.length > 0 ? updatedVersions : undefined,
				},
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				message: "Failed to fetch article",
				error: getErrorMessage(error),
			});
		}
	}

	/**
	 * Create new article
	 * POST /api/articles
	 */
	async createArticle(req: Request, res: Response): Promise<void> {
		try {
			const articleData = req.body;

			const wordCount = articleData.content?.split(/\s+/).length || 0;
			const readingTime = Math.ceil(wordCount / 200);

			const article = new Article({
				...articleData,
				metadata: {
					wordCount,
					readingTime,
				},
			});

			await article.save();

			res.status(201).json({
				success: true,
				message: "Article created successfully",
				data: article,
			});
		} catch (error) {
			res.status(400).json({
				success: false,
				message: "Failed to create article",
				error: getErrorMessage(error),
			});
		}
	}

	/**
	 * Update article
	 * PUT /api/articles/:id
	 */
	async updateArticle(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const updates = req.body;

			if (updates.content || updates.updatedContent) {
				const content = updates.updatedContent || updates.content;
				const wordCount = content.split(/\s+/).length;
				const readingTime = Math.ceil(wordCount / 200);

				updates.metadata = {
					wordCount,
					readingTime,
				};
			}

			const article = await Article.findByIdAndUpdate(id, updates, {
				new: true,
				runValidators: true,
			});

			if (!article) {
				res.status(404).json({
					success: false,
					message: "Article not found",
				});
				return;
			}

			res.status(200).json({
				success: true,
				message: "Article updated successfully",
				data: article,
			});
		} catch (error) {
			res.status(400).json({
				success: false,
				message: "Failed to update article",
				error: getErrorMessage(error),
			});
		}
	}

	/**
	 * Delete article
	 * DELETE /api/articles/:id
	 */
	async deleteArticle(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;

			const article = await Article.findByIdAndDelete(id);

			if (!article) {
				res.status(404).json({
					success: false,
					message: "Article not found",
				});
				return;
			}

			if (article.isOriginal) {
				await Article.deleteMany({ originalArticleId: id });
			}

			res.status(200).json({
				success: true,
				message: "Article deleted successfully",
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				message: "Failed to delete article",
				error: getErrorMessage(error),
			});
		}
	}
}

export default new ArticleController();