# Password Recovery

Players can request a password reset from the login page. Reset links expire
after 60 minutes, work only once, and are stored in the database as hashes.

## Email Delivery

Configure these environment variables in Vercel to send reset links:

```text
APP_BASE_URL=https://show-ring-game.vercel.app
RESEND_API_KEY=...
PASSWORD_RESET_FROM_EMAIL=ShowRing Game <passwords@example.com>
```

The sending address must be permitted by the configured Resend account. The
browser receives the same response whether or not an account exists.

## Support Link

Until email delivery is configured, a support link can be generated for an
existing account from the repository root:

```powershell
$env:DATABASE_URL=((Get-Content .env | Select-String '^DATABASE_URL=').Line -replace '^DATABASE_URL=','' -replace '"','')
npm.cmd --workspace apps/web run password-reset-link -- tester@example.com
```

Treat the generated URL like a temporary password. Send it only to the player
who requested the reset.
