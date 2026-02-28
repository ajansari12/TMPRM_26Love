import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const passwordStrength = (() => {
    if (password.length === 0)
      return { level: 0, label: '', color: '' };
    if (password.length < 6)
      return { level: 1, label: 'Too short', color: 'bg-red-500' };
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const score = [
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial,
      password.length >= 10,
    ].filter(Boolean).length;
    if (score <= 2)
      return { level: 1, label: 'Weak', color: 'bg-red-500' };
    if (score <= 3)
      return { level: 2, label: 'Fair', color: 'bg-amber-500' };
    return { level: 3, label: 'Strong', color: 'bg-emerald-500' };
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to reset password';
      setError(message);
    } finally {
      setLoading(false);
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
            Set New Password
          </h1>
          <p className="text-center text-slate-500 mb-8 text-sm">
            Choose a strong password for your account
          </p>

          {success ? (
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                Password Updated
              </h2>
              <p className="text-sm text-slate-500">
                Redirecting you to sign in...
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      placeholder="Minimum 6 characters"
                      autoFocus
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i <= passwordStrength.level
                                ? passwordStrength.color
                                : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-slate-500">
                        {passwordStrength.label}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      placeholder="Re-enter your password"
                      required
                    />
                  </div>
                  {confirmPassword.length > 0 &&
                    password !== confirmPassword && (
                      <p className="mt-1 text-xs text-red-600">
                        Passwords do not match
                      </p>
                    )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 text-white py-2 px-4 rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
