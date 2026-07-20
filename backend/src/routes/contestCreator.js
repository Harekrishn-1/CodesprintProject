const express = require('express');
const contestRouter = express.Router();
const userMiddleware = require("../middleware/userMiddleware");
const { startContest, getCurrentContest, finishContest , getContestHistory,getUnsolvedProblems} = require("../controllers/userContest");

contestRouter.post("/start", userMiddleware, startContest);
contestRouter.get("/current", userMiddleware, getCurrentContest);
contestRouter.post("/finish", userMiddleware, finishContest);
contestRouter.get("/history", userMiddleware, getContestHistory);
contestRouter.get("/unsolved", userMiddleware, getUnsolvedProblems);

module.exports = contestRouter;