// Minimal card builders using the Google Workspace Add-ons CardService JSON format.
// The real schema is at https://developers.google.com/workspace/add-ons/concepts/card-interfaces
// We build just enough here to render useful sidebars.

export interface CardResponse {
  action: {
    navigations?: Array<{ pushCard?: unknown; updateCard?: unknown; popToRoot?: boolean }>;
    notification?: { text: string };
    openLink?: { url: string };
  };
}

interface HomeCardOptions {
  userDisplayName?: string;
  templates: Array<{ id: string; name: string }>;
  backendUrl: string;
}

export function buildHomeCard(opts: HomeCardOptions): unknown {
  const templateButtons = opts.templates.slice(0, 10).map((t) => ({
    text: t.name,
    onClick: {
      action: {
        function: 'onPickTemplate',
        parameters: [{ key: 'templateId', value: t.id }],
      },
    },
  }));

  return {
    sections: [
      {
        header: opts.userDisplayName ? `Hi, ${opts.userDisplayName}` : 'Contract Generator',
        widgets: [
          {
            textParagraph: {
              text:
                'Generate a contract from a template, or ask AI to edit your selection.',
            },
          },
          {
            textInput: {
              fieldId: 'ai_instruction',
              label: 'AI edit instruction',
              hintText: 'e.g. Tighten the termination-for-convenience clause',
              multiline: true,
            },
          },
          {
            buttonList: {
              buttons: [
                {
                  text: 'Run AI edit on selection',
                  onClick: {
                    action: { function: 'onRunAIEdit' },
                  },
                },
              ],
            },
          },
        ],
      },
      {
        header: 'Generate from template',
        widgets:
          opts.templates.length === 0
            ? [{ textParagraph: { text: 'No templates yet. Create one in the web app.' } }]
            : [{ buttonList: { buttons: templateButtons } }],
      },
    ],
  };
}

export function notification(text: string): CardResponse {
  return { action: { notification: { text } } };
}
