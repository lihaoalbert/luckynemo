---
summary: "Route credential-scoped models through LuckyNemo Router and show managed quotas"
title: "LuckyNemo Router"
read_when:
  - You want one managed key for multiple model providers
  - You need LuckyNemo Router model discovery or quota reporting in LuckyNemo
---

LuckyNemo Router gives LuckyNemo one policy-scoped key for multiple upstream
model providers. The bundled `luckynemo-router` plugin discovers only the
models allowed for that key, routes each model through its declared protocol,
and reports the key's budget and aggregate usage on LuckyNemo usage surfaces.

Upstream credentials and provider-specific forwarding stay in LuckyNemo
Router, so you never install or authenticate each upstream provider plugin on
the LuckyNemo host. The plugin ships bundled with LuckyNemo
(`enabledByDefault: true`); you only need an issued LuckyNemo credential.

| Property      | Value                                    |
| ------------- | ---------------------------------------- |
| Provider      | `luckynemo`                              |
| Plugin        | bundled (included in LuckyNemo)          |
| Auth          | `LUCKYNEMO_API_KEY`                      |
| Default URL   | `https://kidsai.ibi.ren`                 |
| Model catalog | Credential-scoped via `/v1/catalog`      |
| Quotas        | Monthly budget and usage via `/v1/usage` |

## Getting started

<Steps>
  <Step title="Get a scoped credential">
    Ask your LuckyNemo administrator for a credential whose policy includes
    the providers, models, and monthly budget you should use. Credentials are
    revealed once when issued.
  </Step>
  <Step title="Configure LuckyNemo">
    ```bash
    export LUCKYNEMO_API_KEY="..."
    luckynemo onboard --auth-choice luckynemo-api-key
    luckynemo plugins enable luckynemo-router
    ```

    `luckynemo-router` is bundled and enabled by default. If your configuration
    sets `plugins.allow`, add `luckynemo-router` to that list before enabling
    it. For a custom deployment, set `models.providers.luckynemo.baseUrl` to
    the router origin; the default is `https://kidsai.ibi.ren`.

  </Step>
  <Step title="List granted models">
    ```bash
    luckynemo models list --all --provider luckynemo
    ```

    Use the returned model refs exactly as shown. They retain the upstream
    namespace, such as `luckynemo/openai/gpt-5.5`,
    `luckynemo/anthropic/claude-sonnet-4-6`, or
    `luckynemo/google/gemini-3.5-flash`. If `agents.defaults.models` is an
    allowlist in your configuration, add each selected LuckyNemo ref to it.

  </Step>
  <Step title="Select a model">
    ```bash
    luckynemo models set luckynemo/<provider>/<model>
    ```

    You can also select a returned model for one run with
    `luckynemo agent --model luckynemo/<provider>/<model> --message "..."`.

  </Step>
</Steps>

## Managed non-interactive deployment

Keep the proxy key in the workload's secret injection and store only a
SecretRef in `luckynemo.json`. The canonical managed fields are:

| Purpose       | Config or environment field                                             |
| ------------- | ----------------------------------------------------------------------- |
| Router origin | `models.providers.luckynemo.baseUrl`                                    |
| Credential    | `models.providers.luckynemo.apiKey` -> env SecretRef                    |
| Secret value  | `LUCKYNEMO_API_KEY` in the gateway process environment                  |
| Default model | `agents.defaults.model.primary` -> `luckynemo/<provider>/<model>`       |
| Workload tag  | `models.providers.luckynemo.headers.X-ClawRouter-Project-Id` (optional) |

For example, a deployment controller can own this JSON5 patch:

```json5
{
  plugins: {
    entries: { "luckynemo-router": { enabled: true } },
  },
  models: {
    providers: {
      luckynemo: {
        baseUrl: "https://router.internal.example",
        apiKey: {
          source: "env",
          provider: "default",
          id: "LUCKYNEMO_API_KEY",
        },
        headers: {
          // The X-ClawRouter-* header names are the server protocol contract.
          "X-ClawRouter-Project-Id": "fakeco",
        },
      },
    },
  },
  agents: {
    defaults: {
      model: { primary: "luckynemo/openai/gpt-5.5" },
    },
  },
}
```

If the deployment sets `plugins.allow`, preserve its existing entries and add
`luckynemo-router`. Validate and apply without an interactive wizard:

```bash
luckynemo config patch --file ./luckynemo-router.patch.json5 --dry-run --json
luckynemo config patch --file ./luckynemo-router.patch.json5
```

The dry run resolves the SecretRef but never prints its value. To rotate the
credential, update the external Secret that supplies `LUCKYNEMO_API_KEY` and
restart the gateway workload so the new process environment is loaded. The
config file and model reference do not change.

