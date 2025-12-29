import mongoose, { Document, Schema } from "mongoose";

export interface IArticle extends Document {
	title: string;
	content: string;
	excerpt?: string;
	author?: string;
	publishedDate?: Date;
	url: string;
	scrapedAt: Date;
	isOriginal: boolean;
	originalArticleId?: mongoose.Types.ObjectId;
	updatedContent?: string;
	references?: Array<{
		title: string;
		url: string;
	}>;
	metadata?: {
		wordCount?: number;
		readingTime?: number;
	};
}

const ArticleSchema: Schema = new Schema(
	{
		title: {
			type: String,
			required: true,
			trim: true,
			index: true,
		},
		content: {
			type: String,
			required: true,
		},
		excerpt: {
			type: String,
			trim: true,
		},
		author: {
			type: String,
			trim: true,
		},
		publishedDate: {
			type: Date,
		},
		url: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		scrapedAt: {
			type: Date,
			default: Date.now,
		},
		isOriginal: {
			type: Boolean,
			default: true,
		},
		originalArticleId: {
			type: Schema.Types.ObjectId,
			ref: "Article",
		},
		updatedContent: {
			type: String,
		},
		references: [
			{
				title: String,
				url: String,
			},
		],
		metadata: {
			wordCount: Number,
			readingTime: Number,
		},
	},
	{
		timestamps: true,
	}
);

ArticleSchema.index({ isOriginal: 1, createdAt: -1 });
ArticleSchema.index({ originalArticleId: 1 });

export default mongoose.model<IArticle>("Article", ArticleSchema);