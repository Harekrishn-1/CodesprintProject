import { useState } from 'react';
import { NavLink } from 'react-router';
import axiosClient from '../utils/axiosClient';

/*
 * Bulk Problem Create:
 * - Ek JSON paste karo: single problem object YA problems ka array
 * - Har problem existing POST /problem/create se banti hai
 *   (matlab reference solutions Judge0 se validate hote hain — quality check built-in)
 * - Sequential chalta hai kyunki har create me Judge0 test cases chalata hai (few sec each)
 */
function AdminBulkCreate() {
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState('');
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);

  const parseJson = () => {
    setResults([]);
    try {
      const data = JSON.parse(raw);
      const list = Array.isArray(data) ? data : [data];
      // halka sa sanity check
      const bad = list.findIndex(p => !p.title || !p.description || !p.difficulty || !p.tags);
      if (bad !== -1) {
        setParsed(null);
        setParseError(`Problem #${bad + 1} me title/description/difficulty/tags me se kuch missing hai`);
        return;
      }
      setParsed(list);
      setParseError('');
    } catch (e) {
      setParsed(null);
      setParseError('JSON parse nahi hua: ' + e.message);
    }
  };

  const createAll = async () => {
    if (!parsed) return;
    setRunning(true);
    const out = [];
    for (const p of parsed) {
      out.push({ title: p.title, status: 'creating' });
      setResults([...out]);
      try {
        await axiosClient.post('/problem/create', p);
        out[out.length - 1] = { title: p.title, status: 'created' };
      } catch (err) {
        out[out.length - 1] = {
          title: p.title,
          status: 'failed',
          error: err.response?.data?.message || err.response?.data || 'Unknown error'
        };
      }
      setResults([...out]);
    }
    setRunning(false);
  };

  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow-lg px-4">
        <div className="flex-1">
          <NavLink to="/" className="btn btn-ghost text-xl">CodeSprint</NavLink>
        </div>
        <NavLink to="/admin" className="btn btn-ghost btn-sm">Admin Home</NavLink>
      </div>

      <div className="container mx-auto p-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">Bulk Create Problems</h1>
        <p className="text-base-content/60 mb-4">
          Paste one problem object or an array of problems in JSON format. Each problem's reference
          solutions are validated against its test cases before it is saved, so creation takes a few
          seconds per problem.
        </p>

        <textarea
          className="textarea textarea-bordered w-full font-mono text-sm"
          rows={14}
          placeholder='[ { "title": "...", "description": "...", "difficulty": "easy", "tags": "array", "visibleTestCases": [...], "hiddenTestCases": [...], "startCode": [...], "referenceSolution": [...] } ]'
          value={raw}
          onChange={(e) => { setRaw(e.target.value); setParsed(null); }}
        />

        {parseError && <div className="alert alert-error mt-3 text-sm">{parseError}</div>}

        <div className="flex gap-3 mt-4">
          <button className="btn btn-outline" onClick={parseJson} disabled={!raw.trim() || running}>
            Parse & Preview
          </button>
          <button className="btn btn-primary" onClick={createAll} disabled={!parsed || running}>
            {running ? <span className="loading loading-spinner"></span> : `Create ${parsed ? parsed.length : ''} Problem${parsed && parsed.length > 1 ? 's' : ''}`}
          </button>
        </div>

        {parsed && !results.length && (
          <div className="card bg-base-100 shadow mt-4">
            <div className="card-body py-4">
              <h2 className="font-semibold">Preview — {parsed.length} problem(s)</h2>
              <ul className="text-sm text-base-content/70">
                {parsed.map((p, i) => (
                  <li key={i}>{i + 1}. {p.title} — {p.difficulty} / {p.tags} — {p.visibleTestCases?.length || 0} visible, {p.hiddenTestCases?.length || 0} hidden cases</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="card bg-base-100 shadow mt-4">
            <div className="card-body py-4 space-y-2">
              <h2 className="font-semibold">Results</h2>
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between border-b border-base-200 pb-2 text-sm">
                  <span>{r.title}</span>
                  {r.status === 'creating' && <span className="loading loading-spinner loading-xs"></span>}
                  {r.status === 'created' && <span className="badge badge-success badge-sm">Created</span>}
                  {r.status === 'failed' && (
                    <span className="badge badge-error badge-sm" title={String(r.error)}>Failed</span>
                  )}
                </div>
              ))}
              {results.some(r => r.status === 'failed') && (
                <p className="text-error text-xs">
                  Failed problems: hover the badge for the reason (usually a reference solution not passing its test cases).
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminBulkCreate;