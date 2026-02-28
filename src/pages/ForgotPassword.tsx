import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // Silently handle -- never reveal whether the email exists
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-2xl p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-slate-900 p-3 rounded-lg">
              <Shield className="w-10 h-10 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">
            Reset Password
          </h1>
          <p className="text-center text-slate-500 mb-8 text-sm">
            Enter your email and we will send you a reset link
          </p>

          {submitted ? (
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                Check your email
              </h2>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                If an account exists with that email address, we have sent
                password reset instructions. Please check your inbox and spam
                folder.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-900 hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      placeholder="you@company.com"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 text-white py-2 px-4 rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <p className="mt-6 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Sign In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
