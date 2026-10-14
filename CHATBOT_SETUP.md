# Landing-page reservation assistant

The public landing page includes an assistant for current package prices, aggregate date availability and the three-calendar-day preparation rule (Asia/Manila). No booking or payment is made through chat.

## Enable GroqCloud (default, Free plan)

1. Create an account at [GroqCloud](https://console.groq.com) and stay on the Free plan.
2. Create a key at [API Keys](https://console.groq.com/keys), following the [official quickstart](https://console.groq.com/docs/quickstart).
3. Save these entries privately in the ignored `supabase/functions/.env`:

```dotenv
AI_PROVIDER=groq
GROQ_API_KEY=your_key
GROQ_MODEL=openai/gpt-oss-20b
```

The model runs on Groq's API; its name does not require an OpenAI API subscription/key. It supports strict [structured outputs](https://console.groq.com/docs/structured-outputs). The Free plan has request/token limits, not unlimited usage. View your organization's actual limits in the console; [published limits](https://console.groq.com/docs/rate-limits) may change. Free-plan exhaustion produces an unavailable response/quick-answer fallback; this application does not upgrade a plan or switch to the paid provider automatically.

4. Upload secrets and deploy from the repository terminal:

```powershell
npx.cmd --yes supabase@2.120.0 secrets set --project-ref azjzapendjsfouysueiw --env-file supabase/functions/.env
npx.cmd --yes supabase@2.120.0 functions deploy public-assistant --project-ref azjzapendjsfouysueiw --use-api
```

Never use a `VITE_` variable for provider keys, paste them in chat, or commit them. The server defaults to Groq and will not use an OpenAI key unless `AI_PROVIDER=openai` is explicitly set.

## Optional paid OpenAI provider

1. Open [OpenAI API keys](https://platform.openai.com/api-keys) and create a project API key. Follow the [official quickstart](https://developers.openai.com/api/docs/quickstart).
2. Add `OPENAI_API_KEY=your_key` to the ignored local `supabase/functions/.env`. Alternatively, save `OPENAI_API_KEY` directly in your Supabase project's Edge Function secrets. Never use a `VITE_` variable for this key, paste it in chat, or commit the file.
3. Explicitly set `AI_PROVIDER=openai`. The default OpenAI model is `gpt-5.4-mini`, which supports the Responses API and structured outputs. Set optional `OPENAI_MODEL` to override it with a compatible model. [Model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini).
4. Upload secrets and deploy using the commands above. OpenAI API usage requires usable credits/billing access.

Supabase CLI login is required. `APP_URL` must match the production origin without a trailing slash. Local port 5173 is also allowed for development. The public endpoint intentionally has `verify_jwt=false`; it uses an anon database client and RLS, not a service-role client.

## Behavior and verification

The selected provider extracts a bounded question intent using structured outputs. The server renders facts from `menu_sets` and `available_dates`, so model prose cannot change prices or invent slots. Test “Magkano for 50 guests?”, “Available ba bukas?”, a valid ISO date, and an unrelated question. An AI response displays “AI assisted”; quick buttons display “Quick answer”.

Without a valid key/API access, free-text AI is unavailable; quick buttons still query current public data. OpenAI calls use `store:false`. Up to six previous messages are sent as context; the application does not persist transcripts. This does not certify zero retention by either provider. Do not enter personal or payment details.

If the provider returns `credit_balance_exhausted`, add credits in the organization [billing settings](https://platform.openai.com/settings/organization/billing/overview), then verify chat again. This is a billing balance issue, not proof of a working AI response. [Official error guide](https://developers.openai.com/api/docs/guides/error-codes).

Requests, history, response tokens, timeouts and per-instance concurrency are bounded. IP and AI request limits are ephemeral and reset with Edge instance restarts; they are not a durable global quota. Before substantial public traffic, add a durable gateway quota/abuse control and configure the chosen provider's usage controls. Origin checks alone do not authenticate callers. No new database migration is needed.

The paper under `docs/final/` records the earlier audited application snapshot. This assistant was added afterwards; its live AI readiness must be verified separately before presenting it as deployed and operational.
