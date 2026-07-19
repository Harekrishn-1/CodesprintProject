const Contest = require('../models/contest');
const Submission = require('../models/submission');

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
const startContest = async (req, res) => {
  try {
    const userId = req.result._id;

    const durationMin = Number(req.body.durationMin);
    if (!CONTEST_PLAN[durationMin]) {
      return res.status(400).json({ message: 'durationMin 30, 60 ya 90 hona chahiye' });
    }

    // pehle se ongoing contest hai?
    const existing = await Contest.findOne({ userId, status: 'ongoing' });
    if (existing) {
      // time nikal chuka ho to auto-finish karke naya banne do
      if (isTimeOver(existing)) {
        existing.status = 'finished';
        await existing.save();
      } else {
        return res.status(200).json({ message: 'Ongoing contest already exists', contest: existing });
      }
    }

    const plan = CONTEST_PLAN[durationMin];
    const selected = await selectRevisionProblems(userId, plan);

    const minRequired = 3;
    if (selected.length < minRequired) {
      return res.status(400).json({
        message: `Revision contest ke liye kam se kam ${minRequired} solved problems chahiye. Pehle kuch problems solve karo!`
      });
    }

    const contest = await Contest.create({
      userId,
      durationMin,
      problems: selected.map((p) => ({
        problemId: p.problemId,
        firstSolvedAt: p.firstSolvedAt
      }))
    });

    res.status(201).json({ message: 'Contest started', contest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Contest start karne me error aaya' });
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
      daysSinceFirstSolved: Math.floor((Date.now() - p.firstSolvedAt.getTime()) / (1000 * 60 * 60 * 24))
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
  getContestHistory
};