import 'dotenv/config';
import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { buildHomeCard, notification } from './cards.js';

// HTTP-backed Workspace Add-on.
// ---------------------------------------------------------------------------
// Google sends a JSON payload to a single webhook URL (configured in
// appsscript.json → httpOptions.url) whenever the user interacts with the
// add-on. The payload includes:
//   - event.authorizationEventObject.userIdToken  (a Google-signed JWT)
//   - event.docs.matchedUrl.url                   (current doc URL, when open)
//   - event.commonEventObject.parameters          (button action params)
// We respond with a JSON CardService render response.
//
// For our case, most of the real work (listing templates, running AI edits)
// lives in @cg/backend. The add-on just translates between Google's webhook
// format and our backend's REST endpoints.
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json({ limit: '2mb' }));

const ADDON_PORT = Number(process.env.ADDON_PORT ?? 4100);
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';
const EXPECTED_AUDIENCE = process.env.GOOGLE_CLIENT_ID ?? '';

const googleAuth = new OAuth2Client();

interface AddonEvent {
  commonEventObject?: {
    parameters?: Record<string, string>;
    formInputs?: Record<string, { stringInputs?: { value?: string[] } }>;
  };
  docs?: {
    id?: string;
    title?: string;
    matchedUrl?: { url?: string };
  };
  authorizationEventObject?: {
    userIdToken?: string;
    userOAuthToken?: string;
  };
}

async function verifyUser(event: AddonEvent): Promise<{ email: string } | null> {
  const idToken = event.authorizationEventObject?.userIdToken;
  if (!idToken || !EXPECTED_AUDIENCE) return null;
  try {
    const ticket = await googleAuth.verifyIdToken({
      idToken,
      audience: EXPECTED_AUDIENCE,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) return null;
    return { email: payload.email };
  } catch (err) {
    console.error('ID token verification failed:', err);
    return null;
  }
}

// --------------------------------------------------------------------------
// Single webhook router
// --------------------------------------------------------------------------

app.post('/webhook', async (req, res) => {
  const event = req.body as AddonEvent & { type?: string; commonEventObject?: { action?: { name?: string } } };
  const actionName =
    (event as unknown as { action?: { name?: string } }).action?.name ??
    'onHomepage';

  try {
    switch (actionName) {
      case 'onHomepage':
      case 'onDocsHomepage':
        return res.json(await handleHomepage(event));
      case 'onPickTemplate':
        return res.json(await handlePickTemplate(event));
      case 'onRunAIEdit':
        return res.json(await handleRunAIEdit(event));
      default:
        return res.json({
          renderActions: { action: { notification: { text: `Unknown action: ${actionName}` } } },
        });
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.json({
      renderActions: {
        action: { notification: { text: err instanceof Error ? err.message : 'Error' } },
      },
    });
  }
});

// --------------------------------------------------------------------------
// Action handlers
// --------------------------------------------------------------------------

async function handleHomepage(event: AddonEvent): Promise<unknown> {
  const identity = await verifyUser(event);
  const templates = identity ? await fetchTemplatesForEmail(identity.email) : [];
  return {
    renderActions: {
      action: {
        navigations: [
          {
            pushCard: buildHomeCard({
              userDisplayName: identity?.email.split('@')[0],
              templates,
              backendUrl: BACKEND_URL,
            }),
          },
        ],
      },
    },
  };
}

async function handlePickTemplate(event: AddonEvent): Promise<unknown> {
  const templateId = event.commonEventObject?.parameters?.templateId;
  if (!templateId) return notification('No templateId in action');
  // Real implementation: pop a variable-entry form; on submit, call
  // POST /contracts/generate with the current user. For the skeleton we
  // just return a placeholder notification.
  return notification(`TODO: render variable form for template ${templateId}`);
}

async function handleRunAIEdit(event: AddonEvent): Promise<unknown> {
  const instructionInput =
    event.commonEventObject?.formInputs?.ai_instruction?.stringInputs?.value?.[0];
  if (!instructionInput) return notification('Please enter an instruction');

  const docUrl = event.docs?.matchedUrl?.url;
  const docId = event.docs?.id ?? extractDocId(docUrl);
  if (!docId) return notification('Open a Google Doc first');

  const identity = await verifyUser(event);
  if (!identity) return notification('Sign-in required');

  const resp = await fetch(`${BACKEND_URL}/ai/edit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // In production the backend would look up the user by their email
      // (from the verified ID token), not trust a header. Treat this as a
      // TODO to wire up proper add-on → backend authentication.
      'X-User-Email': identity.email,
    },
    body: JSON.stringify({
      driveFileId: docId,
      instruction: instructionInput,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return notification(`Edit failed: ${resp.status} ${text.slice(0, 80)}`);
  }
  return notification('AI edit applied.');
}

function extractDocId(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/document\/d\/([^/]+)/);
  return m?.[1] ?? null;
}

async function fetchTemplatesForEmail(_email: string): Promise<Array<{ id: string; name: string }>> {
  // TODO: call backend using a service token or signed request; backend
  // resolves the email → user → templates. For now return empty.
  return [];
}

// --------------------------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'contract-generator-addon' });
});

app.listen(ADDON_PORT, () => {
  console.log(`✔ addon webhook listening on http://localhost:${ADDON_PORT}`);
  console.log(`  Expose with: ngrok http ${ADDON_PORT}`);
  console.log(`  Then point appsscript.json → httpOptions.url at the ngrok URL + '/webhook'`);
});
