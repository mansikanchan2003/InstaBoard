"""Provider-independent AI layer (Phase 7).

* ``providers``  — adapters that turn a prompt + JSON schema into raw structured output (Anthropic, OpenAI-compatible).
* ``service``    — business-facing gateway: budgets, retries with backoff, Pydantic validation, usage accounting.
* ``schemas``    — the only shapes model output may take (validated before anything is stored or returned).
* ``prompts``    — versioned system prompts; untrusted text is always passed as delimited JSON data.
* ``safety``     — sanitising untrusted text, prompt-injection heuristics and numeric-claim verification.

Business logic (``app.services.intelligence``) never imports a concrete provider.
"""
