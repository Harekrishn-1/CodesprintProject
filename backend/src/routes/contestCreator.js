const express = require('express');
const contestRouter = express.Router();
const userMiddleware = require("../middleware/userMiddleware");
const { startContest, getCurrentContest, finishContest , getContestHistory} = require("../controllers/userContest");

contestRouter.post("/start", userMiddleware, startContest);
contestRouter.get("/current", userMiddleware, getCurrentContest);
contestRouter.post("/finish", userMiddleware, finishContest);
contestRouter.get("/history", userMiddleware, getContestHistory);

module.exports = contestRouter;