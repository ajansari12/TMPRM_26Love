import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Shield, CheckCircle, XCircle, Loader2, Building2, Mail, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DEFENSE_LINE_LABELS, DefenseLine } from '../types/organization';
import { logger } from '../lib/logger';

interface InvitationData {
  id: string;
  organization_id: string;
  email: string;
  defense_line: DefenseLine;
  role_title?: string;
  department?: string;
  business_unit?: string;
  inviter_name: string;
  expires_at: string;
  organization?: {
    id: string;
    name: string;
    logo_url?: string;
  };
}

type PageState = 'loading' | 'invalid' | 'expired' | 'register' | 'accepting' | 'success' | 'error';

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, signUp, signIn } = useAuth();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  useEffect(() => {
    if (token) {
      validateInvitation();
    }
  }, [token]);

  useEffect(() => {
    if (user && invitation && pageState === 'register') {
      acceptInvitation();
    }
  }, [user, invitation, pageState]);

  const validateInvitation = async () => {
    try {
      const { data, error } = await supabase
        .from('organization_invitations')
        .select(`
          *,
          organization:organizations(id, name, logo_url)
        `)
        .eq('token', token)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setPageState('invalid');
        return;
      }

      if (data.status !== 'pending') {
        setPageState('invalid');
        setErrorMessage('This invitation has already been used or cancelled.');
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setPageState('expired');
        return;
      }

      setInvitation(data);
      setEmail(data.email);
      setLoginEmail(data.email);

      if (user) {
        if (user.email?.toLowerCase() === data.email.toLowerCase()) {
          await acceptInvitation(data);
        } else {
          setErrorMessage(`This invitation was sent to ${data.email}. You are currently logged in as ${user.email}. Please log out and try again, or log in with the correct account.`);
          setPageState('error');
        }
      } else {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', data.email.toLowerCase())
          .maybeSingle();

        if (existingUser) {
          setShowLogin(true);
        }
        setPageState('register');
      }
    } catch (error) {
      logger.error('Error validating invitation:', error);
      setPageState('error');
      setErrorMessage('Failed to validate invitation. Please try again.');
    }
  };

  const acceptInvitation = async (inviteData?: InvitationData) => {
    const invite = inviteData || invitation;
    if (!invite) return;

    setPageState('accepting');

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser) {
        setPageState('register');
        return;
      }

      const { data: existingMember } = await supabase
        .from('organization_users')
        .select('id')
        .eq('organization_id', invite.organization_id)
        .eq('user_id', currentUser.id)
        .eq('is_active', true)
        .maybeSingle();

      if (existingMember) {
        await supabase
          .from('organization_invitations')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString(),
            accepted_by: currentUser.id
          })
          .eq('id', invite.id);

        setPageState('success');
        setTimeout(() => navigate('/'), 2000);
        return;
      }

      const { error: memberError } = await supabase
        .from('organization_users')
        .insert({
          organization_id: invite.organization_id,
          user_id: currentUser.id,
          defense_line: invite.defense_line,
          role_title: invite.role_title,
          department: invite.department,
          business_unit: invite.business_unit,
          can_create_requests: invite.defense_line === '1a' || invite.defense_line === '1b' || invite.defense_line === 'admin',
          can_review: invite.defense_line === '1b' || invite.defense_line === '2nd' || invite.defense_line === 'admin',
          can_approve: invite.defense_line === '2nd' || invite.defense_line === 'admin',
          can_manage_users: invite.defense_line === 'admin',
          can_configure_workflows: invite.defense_line === 'admin',
          is_active: true,
        });

      if (memberError) throw memberError;

      const { error: updateError } = await supabase
        .from('organization_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          accepted_by: currentUser.id
        })
        .eq('id', invite.id);

      if (updateError) throw updateError;

      await supabase
        .from('profiles')
        .update({ default_organization_id: invite.organization_id })
        .eq('id', currentUser.id);

      setPageState('success');
      setTimeout(() => navigate('/'), 2000);
    } catch (error: any) {
      logger.error('Error accepting invitation:', error);
      setPageState('error');
      setErrorMessage(error.message || 'Failed to accept invitation. Please try again.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await signUp(email, password, fullName);
      if (error) throw error;
    } catch (error: any) {
      setFormError(error.message || 'Failed to create account');
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const { error } = await signIn(loginEmail, loginPassword);
      if (error) throw error;
    } catch (error: any) {
      setFormError(error.message || 'Failed to sign in');
      setIsSubmitting(false);
    }
  };

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-2xl p-8 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Invalid Invitation</h1>
          <p className="text-slate-600 mb-6">
            {errorMessage || 'This invitation link is invalid or has already been used.'}
          </p>
          <Link
            to="/login"
            className="inline-block px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (pageState === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-2xl p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Invitation Expired</h1>
          <p className="text-slate-600 mb-6">
            This invitation has expired. Please contact the person who invited you to request a new invitation.
          </p>
          <Link
            to="/login"
            className="inline-block px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (pageState === 'accepting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Joining organization...</p>
        </div>
      </div>
    );
  }

  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-2xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome!</h1>
          <p className="text-slate-600 mb-4">
            You have successfully joined {invitation?.organization?.name || 'the organization'}.
          </p>
          <p className="text-sm text-slate-500">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-2xl p-8 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Something Went Wrong</h1>
          <p className="text-slate-600 mb-6">{errorMessage}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Try Again
            </button>
            <Link
              to="/login"
              className="block w-full px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
            You're Invited!
          </h1>

          {invitation && (
            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <div className="flex items-center mb-3">
                {invitation.organization?.logo_url ? (
                  <img
                    src={invitation.organization.logo_url}
                    alt={invitation.organization.name}
                    className="w-10 h-10 rounded-lg object-cover mr-3"
                  />
                ) : (
                  <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center mr-3">
                    <Building2 className="w-5 h-5 text-slate-500" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-slate-900">{invitation.organization?.name}</p>
                  <p className="text-sm text-slate-500">Invited by {invitation.inviter_name}</p>
                </div>
              </div>
              <div className="text-sm text-slate-600 space-y-1">
                <p>
                  <span className="font-medium">Role:</span>{' '}
                  {DEFENSE_LINE_LABELS[invitation.defense_line]}
                </p>
                {invitation.role_title && (
                  <p>
                    <span className="font-medium">Title:</span> {invitation.role_title}
                  </p>
                )}
                {invitation.department && (
                  <p>
                    <span className="font-medium">Department:</span> {invitation.department}
                  </p>
                )}
              </div>
            </div>
          )}

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {formError}
            </div>
          )}

          {showLogin ? (
            <>
              <p className="text-center text-slate-600 mb-6 text-sm">
                An account exists for {email}. Please sign in to accept the invitation.
              </p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="loginEmail" className="block text-sm font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                      id="loginEmail"
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="loginPassword" className="block text-sm font-medium text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    id="loginPassword"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-slate-900 text-white py-2 px-4 rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In & Accept'
                  )}
                </button>
              </form>

              <button
                onClick={() => setShowLogin(false)}
                className="w-full mt-3 text-sm text-slate-600 hover:text-slate-900"
              >
                Create a new account instead
              </button>
            </>
          ) : (
            <>
              <p className="text-center text-slate-600 mb-6 text-sm">
                Create your account to join {invitation?.organization?.name || 'the organization'}
              </p>

              <form onSubmit={handleRegister} className="space-y-4">
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
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      readOnly
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700"
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    This is the email your invitation was sent to
                  </p>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    placeholder="Create a password"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    placeholder="Confirm your password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-slate-900 text-white py-2 px-4 rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account & Join'
                  )}
                </button>
              </form>

              <button
                onClick={() => setShowLogin(true)}
                className="w-full mt-3 text-sm text-slate-600 hover:text-slate-900"
              >
                Already have an account? Sign in
              </button>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-slate-400">
          Third-Party Risk Management Platform
        </p>
      </div>
    </div>
  );
}
