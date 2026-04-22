# @cg/web

Next.js (App Router) web app. Talks to the backend via a same-origin `/api/backend/*`
rewrite so the session cookie is sent automatically.

## Pages

- `/` — landing + sign-in
- `/templates` — list templates, create a new one (opens a blank Doc in a new tab)
- `/templates/[id]` — variable form + "Generate contract"
- `/contracts` — list generated contracts
- `/contracts/[id]` — embedded Docs iframe + AI sidebar

## Design notes

- No auth library. The backend owns sessions; we just `credentials: 'include'`
  on fetches. Swapping in NextAuth/Auth.js later is straightforward if you want
  a server-side session.
- No state management library. `useState` + `useEffect` is enough for this size.
  If you grow you'll probably want SWR or React Query.
- Tailwind for styling. No component library yet — plain JSX. Add shadcn/ui
  whenever you want richer primitives.

## Things to build next

- A template detail page editor that previews the Doc + shows detected variables
  side by side
- Onboarding: first-run prompt to create a sample NDA template
- Contract status chip with dropdown to update
- Diff preview for AI edits before applying (currently edits apply directly)
