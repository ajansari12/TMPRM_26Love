import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Send, Loader2, Brain, Building2, FileText, AlertTriangle, ExternalLink } from 'lucide-react';
import { useAI } from '../../hooks/useAI';
import type { AIQueryResponse } from '../../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  entities?: AIQueryResponse['entities'];
  followUps?: string[];
  timestamp: Date;
}

const ENTITY_ICONS: Record<string, typeof Building2> = {
  vendor: Building2,
  assessment: FileText,
  contract: FileText,
  incident: AlertTriangle,
};

const ENTITY_ROUTES: Record<string, string> = {
  vendor: '/vendors/',
  assessment: '/vendors/',
  contract: '/contracts/',
  incident: '/incidents/',
};

const EXAMPLE_QUERIES = [
  'Which vendors are critical and have contracts expiring in 90 days?',
  'Show me the top 5 vendors by risk rating',
  'How many vendors are overdue for reassessment?',
  'What is our concentration risk by service category?',
];

export default function RiskQueryChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { loading, execute } = useAI<AIQueryResponse>({ action: 'query' });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (query: string) => {
    if (!query.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // Build context from conversation history
    const conversationContext = messages
      .slice(-6)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const result = await execute({
      query: query.trim(),
      conversation_history: conversationContext || undefined,
    });

    if (result.success && result.data) {
      const data = result.data as AIQueryResponse;
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer,
        entities: data.entities,
        followUps: data.follow_up_suggestions,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } else {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.error || 'Sorry, I could not process that query. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Brain className="w-10 h-10 text-purple-200 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-slate-700 mb-1">Ask anything about your vendors</h3>
            <p className="text-xs text-slate-400 mb-4">
              Query your risk portfolio using natural language
            </p>
            <div className="space-y-2">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="block w-full text-left px-3 py-2 text-xs text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
                message.role === 'user'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>

              {/* Entity Links */}
              {message.entities && message.entities.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200/30 space-y-1">
                  {message.entities.slice(0, 5).map((entity, i) => {
                    const EntityIcon = ENTITY_ICONS[entity.type] || FileText;
                    const route = entity.id ? `${ENTITY_ROUTES[entity.type]}${entity.id}` : null;
                    return route ? (
                      <Link
                        key={i}
                        to={route}
                        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <EntityIcon className="w-3 h-3" />
                        <span className="truncate">{entity.label}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </Link>
                    ) : (
                      <span key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
                        <EntityIcon className="w-3 h-3" />
                        {entity.label}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Follow-up Suggestions */}
              {message.followUps && message.followUps.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200/30 space-y-1">
                  <p className="text-xs text-slate-400 mb-1">Related questions:</p>
                  {message.followUps.map((followUp, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(followUp)}
                      className="block w-full text-left text-xs text-blue-400 hover:text-blue-300 transition-colors truncate"
                    >
                      → {followUp}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
              <span className="text-sm text-slate-500">Analyzing...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(input)}
            placeholder="Ask about your vendor portfolio..."
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
            disabled={loading}
            aria-label="Risk query input"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={loading || !input.trim()}
            className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Send query"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
