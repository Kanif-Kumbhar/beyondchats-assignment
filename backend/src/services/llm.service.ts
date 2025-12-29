import { InferenceClient } from "@huggingface/inference";

interface ContentOptimizationRequest {
	originalTitle: string;
	originalContent: string;
	referenceArticles: Array<{
		title: string;
		content: string;
		url: string;
	}>;
}

interface ContentOptimizationResponse {
	optimizedContent: string;
	suggestedTitle?: string;
}

class LLMService {
	private hf: InferenceClient;
	private readonly model = "mistralai/Mixtral-8x7B-Instruct-v0.1";

	constructor() {
		const apiKey = process.env.HUGGING_FACE_API_KEY || "";

		if (!apiKey) {
			console.warn("⚠️  Hugging Face API key not configured");
		}

		this.hf = new InferenceClient(apiKey);
	}

	async optimizeContent(
		request: ContentOptimizationRequest
	): Promise<ContentOptimizationResponse> {
		try {
			const prompt = this.buildOptimizationPrompt(request);

			console.log("🤖 Sending request to Hugging Face API...");

			const response = await this.hf.textGeneration({
				model: this.model,
				inputs: prompt,
				parameters: {
					max_new_tokens: 2048,
					temperature: 0.7,
					top_p: 0.95,
					repetition_penalty: 1.1,
					return_full_text: false,
				},
			});

			const optimizedContent = response.generated_text.trim();

			console.log("✅ Content optimized successfully");

			return {
				optimizedContent,
			};
		} catch (error: any) {
			console.error("LLM optimization error:", error.message);

			if (error.message?.includes("rate limit")) {
				throw new Error(
					"Rate limit exceeded. Please wait a moment and try again."
				);
			}

			throw new Error(`Failed to optimize content: ${error.message}`);
		}
	}

	private buildOptimizationPrompt(request: ContentOptimizationRequest): string {
		const { originalTitle, originalContent, referenceArticles } = request;

		let prompt = `<s>[INST] You are an expert content writer and SEO specialist. Your task is to rewrite and optimize the following article to match the style and quality of top-ranking articles.

## Original Article
Title: ${originalTitle}

Content:
${originalContent.substring(0, 2000)}${
			originalContent.length > 2000 ? "..." : ""
		}

## Reference Articles (Top-Ranking Examples)

`;

		referenceArticles.forEach((article, index) => {
			prompt += `### Reference ${index + 1}: ${article.title}
Source: ${article.url}
Content Preview:
${article.content.substring(0, 800)}...

`;
		});

		prompt += `## Your Task

Rewrite the original article with these improvements:
1. Match the professional writing style of the reference articles
2. Improve structure with clear headings and sections
3. Make it more engaging and SEO-friendly
4. Keep the core message intact
5. Use markdown formatting (headings, lists, emphasis)
6. Make it approximately the same length or longer

Write ONLY the optimized article content. Do NOT include references section - that will be added separately.

Start writing the optimized article now: [/INST]

`;

		return prompt;
	}

	async optimizeContentFast(
		request: ContentOptimizationRequest
	): Promise<ContentOptimizationResponse> {
		try {
			const prompt = this.buildOptimizationPrompt(request);

			// Use Mistral-7B for faster, free-tier friendly processing
			const response = await this.hf.textGeneration({
				model: "mistralai/Mistral-7B-Instruct-v0.2",
				inputs: prompt,
				parameters: {
					max_new_tokens: 1500,
					temperature: 0.7,
					top_p: 0.9,
					return_full_text: false,
				},
			});

			return {
				optimizedContent: response.generated_text.trim(),
			};
		} catch (error: any) {
			console.error("Fast optimization error:", error.message);
			throw error;
		}
	}

	async optimizeContentFallback(
		request: ContentOptimizationRequest
	): Promise<ContentOptimizationResponse> {
		try {
			const { originalContent, referenceArticles } = request;

			const prompt = `Rewrite this article in a professional, engaging style similar to top blog posts:\n\n${originalContent.substring(
				0,
				1500
			)}`;

			const response = await this.hf.textGeneration({
				model: "google/flan-t5-xxl",
				inputs: prompt,
				parameters: {
					max_new_tokens: 1024,
					temperature: 0.8,
				},
			});

			return {
				optimizedContent: response.generated_text.trim(),
			};
		} catch (error: any) {
			console.error("Fallback optimization error:", error.message);
			throw error;
		}
	}

	async testConnection(): Promise<boolean> {
		try {
			const response = await this.hf.textGeneration({
				model: this.model,
				inputs: "Hello, world!",
				parameters: {
					max_new_tokens: 10,
				},
			});

			console.log("✅ Hugging Face API connection successful");
			return true;
		} catch (error: any) {
			console.error("❌ Hugging Face API connection failed:", error.message);
			return false;
		}
	}
}

export default new LLMService();