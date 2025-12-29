import mongoose from "mongoose";

class Database {
	async connect(): Promise<void> {
		try {
			const mongoUri =
				process.env.MONGODB_URI || "mongodb://localhost:27017/beyondchats";

			await mongoose.connect(mongoUri);

			console.log("✅ MongoDB connected successfully");

			mongoose.connection.on("error", (error) => {
				console.error("MongoDB connection error:", error);
			});

			mongoose.connection.on("disconnected", () => {
				console.log("MongoDB disconnected");
			});
		} catch (error) {
			console.error("Failed to connect to MongoDB:", error);
			process.exit(1);
		}
	}

	async disconnect(): Promise<void> {
		await mongoose.connection.close();
	}
}

export default new Database();