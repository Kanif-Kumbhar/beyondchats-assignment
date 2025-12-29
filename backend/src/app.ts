import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import articleRoutes from "./routes/article.routes";

dotenv.config();

class App {
	public app: Application;

	constructor() {
		this.app = express();
		this.config();
		this.routes();
		this.errorHandler();
	}

	private config(): void {

		this.app.use(cors());
		this.app.use(express.json({ limit: "10mb" }));
		this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

		this.app.use((req: Request, res: Response, next: NextFunction) => {
			console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
			next();
		});
	}

	private routes(): void {
		this.app.get("/health", (req: Request, res: Response) => {
			res.status(200).json({
				success: true,
				message: "Server is running",
				timestamp: new Date().toISOString(),
			});
		});

		this.app.use("/api/articles", articleRoutes);

		this.app.use((req: Request, res: Response) => {
			res.status(404).json({
				success: false,
				message: "Route not found",
			});
		});
	}

	private errorHandler(): void {
		this.app.use(
			(err: Error, req: Request, res: Response, next: NextFunction) => {
				console.error("Error:", err);

				res.status(500).json({
					success: false,
					message: "Internal server error",
					error:
						process.env.NODE_ENV === "development" ? err.message : undefined,
				});
			}
		);
	}
}

export default new App().app;