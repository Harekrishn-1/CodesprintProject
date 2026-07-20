const Contest = require('../models/contest');
const Submission = require('../models/submission');
const Problem = require('../models/problem');

// Duration ke hisaab se kitni problems aur kaunsa difficulty mix
const CONTEST_PLAN = {
  30: { easy: 2, medium: 1, hard: 0 },  // 3 problems
  60: { easy: 2, medium: 2, hard: 1 },  // 5 problems
  90: { easy: 2, medium: 3, hard: 1 }   // 6 problems
};

const POINTS = { easy: 10, medium: 20, hard: 30 };

/*
 * SELECTION ALGORITHM (revision ka dil yahi hai):
 * 1. User ki saari ACCEPTED submissions utha
 * 2. Problem-wise group kar — har problem ka FIRST solve date nikaal
 * 3. Jo sabse PURANI solve hui thi wo pehle aaye (wahi to bhool chuka hoga)
 * 4. Difficulty buckets me baant, plan ke hisaab se utha
 * 5. Tag variety: ek hi tag ki problem repeat na ho jab tak majboori na ho
 */
const selectRevisionProblems = async (userId, plan) => {
  const solvedProblems = await Submission.aggregate([
    { $match: { userId: userId, status: 'accepted' } },
    {
      $group: {
        _id: '$problemId',
        firstSolvedAt: { $min: '$createdAt' }
      }
    },
    { $sort: { firstSolvedAt: 1 } },
    {
      $lookup: {
        from: 'problems',
        localField: '_id',
        foreignField: '_id',
        as: 'problem'
      }
    },
    { $unwind: '$problem' },
    {
      $project: {
        problemId: '$_id',
        firstSolvedAt: 1,
        difficulty: '$problem.difficulty',
        tag: '$problem.tags'
      }
    }
  ]);

  const buckets = { easy: [], medium: [], hard: [] };
  solvedProblems.forEach((p) => {
    if (buckets[p.difficulty]) buckets[p.difficulty].push(p);
  });

  const selected = [];
  const usedTags = new Set();

  const pickFromBucket = (bucket, count) => {
    for (const p of bucket) {
      if (count <= 0) break;
      if (!usedTags.has(p.tag) && !selected.find(s => String(s.problemId) === String(p.problemId))) {
        selected.push(p);
        usedTags.add(p.tag);
        count--;
      }
    }
    for (const p of bucket) {
      if (count <= 0) break;
      if (!selected.find(s => String(s.problemId) === String(p.problemId))) {
        selected.push(p);
        count--;
      }
    }
    return count;
  };

  let shortfall = 0;
  shortfall += pickFromBucket(buckets.easy, plan.easy);
  shortfall += pickFromBucket(buckets.medium, plan.medium);
  shortfall += pickFromBucket(buckets.hard, plan.hard);

  if (shortfall > 0) {
    const leftovers = [...buckets.medium, ...buckets.easy, ...buckets.hard];
    for (const p of leftovers) {
      if (shortfall <= 0) break;
      if (!selected.find(s => String(s.problemId) === String(p.problemId))) {
        selected.push(p);
        shortfall--;
      }
    }
  }

  return selected;
};

// PRACTICE MODE: unsolved problems, random mix (asli contest jaisa feel)
const selectPracticeProblems = async (userId, plan) => {
  // user ne jo solve kar li hain wo nikal do
  const solvedIds = await Submission.distinct('problemId', { userId, status: 'accepted' });

  const pickByDifficulty = async (difficulty, count) => {
    if (count <= 0) return [];
    return await Problem.aggregate([
      { $match: { _id: { $nin: solvedIds }, difficulty } },
      { $sample: { size: count } },          // random selection
      { $project: { problemId: '$_id', difficulty: 1, tag: '$tags' } }
    ]);
  };

  const selected = [
    ...(await pickByDifficulty('easy', plan.easy)),
    ...(await pickByDifficulty('medium', plan.medium)),
    ...(await pickByDifficulty('hard', plan.hard))
  ];

  // practice me firstSolvedAt hota hi nahi — abhi tak solve nahi ki
  return selected.map(p => ({ ...p, firstSolvedAt: null }));
};

