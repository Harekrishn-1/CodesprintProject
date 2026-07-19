import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router';
import { useSelector } from 'react-redux';
import axios from 'axios';
import axiosClient from '../utils/axiosClient';

const badge = { easy: 'badge-success', medium: 'badge-warning', hard: 'badge-error' };

function Profile() {
  const { user: authUser } = useSelector((state) => state.auth);
  const [profile, setProfile] = useState(null);   // fresh user data (photo, lastName samet)
  const [solved, setSolved] = useState([]);
  const [history, setHistory] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', age: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    axiosClient.get('/user/check')
      .then(({ data }) => {
        setProfile(data.user);
        setForm({
          firstName: data.user.firstName || '',
          lastName: data.user.lastName || '',
          age: data.user.age || ''
        });
      })
      .catch(() => setProfile(authUser));
    axiosClient.get('/problem/problemSolvedByUser')
      .then(({ data }) => setSolved(data))
      .catch(() => {});
    axiosClient.get('/contest/history')
      .then(({ data }) => setHistory(data))
      .catch(() => {});
  }, []);

  const count = (d) => solved.filter((p) => p.difficulty === d).length;
  const initials = `${profile?.firstName?.[0] || ''}${profile?.lastName?.[0] || ''}`.toUpperCase() || 'U';

  const saveProfile = async () => {
    try {
      setSaving(true);
      const { data } = await axiosClient.put('/user/updateProfile', form);
      setProfile(data.user);
      setEditing(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Please choose an image file');
    if (file.size > 5 * 1024 * 1024) return alert('Image must be under 5 MB');

    try {
      setUploading(true);
      // 1) backend se signed credentials
      const { data: sig } = await axiosClient.get('/user/profileImage/signature');

      // 2) seedha Cloudinary pe upload (signed)
      const fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', sig.api_key);
      fd.append('timestamp', sig.timestamp);
      fd.append('signature', sig.signature);
      fd.append('public_id', sig.public_id);

      const { data: uploaded } = await axios.post(sig.upload_url, fd);

      // 3) URL apne backend me save
      const { data: saved } = await axiosClient.post('/user/profileImage/save', {
        secureUrl: uploaded.secure_url,
        publicId: uploaded.public_id
      });

      setProfile((p) => ({ ...p, profileImageUrl: saved.profileImageUrl }));
    } catch (err) {
      alert('Photo upload failed — try again');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      {/* Navbar */}
      <div className="navbar bg-base-100 shadow-lg px-4">
        <div className="flex-1">
          <NavLink to="/" className="btn btn-ghost text-xl">CodeSprint</NavLink>
        </div>
        <NavLink to="/" className="btn btn-ghost btn-sm">Home</NavLink>
      </div>

      <div className="container mx-auto p-4 max-w-3xl">
        {/* User card */}
        <div className="card bg-base-100 shadow-xl mt-6 mb-6">
          <div className="card-body">
            <div className="flex items-center gap-5 flex-wrap">
              {/* Avatar: photo hai to photo, warna initials */}
              <div className="relative">
                {profile?.profileImageUrl ? (
                  <img
                    src={profile.profileImageUrl}
                    alt="Profile"
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary text-primary-content flex items-center justify-center text-2xl font-semibold">
                    {initials}
                  </div>
                )}
                <button
                  className="btn btn-circle btn-xs absolute -bottom-1 -right-1"
                  title="Change photo"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <span className="loading loading-spinner loading-xs"></span> : '+'}
                </button>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileRef}
                  className="hidden"
                  onChange={uploadPhoto}
                />
              </div>

              {!editing ? (
                <div className="flex-1">
                  <h1 className="text-2xl font-bold">
                    {profile?.firstName} {profile?.lastName || ''}
                  </h1>
                  <p className="text-base-content/60">{profile?.emailId}</p>
                  <div className="flex gap-2 mt-1 items-center">
                    {profile?.age && <span className="text-base-content/50 text-sm">Age: {profile.age}</span>}
                    {profile?.role === 'admin' && <span className="badge badge-primary badge-sm">Admin</span>}
                  </div>
                </div>
              ) : (
                <div className="flex-1 space-y-2">
                  <input
                    className="input input-bordered input-sm w-full max-w-xs"
                    placeholder="First name"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  />
                  <input
                    className="input input-bordered input-sm w-full max-w-xs"
                    placeholder="Last name"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  />
                  <input
                    className="input input-bordered input-sm w-full max-w-xs"
                    placeholder="Age"
                    type="number"
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                  />
                </div>
              )}

              <div>
                {!editing ? (
                  <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button className="btn btn-primary btn-sm" onClick={saveProfile} disabled={saving}>
                      {saving ? <span className="loading loading-spinner loading-xs"></span> : 'Save'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats stats-vertical sm:stats-horizontal shadow w-full mb-6">
          <div className="stat">
            <div className="stat-title">Total Solved</div>
            <div className="stat-value text-primary">{solved.length}</div>
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
          <div className="stat">
            <div className="stat-title">Contests</div>
            <div className="stat-value text-2xl">{history.length}</div>
          </div>
        </div>

        {/* Contest history */}
        <div className="card bg-base-100 shadow mb-6">
          <div className="card-body">
            <h2 className="card-title text-lg">Contest History</h2>
            {history.length === 0 ? (
              <p className="text-base-content/50 text-sm">
                No contests yet. <NavLink to="/contest" className="link link-primary">Start one</NavLink>
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr><th>Date</th><th>Duration</th><th>Solved</th><th>Score</th></tr>
                  </thead>
                  <tbody>
                    {history.map((c) => (
                      <tr key={c._id}>
                        <td>{new Date(c.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td>{c.durationMin} min</td>
                        <td>{c.solvedCount}/{c.totalProblems}</td>
                        <td className="font-semibold text-primary">{c.totalScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Solved problems */}
        <div className="card bg-base-100 shadow mb-6">
          <div className="card-body">
            <h2 className="card-title text-lg">Solved Problems</h2>
            {solved.length === 0 ? (
              <p className="text-base-content/50 text-sm">
                Nothing solved yet. <NavLink to="/problems" className="link link-primary">Browse problems</NavLink>
              </p>
            ) : (
              <div className="space-y-2">
                {solved.map((p) => (
                  <NavLink key={p._id} to={`/problem/${p._id}`}
                    className="flex items-center justify-between border-b border-base-200 pb-2 hover:bg-base-200 rounded px-2">
                    <span>{p.title}</span>
                    <span className="flex gap-2">
                      <span className={`badge badge-sm ${badge[p.difficulty] || ''}`}>{p.difficulty}</span>
                      <span className="badge badge-sm badge-ghost">{p.tags}</span>
                    </span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;