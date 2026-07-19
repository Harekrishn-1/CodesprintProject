import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axiosClient from '../utils/axiosClient';
import { NavLink } from 'react-router';

// Wahi schema jo create (AdminPanel) me hai
const problemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  tags: z.enum(['array', 'linkedList', 'graph', 'dp']),
  visibleTestCases: z.array(
    z.object({
      input: z.string().min(1, 'Input is required'),
      output: z.string().min(1, 'Output is required'),
      explanation: z.string().min(1, 'Explanation is required')
    })
  ).min(1, 'At least one visible test case required'),
  hiddenTestCases: z.array(
    z.object({
      input: z.string().min(1, 'Input is required'),
      output: z.string().min(1, 'Output is required')
    })
  ).min(1, 'At least one hidden test case required'),
  startCode: z.array(
    z.object({
      language: z.enum(['C++', 'Java', 'JavaScript']),
      initialCode: z.string().min(1, 'Initial code is required')
    })
  ).length(3, 'All three languages required'),
  referenceSolution: z.array(
    z.object({
      language: z.enum(['C++', 'Java', 'JavaScript']),
      completeCode: z.string().min(1, 'Complete code is required')
    })
  ).length(3, 'All three languages required')
});

function AdminUpdate() {
  const [problems, setProblems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loadingForm, setLoadingForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({ resolver: zodResolver(problemSchema) });

  const visibleArray = useFieldArray({ control, name: 'visibleTestCases' });
  const hiddenArray = useFieldArray({ control, name: 'hiddenTestCases' });

  // problems ki list lao
  useEffect(() => {
    axiosClient.get('/problem/getAllProblem')
      .then(({ data }) => setProblems(data))
      .catch(() => alert('Problems fetch nahi ho payi'));
  }, []);

  // problem chuni → poora data lao → form me bharo
  const openProblem = async (id) => {
    try {
      setLoadingForm(true);
      setSelectedId(id);
      const { data } = await axiosClient.get(`/problem/adminProblemById/${id}`);
      reset({
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        tags: data.tags,
        visibleTestCases: data.visibleTestCases.map(({ input, output, explanation }) => ({ input, output, explanation })),
        hiddenTestCases: data.hiddenTestCases.map(({ input, output }) => ({ input, output })),
        startCode: data.startCode.map(({ language, initialCode }) => ({ language, initialCode })),
        referenceSolution: data.referenceSolution.map(({ language, completeCode }) => ({ language, completeCode }))
      });
    } catch (err) {
      alert('Problem load nahi ho payi');
      setSelectedId(null);
    } finally {
      setLoadingForm(false);
    }
  };

  const onSubmit = async (formData) => {
    try {
      setSaving(true);
      await axiosClient.put(`/problem/update/${selectedId}`, formData);
      alert('Problem updated successfully');
      setSelectedId(null);
    } catch (err) {
      alert(err.response?.data?.message || err.response?.data || 'Update fail hua — reference solutions test cases pass kar rahe hain kya?');
    } finally {
      setSaving(false);
    }
  };

  const badge = { easy: 'badge-success', medium: 'badge-warning', hard: 'badge-error' };

  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow-lg px-4">
        <div className="flex-1">
          <NavLink to="/" className="btn btn-ghost text-xl">CodeSprint</NavLink>
        </div>
        <NavLink to="/admin" className="btn btn-ghost btn-sm">Admin Home</NavLink>
      </div>

      <div className="container mx-auto p-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Update Problem</h1>

        {/* ---------- LIST VIEW ---------- */}
        {!selectedId && (
          <div className="space-y-2">
            {problems.map((p) => (
              <div key={p._id} className="card bg-base-100 shadow">
                <div className="card-body py-3 flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{p.title}</span>
                    <span className={`badge badge-sm ${badge[p.difficulty] || ''}`}>{p.difficulty}</span>
                    <span className="badge badge-sm badge-ghost">{p.tags}</span>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => openProblem(p._id)}>Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---------- EDIT FORM ---------- */}
        {selectedId && loadingForm && (
          <div className="flex justify-center mt-10"><span className="loading loading-spinner loading-lg"></span></div>
        )}

        {selectedId && !loadingForm && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedId(null)}> Back to list</button>

            {/* Basic info */}
            <div className="card bg-base-100 shadow-lg p-6 space-y-4">
              <h2 className="text-xl font-semibold">Basic Information</h2>
              <div>
                <label className="label">Title</label>
                <input {...register('title')} className="input input-bordered w-full" />
                {errors.title && <span className="text-error text-sm">{errors.title.message}</span>}
              </div>
              <div>
                <label className="label">Description</label>
                <textarea {...register('description')} rows={8} className="textarea textarea-bordered w-full" />
                {errors.description && <span className="text-error text-sm">{errors.description.message}</span>}
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="label">Difficulty</label>
                  <select {...register('difficulty')} className="select select-bordered w-full">
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="label">Tag</label>
                  <select {...register('tags')} className="select select-bordered w-full">
                    <option value="array">Array</option>
                    <option value="linkedList">Linked List</option>
                    <option value="graph">Graph</option>
                    <option value="dp">DP</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Visible test cases */}
            <div className="card bg-base-100 shadow-lg p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Visible Test Cases</h2>
                <button type="button" className="btn btn-primary btn-sm"
                  onClick={() => visibleArray.append({ input: '', output: '', explanation: '' })}>
                  Add Visible Case
                </button>
              </div>
              {visibleArray.fields.map((field, i) => (
                <div key={field.id} className="border border-base-300 rounded-lg p-4 space-y-2">
                  <div className="flex justify-end">
                    <button type="button" className="btn btn-error btn-xs" onClick={() => visibleArray.remove(i)}>Remove</button>
                  </div>
                  <input {...register(`visibleTestCases.${i}.input`)} placeholder="Input" className="input input-bordered w-full" />
                  <input {...register(`visibleTestCases.${i}.output`)} placeholder="Output" className="input input-bordered w-full" />
                  <textarea {...register(`visibleTestCases.${i}.explanation`)} placeholder="Explanation" className="textarea textarea-bordered w-full" />
                </div>
              ))}
              {errors.visibleTestCases && <span className="text-error text-sm">{errors.visibleTestCases.message}</span>}
            </div>

            {/* Hidden test cases */}
            <div className="card bg-base-100 shadow-lg p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Hidden Test Cases</h2>
                <button type="button" className="btn btn-primary btn-sm"
                  onClick={() => hiddenArray.append({ input: '', output: '' })}>
                  Add Hidden Case
                </button>
              </div>
              {hiddenArray.fields.map((field, i) => (
                <div key={field.id} className="border border-base-300 rounded-lg p-4 space-y-2">
                  <div className="flex justify-end">
                    <button type="button" className="btn btn-error btn-xs" onClick={() => hiddenArray.remove(i)}>Remove</button>
                  </div>
                  <input {...register(`hiddenTestCases.${i}.input`)} placeholder="Input" className="input input-bordered w-full" />
                  <input {...register(`hiddenTestCases.${i}.output`)} placeholder="Output" className="input input-bordered w-full" />
                </div>
              ))}
              {errors.hiddenTestCases && <span className="text-error text-sm">{errors.hiddenTestCases.message}</span>}
            </div>

            {/* Code templates */}
            <div className="card bg-base-100 shadow-lg p-6 space-y-4">
              <h2 className="text-xl font-semibold">Code Templates & Reference Solutions</h2>
              {[0, 1, 2].map((i) => (
                <div key={i} className="border border-base-300 rounded-lg p-4 space-y-2">
                  <h3 className="font-semibold">
                    {i === 0 ? 'C++' : i === 1 ? 'Java' : 'JavaScript'}
                  </h3>
                  <label className="label">Initial Code</label>
                  <textarea {...register(`startCode.${i}.initialCode`)} rows={5}
                    className="textarea textarea-bordered w-full font-mono text-sm" />
                  <label className="label">Reference Solution</label>
                  <textarea {...register(`referenceSolution.${i}.completeCode`)} rows={7}
                    className="textarea textarea-bordered w-full font-mono text-sm" />
                </div>
              ))}
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={saving}>
              {saving ? <span className="loading loading-spinner"></span> : 'Update Problem'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default AdminUpdate;