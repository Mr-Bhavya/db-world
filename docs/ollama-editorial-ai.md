# Ollama for cinema editorial generation

The backend calls Ollama locally when an admin selects **Generate with AI** on a
cinema record. The default address is `http://127.0.0.1:11434` and the default model
is `qwen2.5:3b`. Ollama availability, model, timeout and batch size can be edited at
runtime under **Admin → Settings → Cinema**. Scheduling, enable/disable, manual run,
history, counts and logs live under **Admin → Scheduler → Cinema Editorial AI**.

No API key, cloud account or public Ollama port is needed. The request stays on the
Pi; the backend sends structured catalogue facts and short review excerpts to the
local model and stores the resulting copy with `editorialSource=AI`.

## Raspberry Pi 5 (8 GB RAM) setup

On the Pi:

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable --now ollama
ollama pull qwen2.5:3b
```

Check Ollama is local and the model is ready:

```bash
curl -sS http://127.0.0.1:11434/api/tags
ollama list
ollama run qwen2.5:3b "Reply with exactly: Ollama is ready"
```

The Ollama service should remain bound to loopback. Do not expose port `11434`
through Cloudflare, nginx, the router, or UFW.

Because `dbworld-app` uses Docker `network_mode: host`, the backend inside the
container reaches the host Ollama process at `127.0.0.1:11434` without additional
network configuration.

## Backend configuration

Defaults require no environment changes. Manage the URL, model, timeout, automatic
generation, schedule and batch size under **Admin → Settings → Cinema**.

After changing the model:

```bash
ollama pull <model-name>
sudo systemctl restart dbworld-app
```

## Enable automatic generation

The admin button works immediately once Ollama is ready. Automatic generation is
off by default so the first deployment cannot unexpectedly process the whole
catalogue. Enable the **Cinema Editorial AI** job on the Scheduler page.

After testing a few records, edit its cron and enable **Cinema Editorial AI** in
the Scheduler page.

At the configured time (04:30 IST by default) the job processes at most five
PUBLISHED records with no editorial note, one at a time. It stops on the first
Ollama error and never overwrites manual or existing AI copy. Adjust the batch
only after checking Pi memory and normal application latency.

## Resource guidance

- Start with `qwen2.5:3b`; it is a practical quality/size compromise for 8 GB.
- `llama3.2:3b` is a reasonable alternative.
- Avoid running 7B/8B models while the full Java/MySQL/Redis/media stack is active.
- Generate one title at a time through the admin action.
- Watch memory during the first generation:

```bash
watch -n 2 'free -h; docker stats --no-stream'
```

Stop using Ollama if normal application latency, MySQL, Redis or media processing
becomes unstable. The content endpoint reports an explicit 503 if Ollama is not
running; existing saved editorial text remains available.

## Content and indexing behavior

- The model receives structured public facts, aggregate ratings and capped review
  excerpts. It is instructed not to quote reviews or invent facts.
- Generated content is labelled **DB World AI take** on the public detail page.
- The generated guide includes a cautious recommendation category, an **AI evidence
  confidence** score, “Best for”, and “Consider”. These are not user ratings and are
  never displayed as stars.
- IPO AI analysis is a separate **IPO AI Analysis** scheduler job. It labels output
  as general information—not investment advice—and uses APPLY / CONSIDER / WAIT /
  NOT_ENOUGH_DATA plus an evidence-confidence score. GMP is always described as
  unofficial and non-predictive.
- Manual editorial text requires explicit confirmation before AI replacement.
- A PUBLISHED record becomes indexable and enters the sitemap only when the generated
  note passes the originality-length gate.
- Generate gradually, starting with a few records, and inspect the output before
  indexing hundreds of pages.