// Contest ka time khatam ho gaya? (server time se — refresh/band-khol se timer nahi tootta)
const isTimeOver = (contest) => {
  const endTime = contest.startTime.getTime() + contest.durationMin * 60 * 1000;
  return Date.now() >= endTime;
};

const remainingSeconds = (contest) => {
  const endTime = contest.startTime.getTime() + contest.durationMin * 60 * 1000;
  return Math.max(0, Math.floor((endTime - Date.now()) / 1000));
};

// POST /contest/start   body: { durationMin: 30 | 60 | 90 }
// POST /contest/start   body: { durationMin, mode, problemIds? }
const startContest = async (req, res) => {
  try {
    const userId = req.result._id;
    const mode = req.body.mode === 'practice' ? 'practice' : 'revision';
    const durationMin = Number(req.body.durationMin);
    const problemIds = Array.isArray(req.body.problemIds) ? req.body.problemIds : null;

    // Revision: fixed slots. Practice: koi bhi duration 5-180 min
    if (mode === 'revision' && !CONTEST_PLAN[durationMin]) {
      return res.status(400).json({ message: 'Duration must be 30, 60 or 90 minutes' });
    }
    if (mode === 'practice' && (!durationMin || durationMin < 5 || durationMin > 180)) {
      return res.status(400).json({ message: 'Duration must be between 5 and 180 minutes' });
    }

    const existing = await Contest.findOne({ userId, status: 'ongoing' });
    if (existing) {
      if (isTimeOver(existing)) {
        existing.status = 'finished';
        await existing.save();
      } else {
        return res.status(200).json({ message: 'Ongoing contest already exists', contest: existing });
      }
    }

    let selected;

    if (mode === 'practice' && problemIds && problemIds.length > 0) {
      // User ne khud problems chuni hain
      if (problemIds.length > 10) {
        return res.status(400).json({ message: 'Please select at most 10 problems' });
      }
      const problems = await Problem.find({ _id: { $in: problemIds } }).select('_id');
      selected = problems.map((p) => ({ problemId: p._id, firstSolvedAt: null }));
    } else {
      // Auto pick
      const plan = CONTEST_PLAN[durationMin] || { easy: 2, medium: 2, hard: 1 };
      selected = mode === 'practice'
        ? await selectPracticeProblems(userId, plan)
        : await selectRevisionProblems(userId, plan);
    }

    if (selected.length < 1) {
      return res.status(400).json({
        message: mode === 'practice'
          ? 'No unsolved problems available. Add more problems or try revision mode.'
          : 'You need at least 3 solved problems for a revision contest. Solve a few first!'
      });
    }
    if (mode === 'revision' && selected.length < 3) {
      return res.status(400).json({ message: 'You need at least 3 solved problems for a revision contest.' });
    }

    const contest = await Contest.create({
      userId,
      durationMin,
      mode,
      problems: selected.map((p) => ({
        problemId: p.problemId,
        firstSolvedAt: p.firstSolvedAt
      }))
    });

    res.status(201).json({ message: 'Contest started', contest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not start contest' });
  }
};

// GET /contest/current  → ongoing contest + bacha hua time (problems ki details ke saath)
const getCurrentContest = async (req, res) => {
  try {
    const userId = req.result._id;

    const contest = await Contest.findOne({ userId, status: 'ongoing' })
      .populate('problems.problemId', 'title difficulty tags');

    if (!contest) {
      return res.status(200).json({ contest: null });
    }

    // time khatam? to auto-finish kar do
    if (isTimeOver(contest)) {
      contest.status = 'finished';
      await contest.save();
      return res.status(200).json({
        message: 'Contest time over — finished',
        contest,
        remainingSec: 0
      });
    }

    res.status(200).json({
      message: 'Ongoing contest',
      contest,
      remainingSec: remainingSeconds(contest)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Contest fetch karne me error aaya' });
  }
};

// POST /contest/finish  → contest khatam + results
const finishContest = async (req, res) => {
  try {
    const userId = req.result._id;

    const contest = await Contest.findOne({ userId, status: 'ongoing' });
    if (!contest) {
      return res.status(404).json({ message: 'Koi ongoing contest nahi hai' });
    }

    contest.status = 'finished';
    await contest.save();

    const finished = await Contest.findById(contest._id)
      .populate('problems.problemId', 'title difficulty tags');

    // results: har problem ka haal + kitne din pehle pehli baar solve ki thi
    const results = finished.problems.map((p) => ({
      title: p.problemId?.title,
      difficulty: p.problemId?.difficulty,
      tag: p.problemId?.tags,
      solved: p.solved,
      solveTimeSec: p.solveTimeSec,
      attempts: p.attempts,
      points: p.points,
       daysSinceFirstSolved: p.firstSolvedAt
        ? Math.floor((Date.now() - p.firstSolvedAt.getTime()) / (1000 * 60 * 60 * 24))
        : null
    }));

    res.status(200).json({
      message: 'Contest finished',
      totalScore: finished.totalScore,
      solvedCount: results.filter(r => r.solved).length,
      totalProblems: results.length,
      results
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Contest finish karne me error aaya' });
  }
};

// GET /contest/history → pichhle finished contests (dashboard/profile ke liye)
const getContestHistory = async (req, res) => {
  try {
    const userId = req.result._id;
    const contests = await Contest.find({ userId, status: 'finished' })
      .sort({ createdAt: -1 })
      .limit(10);

    const history = contests.map((c) => ({
      _id: c._id,
      date: c.createdAt,
      durationMin: c.durationMin,
      totalScore: c.totalScore,
      solvedCount: c.problems.filter((p) => p.solved).length,
      totalProblems: c.problems.length
    }));

    res.status(200).json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'History fetch me error' });
  }
};

// GET /contest/unsolved → jo problems user ne solve nahi ki (practice picker ke liye)
const getUnsolvedProblems = async (req, res) => {
  try {
    const userId = req.result._id;
    const solvedIds = await Submission.distinct('problemId', { userId, status: 'accepted' });
    const problems = await Problem.find({ _id: { $nin: solvedIds } })
      .select('_id title difficulty tags')
      .sort({ difficulty: 1 });
    res.status(200).json(problems);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not fetch problems' });
  }
};

/*
 * HOOK — submitCode ise call karega har submission ke baad.
 * Kabhi throw nahi karta: contest me kuch bhi gadbad ho,
 * normal submission pe koi asar nahi padna chahiye.
 */
const updateContestOnSubmission = async (userId, problemId, accepted) => {
  try {
    const contest = await Contest.findOne({
      userId,
      status: 'ongoing',
      'problems.problemId': problemId
    }).populate('problems.problemId', 'difficulty');

    if (!contest) return;          // ye problem kisi ongoing contest me nahi
    if (isTimeOver(contest)) {     // time nikal gaya — ab ginti nahi hogi
      contest.status = 'finished';
      await contest.save();
      return;
    }

    const entry = contest.problems.find(
      (p) => String(p.problemId._id) === String(problemId)
    );
    if (!entry || entry.solved) return;  // already solved to dobara points nahi

    entry.attempts += 1;

    if (accepted) {
      entry.solved = true;
      entry.solveTimeSec = Math.floor((Date.now() - contest.startTime.getTime()) / 1000);
      entry.points = POINTS[entry.problemId.difficulty] || 10;
      contest.totalScore += entry.points;
    }

    await contest.save();
  } catch (err) {
    console.error('Contest hook error (submission safe hai):', err);
  }
};

module.exports = {
  startContest,
  getCurrentContest,
  finishContest,
  updateContestOnSubmission,
    selectRevisionProblems,
  getContestHistory,
  getUnsolvedProblems
};