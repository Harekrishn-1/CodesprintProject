import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router';
import axiosClient from '../utils/axiosClient';

// seconds → "mm:ss"
const fmt = (sec) => {
  if (sec == null) return '--:--';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const difficultyBadge = {
  easy: 'badge-success',
  medium: 'badge-warning',
  hard: 'badge-error'
};

function ContestPage() {
  const [view, setView] = useState('loading'); // loading | start | ongoing | finished
  const [contest, setContest] = useState(null);
  const [remainingSec, setRemainingSec] = useState(null);
  const [results, setResults] = useState(null);
  const [starting, setStarting] = useState(false);
  const finishingRef = useRef(false);

  // ongoing contest lao (page khulte hi)
  const fetchCurrent = async () => {
    try {
        const { data } = await axiosClient.get('/contest/current');
        if (!data.contest) {
        setView('start');
        return;
      }
      if (data.contest.status === 'finished') {
        // time over ho chuka tha — seedha results dikha do
        await finishContest();
        return;
      }
      setContest(data.contest);
      setRemainingSec(data.remainingSec);
      setView('ongoing');
    } catch (err) {
      if (err.response?.status === 404) setView('start');
      else setView('start'); // error pe bhi start dikhao, wahan se retry ho jayega
    }
  };

  useEffect(() => {
    fetchCurrent();
  }, []);

  // TIMER: har second ghatao; 0 pe auto-finish
  useEffect(() => {
    if (view !== 'ongoing' || remainingSec == null) return;
    const t = setInterval(() => {
      setRemainingSec((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [view, remainingSec == null]);

  useEffect(() => {
    if (view === 'ongoing' && remainingSec === 0 && !finishingRef.current) {
      finishContest();
    }
  }, [remainingSec, view]);

  // har 15 second me score refresh (dusre tab me solve karke aaya to yahan ✅ dikhe)
  useEffect(() => {
    if (view !== 'ongoing') return;
    const t = setInterval(async () => {
      try {
          const { data } = await axiosClient.get('/contest/current');
          if (!data.contest) return;
        if (data.contest.status === 'finished') {
          finishContest();
        } else {
          setContest(data.contest);
          setRemainingSec(data.remainingSec); // server ke time se sync
        }
      } catch (e) { /* network hiccup — agla poll sambhal lega */ }
    }, 15000);
    return () => clearInterval(t);
  }, [view]);

  const startContest = async (durationMin) => {
    try {
      setStarting(true);
      await axiosClient.post('/contest/start', { durationMin });
      await fetchCurrent();
    } catch (err) {
      alert(err.response?.data?.message || 'Contest start nahi ho paya');
    } finally {
      setStarting(false);
    }
  };

  const finishContest = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    try {
      const { data } = await axiosClient.post('/contest/finish');
      setResults(data);
      setView('finished');
    } catch (err) {
      // ongoing tha hi nahi (kahin aur se finish hua) — start pe bhej do
      setView('start');
    } finally {
      finishingRef.current = false;
    }
  };

  // ---------- VIEWS ----------

  if (view === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      {/* Navbar */}
      <div className="navbar bg-base-100 shadow-lg px-4">
        <div className="flex-1">
          <NavLink to="/" className="btn btn-ghost text-xl">CodeSprint</NavLink>
        </div>
        {view === 'ongoing' && (
          <div className="flex-none">
            <span className={`font-mono text-2xl font-bold ${remainingSec < 300 ? 'text-error' : ''}`}>
            {fmt(remainingSec)}
            </span>
          </div>
        )}
      </div>

      <div className="container mx-auto p-4 max-w-3xl">

        {/* ---------- START VIEW ---------- */}
        {view === 'start' && (
          <div className="card bg-base-100 shadow-xl mt-10">
            <div className="card-body items-center text-center">
              <h1 className="card-title text-3xl mb-2">Revision Contest</h1>
              <p className="text-base-content/70 mb-1">
                A timed contest from problems you've already solved. Older solves come first, mixed across topics and difficulty.
              </p>
              <p className="text-base-content/50 text-sm mb-6">
                Practice a mixed set of problems with varying tags and difficulty levels. Solve them within the given time!
              </p>
              <div className="flex gap-4 flex-wrap justify-center">
                {[{ min: 30, label: '30 min • 3 problems' },
                  { min: 60, label: '60 min • 5 problems' },
                  { min: 90, label: '90 min • 6 problems' }].map((opt) => (
                  <button
                    key={opt.min}
                    className="btn btn-primary btn-lg"
                    disabled={starting}
                    onClick={() => startContest(opt.min)}
                  >
                    {starting ? <span className="loading loading-spinner"></span> : opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ---------- ONGOING VIEW ---------- */}
        {view === 'ongoing' && contest && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-2xl font-bold">Revision Contest</h1>
                <p className="text-base-content/60 text-sm">
                  Score: <span className="font-bold text-primary">{contest.totalScore}</span>
                  {' '}• Solved: {contest.problems.filter(p => p.solved).length}/{contest.problems.length}
                </p>
              </div>
              <button className="btn btn-outline btn-error btn-sm" onClick={finishContest}>
                End Contest
              </button>
            </div>

            <div className="space-y-3">
              {contest.problems.map((p, idx) => (
                <div key={p._id} className={`card bg-base-100 shadow ${p.solved ? 'border border-success' : ''}`}>
                  <div className="card-body py-4 flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-semibold">{idx + 1}. {p.problemId?.title}</div>
                        <div className="flex gap-2 mt-1">
                          <span className={`badge badge-sm ${difficultyBadge[p.problemId?.difficulty] || ''}`}>
                            {p.problemId?.difficulty}
                          </span>
                          <span className="badge badge-sm badge-ghost">{p.problemId?.tags}</span>
                          {p.solved && (
                            <span className="badge badge-sm badge-success badge-outline">
                              +{p.points} pts • {fmt(p.solveTimeSec)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {!p.solved && (
                      <a
                        href={`/problem/${p.problemId?._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm"
                      >
                        Solve
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-base-content/50 text-sm mt-4">
              Problems open in a new tab. Your score updates automatically after each accepted submission.
            </p>
          </div>
        )}

        {/* ---------- RESULTS VIEW ---------- */}
        {view === 'finished' && results && (
          <div className="mt-6">
            <div className="card bg-base-100 shadow-xl mb-6">
              <div className="card-body items-center text-center">
                <h1 className="card-title text-3xl">Contest Finished</h1>
                <div className="stats stats-vertical sm:stats-horizontal shadow mt-4">
                  <div className="stat">
                    <div className="stat-title">Total Score</div>
                    <div className="stat-value text-primary">{results.totalScore}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Solved</div>
                    <div className="stat-value">{results.solvedCount}/{results.totalProblems}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {results.results.map((r, idx) => (
                <div key={idx} className="card bg-base-100 shadow">
                  <div className="card-body py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-semibold">{r.title}</div>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            <span className={`badge badge-sm ${difficultyBadge[r.difficulty] || ''}`}>{r.difficulty}</span>
                            <span className="badge badge-sm badge-ghost">{r.tag}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        {r.solved ? (
                          <>
                            <div className="font-bold text-success">+{r.points} pts</div>
                            <div className="text-base-content/60">{fmt(r.solveTimeSec)} me solve</div>
                          </>
                        ) : (
                          <div className="text-base-content/50">Not solved</div>
                        )}
                        <div className="text-base-content/40 text-xs mt-1">
                          First Time Solved {r.daysSinceFirstSolved} days before
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-6 flex gap-3 justify-center">
              <button className="btn btn-primary" onClick={() => { setResults(null); setView('start'); }}>
                New Contest
              </button>
              <NavLink to="/" className="btn btn-ghost">Home</NavLink>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ContestPage;