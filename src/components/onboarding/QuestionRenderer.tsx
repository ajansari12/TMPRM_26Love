import { Info } from 'lucide-react';
import { AssessmentQuestion } from '../../lib/assessmentQuestions';

interface QuestionRendererProps {
  question: AssessmentQuestion;
  value: unknown;
  onChange: (questionId: string, value: unknown) => void;
  error?: string;
}

export function QuestionRenderer({
  question,
  value,
  onChange,
  error,
}: QuestionRendererProps) {
  const handleRadioChange = (optionValue: string) => {
    onChange(question.id, optionValue);
  };

  const handleCheckboxChange = (optionValue: string, checked: boolean) => {
    const currentValues = Array.isArray(value) ? value : [];
    if (checked) {
      onChange(question.id, [...currentValues, optionValue]);
    } else {
      onChange(
        question.id,
        currentValues.filter((v: string) => v !== optionValue)
      );
    }
  };

  const handleBooleanChange = (boolValue: boolean) => {
    onChange(question.id, boolValue);
  };

  const handleTextChange = (textValue: string) => {
    onChange(question.id, textValue);
  };

  const handleNumberChange = (numValue: string) => {
    onChange(question.id, numValue ? parseFloat(numValue) : undefined);
  };

  return (
    <div className="py-4 border-b border-slate-100 last:border-b-0">
      <div className="flex items-start gap-2 mb-3">
        <span className="font-medium text-slate-900">{question.text}</span>
        {question.helpText && (
          <div className="group relative">
            <Info className="w-4 h-4 text-slate-400 cursor-help mt-0.5" />
            <div className="absolute left-0 top-6 z-10 hidden group-hover:block w-72 p-2 bg-slate-800 text-white text-xs rounded shadow-lg">
              {question.helpText}
            </div>
          </div>
        )}
      </div>

      {question.osfiReference && (
        <p className="text-xs text-blue-600 mb-2">Reference: {question.osfiReference}</p>
      )}

      {question.type === 'radio' && question.options && (
        <div className="space-y-2">
          {question.options.map((option) => (
            <label
              key={option.value}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                value === option.value
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name={question.id}
                value={option.value}
                checked={value === option.value}
                onChange={() => handleRadioChange(option.value)}
                className="w-4 h-4 text-slate-900 border-slate-300 focus:ring-slate-500"
              />
              <span className="text-sm text-slate-700">{option.label}</span>
              {option.score !== undefined && (
                <span className="ml-auto text-xs text-slate-400">
                  Score: {option.score}
                </span>
              )}
            </label>
          ))}
        </div>
      )}

      {question.type === 'checkbox' && question.options && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {question.options.map((option) => {
            const currentValues = Array.isArray(value) ? value : [];
            const isChecked = currentValues.includes(option.value);
            return (
              <label
                key={option.value}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  isChecked
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => handleCheckboxChange(option.value, e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                <span className="text-sm text-slate-700">{option.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {question.type === 'boolean' && (
        <div className="flex gap-3">
          <label
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
              value === true
                ? 'border-slate-900 bg-slate-50'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name={question.id}
              checked={value === true}
              onChange={() => handleBooleanChange(true)}
              className="w-4 h-4 text-slate-900 border-slate-300 focus:ring-slate-500"
            />
            <span className="text-sm text-slate-700">Yes</span>
          </label>
          <label
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
              value === false
                ? 'border-slate-900 bg-slate-50'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name={question.id}
              checked={value === false}
              onChange={() => handleBooleanChange(false)}
              className="w-4 h-4 text-slate-900 border-slate-300 focus:ring-slate-500"
            />
            <span className="text-sm text-slate-700">No</span>
          </label>
        </div>
      )}

      {question.type === 'text' && (
        <input
          type="text"
          value={(value as string) || ''}
          onChange={(e) => handleTextChange(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          placeholder="Enter your response..."
        />
      )}

      {question.type === 'textarea' && (
        <textarea
          value={(value as string) || ''}
          onChange={(e) => handleTextChange(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          placeholder="Enter your response..."
        />
      )}

      {question.type === 'number' && (
        <input
          type="number"
          value={(value as number) ?? ''}
          onChange={(e) => handleNumberChange(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          placeholder="Enter a number..."
        />
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