For a source-built standalone Docker gateway, LuckyNemo Router is already
included in the root runtime. Select only the channel plugin that needs
separate packaging, such as `OPENCLAW_EXTENSIONS=clickclack`, `slack`, or
`msteams`; see
[source-built images with selected plugins](/install/docker#source-built-images-with-selected-plugins).
Archive/appliance deployments must package the same landed source through their
own artifact pipeline rather than consuming the OCI image.

## Readiness and live proof

These checks prove different boundaries; do not substitute one for another:

```bash
# Router process health only; no credential or upstream model is exercised.
curl -fsS https://router.internal.example/v1/health

# LuckyNemo gateway startup readiness only; no model call is made.
curl -fsS http://127.0.0.1:18789/readyz

# Credential-scoped catalog discovery.
luckynemo models list --all --provider luckynemo --json

# Minimal real inference probe through the configured LuckyNemo provider.
luckynemo models status --probe --probe-provider luckynemo --probe-max-tokens 8 --json

# Workload canary using an exact granted model ref.
luckynemo agent --agent main \
  --model luckynemo/openai/gpt-5.5 \
  --message "Reply exactly: LUCKYNEMO_CANARY_OK" \
  --json
```

Use a model returned by the scoped catalog instead of copying the example
model blindly. A successful `/readyz` response means the gateway can serve
requests; it does not claim that LuckyNemo Router, its credential, or an
upstream provider is ready. The model probe and agent canary are the inference
proofs.

For live diagnosis, issue the canary and inspect the gateway's standard logs.
The existing metadata-only model transport diagnostics emit lines shaped like:

```text
[model-fetch] start provider=luckynemo api=openai-responses model=openai/gpt-5.5 method=POST url=https://router.internal.example/v1/responses
[model-fetch] response provider=luckynemo api=openai-responses model=openai/gpt-5.5 status=200
```

The plugin sends bounded `X-ClawRouter-Client`, `X-ClawRouter-Agent-Id`, and
`X-ClawRouter-Session-Id` headers when those identifiers are available. (The
`X-ClawRouter-*` header names are the server protocol contract and are kept
unchanged; the client identifier value is `luckynemo`.) It also maps the model
call's diagnostic `callId` (`<run-id>:model:<n>`) to `X-Request-ID`, so a
LuckyNemo model-call event can be joined to the router's metadata-only audit
trail. Values within the 128-character request-id budget are identical. Longer
values retain the `:model:<n>` suffix and a deterministic hash so distinct
calls remain bounded and joinable. Static deployment metadata such as
`X-ClawRouter-Project-Id` can be set in the provider `headers` map. Agent and
session attribution headers retain their separate 256-character limit.
Automatic request ids containing characters outside the router's ASCII
identifier set use the same deterministic bounded form. Explicit configured
headers, including any case variant of `X-Request-ID`, win over automatic
values. The transport diagnostic records routing and response metadata; it
does not log credentials, request ids, prompts, or completions. The router's
own audit event provides the selected upstream provider and content-retention
state.

## Model discovery

`GET /v1/catalog` returns `{ providers: [...] }`, where each provider entry
lists its own `models[]` (with upstream id, capabilities, and pricing) and its
supported request routes. LuckyNemo does not ship a second, fixed list of
router models. A catalog model is advertised as a LuckyNemo model when:

- the credential's policy grants its provider;
- the catalog model advertises a supported LLM capability (`llm.responses`,
  `llm.chat`, `llm.messages`, or `llm.stream` with a matching streaming
  route); and
- the provider exposes a matching route for one of the transports below.

Adding a model to a supported router provider needs no LuckyNemo release: the
next catalog refresh (cached 60 seconds per credential scope) discovers it. A
model that needs a new wire protocol requires plugin support first.

## Protocol and provider plugins

LuckyNemo Router owns upstream credentials; its catalog tells LuckyNemo which
transport to use, so you never install every upstream company's auth plugin.

| Catalog capability / route                               | LuckyNemo transport    |
| -------------------------------------------------------- | ---------------------- |
| `llm.responses` (OpenAI-compatible provider)             | `openai-responses`     |
| `llm.chat` (OpenAI-compatible provider)                  | `openai-completions`   |
| `llm.messages` + `anthropic.messages` route              | `anthropic-messages`   |
| `llm.stream` + streaming `google.generate_content` route | `google-generative-ai` |

The plugin also applies the matching replay and tool-schema policies for those
families (OpenAI/DeepSeek/Gemini tool-schema compat; native Anthropic and
Google Gemini replay policies). A catalog provider exposing only an
unsupported request format is intentionally not advertised as a LuckyNemo text
model. Normalize those providers to one of the supported contracts in the
router rather than sending an incompatible payload.

## Image and video generation

The same scoped key also unlocks the proxy's media endpoints, so agents get
the `image_generate` and `video_generate` tools without any upstream provider
plugin:

- `POST /v1/images/generations` is OpenAI-images compatible
  (`{model, prompt, size?, n?, image_url?}`). The default model is
  `doubao-seedream-5-0-260128`. An optional reference image is sent as
  `image_url` (data URL) for image-to-image requests.
- `POST /v1/video/tasks` plus `GET /v1/video/tasks/{id}` submit and poll
  video tasks (`{model, prompt, ratio, duration, resolution, image_urls?,
firstFrame?, lastFrame?}`). Models: `doubao-seedance-2-0-fast-260128`
  (default), `doubao-seedance-2-0-260128`, and
  `doubao-seedance-2-0-mini-260615`. The provider validates parameters locally
  before submitting: `duration` must be 4-15 seconds, `ratio` must be one of
  `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, `21:9` (upstream silently falls back on
  unknown ratios), and `resolution` is `480p`/`720p`/`1080p`. Up to nine
  reference images are forwarded as `image_urls` (URL or data URL). The
  `luckynemo.firstFrame`/`luckynemo.lastFrame` provider options send a
  first/last frame pair (URL or image buffer each); the pair must be given
  together and cannot be combined with reference images. Generation takes
  minutes, so the provider's default timeout is 600 seconds; the returned
  signed `videoUrl` expires after about an hour and is downloaded immediately.
  Upstream failures arrive as HTTP 502 with a JSON message embedded in
  `error.message`; the provider unwraps it so errors show the upstream reason
  (for example `InvalidParameter`) instead of a bare 502.

Point the tools at the LuckyNemo models in `luckynemo.json`:

```json5
{
  agents: {
    defaults: {
      imageGenerationModel: { primary: "luckynemo/doubao-seedream-5-0-260128" },
      videoGenerationModel: { primary: "luckynemo/doubao-seedance-2-0-fast-260128" },
    },
  },
}
```

Both capabilities honor `models.providers.luckynemo.baseUrl` (with or without
the `/v1` suffix) and the `LUCKYNEMO_API_KEY` credential; no extra setup is
required once the router key is configured.

## Quotas and usage

The router's `/v1/usage` response feeds the normal LuckyNemo provider-usage
surfaces: request, token, and spend totals, plus a monthly budget window when
the key has a limit. Unmetered keys still show aggregate usage without a
percentage window.

Quota lookup uses the same scoped key as model discovery. A failed quota
lookup does not block model execution.

Check the live snapshot with:

```bash
luckynemo status --usage
luckynemo models status
```

The same provider snapshot is available to `/status` in chat and LuckyNemo's
usage UI. The budget is policy-wide, so requests made by another client using
the same router policy can change the remaining percentage.

## Troubleshooting

| Symptom                                 | Check                                                                                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| No LuckyNemo models                     | Confirm the plugin is enabled and allowed by `plugins.allow`, then check that the credential is active and grants at least one ready provider. |
| A configured LuckyNemo model is missing | Inspect its `/v1/catalog` capability and route support. Unsupported transport contracts are intentionally filtered.                            |
| `Unknown model: luckynemo/...`          | Add the exact catalog ref to `agents.defaults.models` when that configuration map is being used as an allowlist.                               |
| `401` or `403` from catalog or usage    | Reissue or re-scope the LuckyNemo credential; LuckyNemo does not fall back to upstream provider keys.                                          |
| Model call fails after discovery        | Check the provider connection and upstream health in the router, then retry after its readiness state recovers.                                |
| Usage has totals but no percentage      | The policy is unmetered; add a monthly budget in the router to expose a percentage window.                                                     |

## Security behavior

- Catalog discovery is scoped to the configured proxy key and cached per credential scope (agent dir, workspace dir, auth profile id, and base URL).
- The proxy key is attached only at request dispatch; it is not stored in model metadata.
- Automatic attribution and request-correlation values are trimmed and control-character rejected before dispatch. Attribution values are bounded to 256 characters; request ids are bounded to 128.
- Model transport diagnostics contain metadata only and never include the proxy key or model content.
- Native Anthropic and Gemini model ids are rewritten to their upstream ids only at dispatch.
- Unsupported or ungranted catalog rows fail closed and are not selectable.

## Related

<CardGroup cols={2}>
  <Card title="Model providers" href="/concepts/model-providers" icon="layers">
    Provider configuration and model selection.
  </Card>
  <Card title="Usage tracking" href="/concepts/usage-tracking" icon="chart-line">
    LuckyNemo usage and status surfaces.
  </Card>
</CardGroup>
