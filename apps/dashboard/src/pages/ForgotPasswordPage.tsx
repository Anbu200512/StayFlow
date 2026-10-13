import { useState, type FormEvent } from 'react';
import { ArrowLeft, Mail, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { authApi } from '../lib/api';
import { Field } from '../components/Ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setLoading(true); setError(''); try { await authApi.forgotPassword(email); setMessage('If an account exists, a reset link has been sent. Check your inbox and spam folder.'); } catch (requestError) { setError((requestError as { userMessage?: string }).userMessage ?? 'The reset link could not be requested.'); } finally { setLoading(false); } };
  return <div className="flex min-h-screen items-center justify-center bg-forest px-5 py-12"><div className="w-full max-w-md bg-[#f5f7fb] p-7 shadow-xl md:p-9"><Link to="/login" className="inline-flex items-center gap-2 text-xs font-semibold text-ink/50 hover:text-forest"><ArrowLeft size={14} />Back to sign in</Link><div className="mt-9"><p className="font-display text-4xl text-forest">StayFlow</p><h1 className="mt-7 font-display text-4xl">Reset your password.</h1><p className="mt-3 text-sm leading-6 text-ink/55">Enter your staff email and we will send a secure reset link if the account exists.</p></div>{message ? <div className="mt-8 border border-forest/20 bg-forest/5 p-5"><Mail size={20} className="text-forest" /><p className="mt-3 text-sm leading-6 text-ink/70">{message}</p></div> : <form onSubmit={submit} className="mt-8 space-y-5"><Field label="Work email"><input className="dashboard-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>{error && <p className="text-sm text-copper">{error}</p>}<button type="submit" className="dashboard-button w-full py-3.5" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}<Send size={15} /></button></form>}</div></div>;
}
