import { useState, useEffect } from 'react';
import { FileText, X, Sparkles, Copy } from 'lucide-react';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface Template {
  id: string;
  name: string;
  description: string | null;
  is_system_template: boolean;
  template_data: Record<string, unknown>;
}

interface TemplateSelectorProps {
  organizationId: string;
  onTemplateApplied: (draftId: string) => void;
  onClose: () => void;
}

export default function TemplateSelector({ organizationId, onTemplateApplied, onClose }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, [organizationId]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('onboarding_request_templates')
        .select('*')
        .or(`is_system_template.eq.true,organization_id.eq.${organizationId}`)
        .order('is_system_template', { ascending: false })
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      logger.error('Error loading templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = async (templateId: string) => {
    try {
      const { data, error } = await supabase.rpc('create_onboarding_from_template', {
        template_id: templateId,
        org_id: organizationId,
      });

      if (error) throw error;
      if (!data) throw new Error('No draft ID returned from template');

      const template = templates.find((t) => t.id === templateId);
      toast.success(`Template applied: ${template?.name ?? 'template'}`);
      onTemplateApplied(data as string);
      onClose();
    } catch (error) {
      logger.error('Error applying template:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to apply template: ${msg}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="template-selector-title">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Sparkles className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 id="template-selector-title" className="text-xl font-semibold text-gray-900">Choose a Template</h2>
              <p className="text-sm text-gray-600 mt-1">
                Start with a pre-filled template to speed up your onboarding request
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close template selector"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No templates available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template.id)}
                  className="text-left p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-5 w-5 text-blue-600 group-hover:text-blue-700" />
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-700">
                        {template.name}
                      </h3>
                    </div>
                    {template.is_system_template && (
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                        System
                      </span>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  )}
                  <div className="flex items-center text-xs text-gray-500">
                    <Copy className="h-3 w-3 mr-1" />
                    Click to use this template
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Start from Scratch
          </button>
          <p className="text-sm text-gray-600">
            You can also start without a template
          </p>
        </div>
      </div>
    </div>
  );
}
