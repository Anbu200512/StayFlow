import { useState, type FormEvent } from 'react';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../lib/api';
import { Field } from '../components/Ui';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (password.length < 8) { setError('Use at least 8 characters.'); return; } if (password !== confirmation) { setError('Passwords do not match.'); return; } setLoading(true); setError(''); try { await authApi.resetPassword(token, password); setSucceeded(true); window.setTimeout(() => navigate('/login', { replace: true }), 900); } catch (requestError) { setError((requestError as { userMessage?: string }).userMessage ?? 'The password could not be reset.'); } finally { setLoading(false); } };
  return <div className="flex min-h-screen items-center justify-center bg-forest px-5 py-12"><div className="w-full max-w-md bg-[#f5f7fb] p-7 shadow-xl md:p-9"><p className="font-display text-4xl text-forest">StayFlow</p>{succeeded ? <div className="py-16 text-center"><CheckCircle2 size={30} className="mx-auto text-forest" /><h1 className="mt-5 font-display text-3xl">Password updated.</h1><p className="mt-3 text-sm text-ink/50">Taking you to sign in…</p></div> : <><h1 className="mt-9 font-display text-4xl">Choose a new password.</h1><p className="mt-3 text-sm leading-6 text-ink/55">This reset link signs you out of existing sessions and replaces your current password.</p><form onSubmit={submit} className="mt-8 space-y-5"><Field label="New password"><input className="dashboard-input" type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></Field><Field label="Confirm password"><input className="dashboard-input" type="password" minLength={8} maxLength={128} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></Field>{!token && <p className="text-sm text-copper">This reset link is missing its secure token.</p>}{error && <p className="text-sm text-copper">{error}</p>}<button type="submit" className="dashboard-button w-full py-3.5" disabled={!token || loading}>{loading ? 'Updating…' : 'Update password'}<KeyRound size={15} /></button></form></>}<Link to="/login" className="mt-7 block text-center text-xs font-semibold text-ink/45 hover:text-forest">Return to sign in</Link></div></div>;
}
