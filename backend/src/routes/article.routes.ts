import { Router } from "express";
import articleController from "../controllers/article.controller";

const router = Router();

router.post("/scrape", articleController.scrapeAndStore);

router.get("/", articleController.getAllArticles);
router.get("/:id", articleController.getArticleById);
router.post("/", articleController.createArticle);
router.put("/:id", articleController.updateArticle);
router.delete("/:id", articleController.deleteArticle);

export default router;