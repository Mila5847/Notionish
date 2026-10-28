# Notionish

Self-hosted, block-based workspace that runs as a **Home Assistant add-on**. See
[PLAN.md](./PLAN.md) for the original design.

It opens from the Home Assistant sidebar through **Ingress**:

- **Sign-in is Home Assistant's.** There is no separate login. Each Home
  Assistant user gets their own Notionish account and workspace on first visit,
  and their name is kept in sync.
- **The theme is Home Assistant's.** It follows the active theme and dark mode.
- **Nothing extra is exposed.** The add-on publishes no ports, so it is only
  reachable through Home Assistant, e.g. via Nabu Casa or your reverse proxy.

The API trusts the `X-Remote-User-*` headers only from the Supervisor
(`172.30.32.2`). The repository root is the add-on (`config.yaml`,
`Dockerfile`, `addon/start.mjs`).

## Install in Home Assistant

Requires Home Assistant OS or Supervised (Ingress is a Supervisor feature).

1. **Add this repository:** *Add-on store → ⋮ → Repositories* and add
   `https://github.com/Mila5847/Notionish`. For a private repository, use
   `https://<user>:<token>@github.com/Mila5847/Notionish` with a read-only
   GitHub token. For a branch, append `#<branch>`.
2. Find **Notionish** in the store (refresh with *⋮ → Check for updates* if
   needed) and click **Install**. The image is built on your Home Assistant
   machine and the first build takes several minutes.
3. Start it and enable **Show in sidebar**. Open **Notionish** from the sidebar.

Alternatively, install it as a **local add-on** without GitHub: copy the
repository (without `node_modules`) to `/addons/notionish/` on the Home
Assistant host, using the Samba or SSH add-on. Then use *Add-on store → ⋮ →
Check for updates* and install it from *Local add-ons*.

Every Home Assistant user, including non-admins, can open the panel. Set
`panel_admin: true` in `config.yaml` to limit it to admins.

### Notes-only accounts

To give someone access to Notionish without making them an admin:

1. *Settings → People → Add person*, enable *Allow person to login*, and leave
   *Administrator* off. Optionally enable *Can only log in from the local
   network*.
2. Log in as that user and bookmark the Notionish panel URL (the address shown
   when it is open from the sidebar). In *Profile → Edit sidebar*, hide the
   other panels.

Home Assistant has no per-panel permissions. A non-admin user can still view
dashboards and control entities, for example through the API. Hiding panels
only tidies the interface; it is not access control.

### Options

| Option | Description |
|---|---|
| `unsplash_access_key` | Optional. Enables the Unsplash cover picker. |
| `database_name`, `database_url` | Only for the one-time import from MariaDB, see below. |

The database is SQLite (`/data/notionish.db`) and uploads are in `/data/uploads`,
both in the add-on's own storage and so in Home Assistant backups. No database
add-on is needed.

### Moving from MariaDB (versions before 0.2)

Up to 0.1 the data lived in the MariaDB add-on. On its first start, 0.2 imports
it into SQLite by itself: from the MariaDB add-on's `database_name` database
(default `notionish`), or from a `mysql://` URL in `database_url`. The result is
logged and written to `/data/imported-from-mariadb.json`. If the import fails
nothing is half-written and the next start tries again. Once Notionish shows
your pages, the MariaDB add-on can be removed (unless something else uses it).

### Sharing workspaces

In *Share*, invite other Home Assistant users by their Home Assistant
**username**. They must open Notionish once first.

### Updating

Bump `version` in `config.yaml` and push. Home Assistant will offer the update
and rebuild the image.

## Local development

Requires Node 20+. Outside Home Assistant there are no user headers, so
`DEV_HA_USER` (honoured only when `NODE_ENV=development`) signs you in as that
Home Assistant username.

```bash
# api (SQLite in packages/api/prisma/dev.db)
cd packages/api
cp ../../.env.example .env
npm install
npx prisma migrate dev
npm run dev

# web (in another terminal)
cd packages/web
npm install
npm run dev
```

- Web: http://localhost:5173 (proxies API calls to http://localhost:4000)
- Theme follows Home Assistant only when embedded; standalone it has its own
  light/dark toggle in the command palette (⌘K).
