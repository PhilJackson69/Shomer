## Migrate to apiFetch + CSRF rotation/401-retry, idempotency, degraded-mode; add lint/CI/runtime guards

### Summary
This PR hardens the web/API integration and completes enterprise-grade observability.

- apiFetch client with transparent CSRF rotation, auth 401 retry, and idempotency keys
- Degraded-mode behavior and safe fallbacks to keep UX responsive during partial outages
- Metrics endpoint and Prometheus rules/alerts + Grafana dashboard shipped and documented
- Lint/CI/runtime guards to prevent regressions (no raw fetch, stricter ESLint rules)
- README overhaul: mission-first intro, technical overview, fixed links, badges

### Key Changes
- Web: `apiFetch` wrapper, CSRF token rotation, backoff & retry policies
- API: `/api/v1/metrics` endpoint, SLI counters and retry metrics
- Observability: Prometheus recording/alerting rules, Grafana dashboard JSON
- Docs: Production deployment checklist, SLO runbook, README polish

### Why
Improves reliability under auth/token churn, prevents duplicate writes, and gives operators real SLO visibility with actionable alerts.

### Rollout Plan
1. Merge to `main`
2. Deploy to staging; verify:
   - `curl -s $API/api/v1/metrics | grep csrf_rotations_total`
   - `curl -s $API/api/v1/metrics | grep api_fetch_retry_total`
3. Confirm Prometheus targets UP and rules loaded (<1s render)
4. Trigger test alerts; validate Slack/PagerDuty routing
5. Promote to production; watch 24h baseline (SLI ≥ 99.9%)

### Screenshots / Artifacts
- Grafana: `grafana-api-security-dashboard.json`
- Rules: `prometheus_rules_api_security*.yaml`, alerts files
- Checklist: `PRODUCTION_DEPLOYMENT_CHECKLIST.md`

### Backward Compatibility
- No breaking API changes. Frontend adopts safer request layer.

### Checklist
- [x] README updated (mission-first, badges, links)
- [x] SLO monitoring documented and tagged (`v1.0.0-monitoring`)
- [x] Web/API tested locally
- [x] Alerts fire to test channels





