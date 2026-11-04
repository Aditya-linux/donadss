# Connected applications

Connected apps extend Mission input and delivery. They never inherit wallet
authority and never approve a financial checkpoint.

| Connector | Initial use | Minimum permission model |
|---|---|---|
| Google Workspace | Read selected purchase receipts; export reports to Drive | Gmail read-only and Drive app-created files |
| Slack | Start non-financial Missions and receive status | Explicit channel access and bot messages |
| GitHub | Read issue context and draft task updates | Selected repositories only |
| Telegram | Mobile status and approval deep links | User-linked chat only |

## Activation requirements

1. Register the application with the provider.
2. Add the production and preview callback URLs.
3. Put client secrets in Vercel server-only environment variables.
4. Generate a 32-byte connector encryption key in a secret manager.
5. Implement and test OAuth state, PKCE where supported, callback replay
   protection, encrypted refresh-token storage and revocation.
6. Validate inbound webhook signatures and timestamps.
7. Record every connector read/write as a Mission event.
8. Complete disconnect and data-deletion tests.

The current product exposes a connector catalog and configuration status. Live
OAuth activation remains deliberately unavailable until the callback and encrypted
token tests are implemented for the selected provider.
