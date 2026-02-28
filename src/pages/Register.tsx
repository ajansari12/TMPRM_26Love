import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Building2, Eye, EyeOff } from 'lucide-react';

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' };
  if (score <= 3) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
  return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
}

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await signUp(email, password, fullName);
      if (error) throw error;
      navigate('/');
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to create account');
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

          <h1 className="text-3xl font-bold text-center text-slate-900 mb-2">
            Create Account
          </h1>
          <p className="text-center text-slate-600 mb-8 text-sm">
            Join the TPRM Platform
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Create account">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-1">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                placeholder="John Doe"
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                placeholder="you@company.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password && (
                <div className="mt-2">
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          level <= strength.score ? strength.color : 'bg-slate-200'
                        }`}
                      />
                    ))}
                    <span className="text-xs text-slate-500 ml-1">{strength.label}</span>
                  </div>
                </div>
              )}
              <p className="mt-1 text-xs text-slate-500">
                Must be at least 6 characters
              </p>
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
              />
              <span className="text-xs text-slate-600">
                I agree to the Terms of Service and Privacy Policy
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !agreedToTerms}
              className="w-full bg-slate-900 text-white py-2 px-4 rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="text-slate-900 hover:underline font-medium">
              Sign In
            </Link>
          </p>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-center space-x-2 mb-3">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-500">New Financial Institution?</span>
            </div>
            <Link
              to="/fi-onboarding"
              className="block w-full text-center px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              Register Your Institution
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-400">
          Third-Party Risk Management Platform
        </p>
      </div>
    </div>
  );
}
