# Community Board

The Community board uses the existing ShowRing account, session, kennel, and
bulletin records. It does not use a separate login or external forum.

## Routes

- `/community`
- `/community/[categorySlug]`
- `/community/[categorySlug]/[topicId]`

Legacy `/bulletin` routes permanently redirect to the corresponding Community
route so existing inbox links and bookmarks continue to work.

## Administrator Access

Community administration is controlled by `User.isAdmin`. No account is made
an administrator automatically. From the repository root, grant or revoke the
role explicitly:

```powershell
$env:DATABASE_URL=((Get-Content .env | Select-String '^DATABASE_URL=').Line -replace '^DATABASE_URL=','' -replace '"','')
npm.cmd --workspace apps/web run admin:set -- player@example.com true
```

Use `false` as the final argument to revoke administrator access.

Administrators can manage category names, slugs, descriptions, order,
visibility, topic permissions, and reply permissions from `/community`. Topic
and reply moderation controls appear directly on topic pages.

## Category Policies

- `MEMBERS`: eligible player kennels and administrators may post.
- `ADMINS`: only administrators may post.
- `DISABLED`: posting is disabled.

Topic and reply policies are configured independently. An announcements
category normally uses `ADMINS` for topics and either `MEMBERS`, `ADMINS`, or
`DISABLED` for replies.

Moderation is non-destructive. Hidden and deleted topics or posts remain in the
database and are visible only to administrators.
