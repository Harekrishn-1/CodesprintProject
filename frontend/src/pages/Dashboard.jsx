import { useState, useEffect } from 'react';
import { NavLink } from 'react-router';
import { useSelector, useDispatch } from 'react-redux';
import { logoutUser } from '../authSlice';
import axiosClient from '../utils/axiosClient';
import UserAvatar from '../components/UserAvatar';

function Dashboard() {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [totalProblems, setTotalProblems] = useState(0);
  const [solved, setSolved] = useState([]);
  const [history, setHistory] = useState([]);
 


  const count = (d) => solved.filter((p) => p.difficulty === d).length;

  return (
    <div className="min-h-screen bg-base-200">
      {/* Navbar */}
     <div className="navbar bg-base-100 shadow-lg px-4">
        <div className="flex-1">
          <span className="btn btn-ghost text-xl">CodeSprint</span>
        </div>
        <div className="flex-none flex items-center gap-2">
          <NavLink to="/problems" className="btn btn-ghost btn-sm">Problems</NavLink>
          <NavLink to="/contest" className="btn btn-ghost btn-sm">Contest</NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin" className="btn btn-ghost btn-sm">Admin</NavLink>
          )}
          <UserAvatar />
        </div>
      </div>

      <div className="container mx-auto p-4 max-w-4xl">
        {/* Greeting + stats */}
        <div className="mt-6 mb-6">
          <h1 className="text-3xl font-bold">Welcome back, {user?.firstName}</h1>
          <p className="text-base-content/60">Pick up where you left off.</p>
        </div>

        <div className="stats stats-vertical sm:stats-horizontal shadow w-full mb-6">
          <div className="stat">
            <div className="stat-title">Solved</div>
            <div className="stat-value text-primary">{solved.length}<span className="text-lg text-base-content/50">/{totalProblems}</span></div>
          </div>
          <div className="stat">
            <div className="stat-title">Easy</div>
            <div className="stat-value text-success text-2xl">{count('easy')}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Medium</div>
            <div className="stat-value text-warning text-2xl">{count('medium')}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Hard</div>
            <div className="stat-value text-error text-2xl">{count('hard')}</div>
          </div>
        </div>

        {/* Contest hero */}
        <div className="card bg-primary text-primary-content shadow-xl mb-6">
          <div className="card-body sm:flex-row items-center justify-between">
            <div>
              <h2 className="card-title text-2xl">Revision Contest</h2>
              <p className="opacity-80">
             A timed contest built from problems you've already solved — the ones you solved longest ago come first.
              </p>
            </div>
            <NavLink to="/contest" className="btn btn-neutral btn-lg mt-4 sm:mt-0">
              Start Contest
            </NavLink>
          </div>
        </div>

        {/* Two columns: recent contests + quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title text-lg">Recent Contests</h2>
              {history.length === 0 ? (
                <p className="text-base-content/50 text-sm">No contests yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.slice(0, 5).map((c) => (
                    <div key={c._id} className="flex justify-between items-center border-b border-base-200 pb-2">
                      <div className="text-sm">
                        <div>{new Date(c.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • {c.durationMin} min</div>
                        <div className="text-base-content/50">{c.solvedCount}/{c.totalProblems} solved</div>
                      </div>
                      <span className="font-bold text-primary">{c.totalScore} pts</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title text-lg">Quick Actions</h2>
              <NavLink to="/problems" className="btn btn-outline justify-start">Browse Problems</NavLink>
              <NavLink to="/profile" className="btn btn-outline justify-start">My Profile</NavLink>
              {user?.role === 'admin' && (
                <NavLink to="/admin" className="btn btn-outline justify-start">Admin Panel</NavLink>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;