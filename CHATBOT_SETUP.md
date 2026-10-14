# Landing-page reservation assistant

The public landing page includes an assistant for current package prices, aggregate date availability and the three-calendar-day preparation rule (Asia/Manila). No booking or payment is made through chat.

## Enable OpenAI

1. Open [OpenAI API keys](https://platform.openai.com/api-keys) and create a project API key. Follow the [official quickstart](https://developers.openai.com/api/docs/quickstart).
2. Add `OPENAI_API_KEY=your_key` to the ignored local `supabase/functions/.env`. Alternatively, save `OPENAI_API_KEY` directly in your Supabase project's Edge Function secrets. Never use a `VITE_` variable for this key, paste it in chat, or commit the file.
3. The default model is `gpt-5.4-mini`, which supports the Responses API and structured outputs. Set optional `OPENAI_MODEL` to override it with a compatible model. [Model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini).
4. Upload secrets and deploy the new function from the repository terminal:

```powershell
npx.cmd --yes supabase@2.120.0 secrets set --project-ref azjzapendjsfouysueiw --env-file supabase/functions/.env
npx.cmd --yes supabase@2.120.0 functions deploy public-assistant --project-ref azjzapendjsfouysueiw --use-api
```

Supabase CLI login is required. `APP_URL` must match the production origin without a trailing slash. Local port 5173 is also allowed for development. The public endpoint intentionally has `verify_jwt=false`; it uses an anon database client and RLS, not a service-role client.

## Behavior and verification

OpenAI extracts a bounded question intent using [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). The server renders facts from `menu_sets` and `available_dates`, so model prose cannot change prices or invent slots. Test “Magkano for 50 guests?”, “Available ba bukas?”, a valid ISO date, and an unrelated question. An AI response displays “AI assisted”; quick buttons display “Quick answer”.

Without a valid key/API access, free-text AI is unavailable; quick buttons still query current public data. API calls use `store:false`. Up to six previous messages are sent as context; the application does not persist transcripts. This does not certify zero retention by the provider. Do not enter personal or payment details.

If the provider returns `credit_balance_exhausted`, add credits in the organization [billing settings](https://platform.openai.com/settings/organization/billing/overview), then verify chat again. This is a billing balance issue, not proof of a working AI response. [Official error guide](https://developers.openai.com/api/docs/guides/error-codes).

Requests, history, response tokens, timeouts and per-instance concurrency are bounded. IP and AI request limits are ephemeral and reset with Edge instance restarts; they are not a durable global cost limit. Before substantial public traffic, add a durable gateway quota/abuse control and configure OpenAI project usage controls. Origin checks alone do not authenticate callers. No new database migration is needed.

The paper under `docs/final/` records the earlier audited application snapshot. This assistant was added afterwards; its live AI readiness must be verified separately before presenting it as deployed and operational.
