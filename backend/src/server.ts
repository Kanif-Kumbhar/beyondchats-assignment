import app from "./app";
import database from "./config/database";

const PORT = process.env.PORT || 5000;

async function startServer() {
	try {
		await database.connect();

		app.listen(PORT, () => {
			console.log(`🚀 Server running on port ${PORT}`);
			console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
		});
	} catch (error) {
		console.error("Failed to start server:", error);
		process.exit(1);
	}
}

startServer();

process.on("SIGTERM", async () => {
	console.log("SIGTERM received, shutting down gracefully");
	await database.disconnect();
	process.exit(0);
});

process.on("SIGINT", async () => {
	console.log("SIGINT received, shutting down gracefully");
	await database.disconnect();
	process.exit(0);
});