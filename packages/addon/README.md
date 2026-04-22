# @cg/addon

HTTP-backed Google Workspace Add-on. Runs as an Express server that receives
JSON webhook events from Google and responds with CardService JSON describing
the sidebar UI to render.

## What it does (today)

- Shows a homepage card with an AI-edit instruction input
- Runs AI edits by calling the backend's `/ai/edit` endpoint with the current Doc's ID
- Lists the user's templates (stub — wire up auth to fill this in)

## What to build next

- Variable-entry form card after picking a template
- Call `POST /contracts/generate` and return a card that links to the new contract
- Read the user's current selection (via the Docs API with `documents.currentonly` scope) for scoped AI edits
- Proper add-on → backend authentication (signed Google ID token instead of email header)

## Local dev

```bash
npm run dev:addon          # starts the webhook server on :4100
ngrok http 4100            # expose it to Google
```

## Deploying the add-on for testing

1. In Google Cloud Console → **Google Workspace Marketplace SDK**, create a new
   app configuration.
2. Under "App Configuration", upload `appsscript.json` from this package. Edit
   `httpOptions.url` to point at `<your-ngrok-url>/webhook`.
3. Under "Deployment Access", limit to your email (or domain) while testing.
4. Save & install the add-on privately.
5. Open any Google Doc, click the Contract Generator icon in the right rail.

## How the webhook works

Every card interaction sends the same JSON shape to your `/webhook` endpoint,
with `action.name` indicating which button was pressed. Example payload:

```json
{
  "action": { "name": "onRunAIEdit" },
  "commonEventObject": {
    "formInputs": {
      "ai_instruction": { "stringInputs": { "value": ["Tighten the indemnification clause"] } }
    }
  },
  "docs": {
    "id": "1abc...",
    "matchedUrl": { "url": "https://docs.google.com/document/d/1abc.../edit" }
  },
  "authorizationEventObject": {
    "userIdToken": "eyJ…",
    "userOAuthToken": "ya29…"
  }
}
```

Your response tells Google what to render next:

```json
{
  "renderActions": {
    "action": {
      "navigations": [{ "pushCard": { "sections": [ /* ... */ ] } }]
    }
  }
}
```

See Google's docs for the full CardService JSON schema:
https://developers.google.com/workspace/add-ons/concepts/card-interfaces

## Security notes

- `authorizationEventObject.userIdToken` is a signed JWT you **must** verify
  before trusting the `email` claim. We do this with `google-auth-library`.
- Never trust request headers from the add-on to identify the user; always
  re-verify the ID token on each request.
- Your backend should issue its own auth (e.g. swap the Google ID token for
  a short-lived backend JWT) rather than treating the Google ID token as a
  session token.
