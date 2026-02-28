import { useNavigate } from 'react-router-dom';
import { FileQuestion, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="mx-auto w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-6">
          <FileQuestion className="h-8 w-8 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Page Not Found
        </h1>
        <p className="text-slate-500 mb-8 leading-relaxed">
          The page you are looking for does not exist or has been moved. Check
          the URL or navigate back to a known page.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Home className="h-4 w-4" />
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
