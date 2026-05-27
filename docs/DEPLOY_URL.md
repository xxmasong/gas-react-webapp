# Deployment reference (live project)

> Created 2026-05-27. Git-ignore this if the IDs are sensitive to you.

## Project

- **scriptId:** `1z_J4gESMkKVbiw8tPqlQkkrF_PKzkatNJrrXHS7ORvMqBnd-UDPtLMSR`
- **Script editor:** https://script.google.com/d/1z_J4gESMkKVbiw8tPqlQkkrF_PKzkatNJrrXHS7ORvMqBnd-UDPtLMSR/edit
- **Backend Sheet (database):** https://drive.google.com/open?id=1D_tPksBpflSUD2Hx4I_MYHPQL2yYz_V-c-1uVkkaaIo

## Web app URLs

| Deployment | ID | URL (`…/exec`) |
|---|---|---|
| **@HEAD (primary)** | `AKfycbwSiJvrVVaBrF3siy46laliSp2aHpdcdN0XW1MdazQ` | https://script.google.com/macros/s/AKfycbwSiJvrVVaBrF3siy46laliSp2aHpdcdN0XW1MdazQ/exec |
| @1 (snapshot) | `AKfycbyUa3nmTH0SwbbrLs3hIy1jV0-LJA-DBukGLpcptwdW6i3JpBOBcOCa26_zp-oZSuxf` | https://script.google.com/macros/s/AKfycbyUa3nmTH0SwbbrLs3hIy1jV0-LJA-DBukGLpcptwdW6i3JpBOBcOCa26_zp-oZSuxf/exec |

**Primary = @HEAD.** `npm run deploy` pushes code to @HEAD, so this URL always
reflects the latest build. Use @1 (or future `npm run deploy:version` snapshots)
only when you need a frozen release.

## Notes

- Opening `/exec` redirects to `accounts.google.com/ServiceLogin` for anonymous
  visitors — that's the expected auth gate, not an error. Sign in (and approve
  the Sheets authorization on first run) to load the app.
- First data write auto-creates the `Items` sheet (cols: id, name, quantity, updatedAt).
