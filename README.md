# Wishlist

A shared German-language wishlist with a Christmas video background. Add people,
manage their wishes, and mark gifts as completed on the public wishlist page.

## Run

Requires Docker with Compose. The existing deployment uses the external
`grabler-network`; create it once if it does not already exist:

```sh
docker network create grabler-network
docker compose up -d --build
```

Open <http://localhost:8080>. PostgreSQL data lives in the `postgres_data` Docker
volume. Rebuilding the application preserves it. Do not use `docker compose down
-v` unless you intend to delete the stored wishlists.

The frontend proxies `/api` to FastAPI. Ports 8020 (backend) and 5433 (PostgreSQL)
are also exposed by the existing Compose configuration. This is a shared,
unauthenticated app: anyone who can reach it can view and change wishlists.
Use a trusted network or an authenticated reverse proxy for a private deployment.
The supplied database credentials are development defaults.

## Using the app

- Add a person with a unique name and color.
- Open **Wunschliste bearbeiten** to add or edit wishes. **Bearbeiten** loads the
  existing name, link, and picture into the form; **Speichern** updates the same
  item, preserving its completion status. **Abbrechen** discards form changes.
- Leave the image input empty to keep the current picture, select a replacement,
  or check **Vorhandenes Bild entfernen**. Uploads accept PNG, JPEG, GIF and WebP
  up to 5 MB. Links must use HTTP or HTTPS.
- Public wishlists show completion checkboxes. Floating wishes stop while hovered
  or focused. They use the full viewport without top/bottom bounce padding.
  Border bounces rotate wishes to the front (at most once every three seconds),
  with a five-second fallback so every wish gets a turn. Hovered/focused wishes
  stay in front during interaction. Mobile cards use about half the previous width, with smaller pictures.
  The app respects the device’s reduced-motion preference without a motion button.
- Music is enabled by default. Browsers that block audible autoplay start it on the
  first interaction. The speaker icon at the top left toggles music and remembers
  the preference. Internal navigation and browser Back/Forward retain the same
  audio player, so the track continues uninterrupted. External sites and full page
  reloads leave the current player. Links open in the same tab by default.
- In the editor, the settings icon at the top right opens **Person löschen?**.
  Deletion is available only when the wishlist is empty, followed by a second
  confirmation. The API also enforces this rule, including concurrent item creation.
- Image previews support keyboard navigation, Escape to close, and focus restoration.

## Structure

- `backend/database.py`: PostgreSQL connection and additive startup schema setup.
- `backend/routes.py`: API, input validation, and transactional updates.
- `backend/main.py`: application lifespan and router registration.
- `frontend/templates`: overview, editor, and public wishlist pages.
- `frontend/js/common.js`: requests, error reporting, previews, and media controls.
- `frontend/js/navigation.js`: content navigation while retaining the media player;
  page scripts initialize within the current page root.
- `frontend/js/background-video.js`: two video elements overlap for a one-second
  crossfade. The outgoing frame stays visible until the incoming video is ready.
- `tests`: PostgreSQL integration tests and Chromium browser tests.

Existing data requires no destructive migration. Startup still adds missing URL
and image columns on older installations. New people are unique regardless of
capitalization; previously stored names that differ only by capitalization are
not automatically merged. Legacy item-by-name delete and completion routes remain
available. Item editing uses `PUT /people/{person}/items/{id}` with form fields
`item_name`, `item_link`, and `item_image`; empty optional fields clear them.

## Tests

Use a **disposable database**: API tests truncate its `people` and `items` tables.
Browser tests add their own test people. Never point either suite at production.

```sh
python3 -m venv .venv
.venv/bin/pip install -r tests/requirements.txt
.venv/bin/playwright install chromium
docker run --rm -d --name wishlist-test-db \
  -e POSTGRES_PASSWORD=wishlist-test -e POSTGRES_DB=wishlist_test \
  -p 127.0.0.1:55439:5432 postgres:16-alpine
TEST_DATABASE_URL=postgresql+psycopg://postgres:wishlist-test@127.0.0.1:55439/wishlist_test \
  .venv/bin/pytest -q tests/test_api.py
```

Run browser tests against a separately running disposable instance with the usual
frontend and API proxy routes:

```sh
WISHLIST_TEST_URL=http://localhost:8080 .venv/bin/pytest -q tests/test_browser.py
```

The API suite covers editing without changing identity or completion, duplicate
rollback, ownership boundaries, input validation, image size limits, and deletion.
The browser suite covers editing and failed-save recovery, completion persistence,
repeated video transitions, mobile layout, keyboard image previews, continuous
music across navigation/history, and person deletion dialogs. API tests also check
that deletion cannot remove a person whose wishlist contains a concurrently added item.

After testing, remove the temporary database:

```sh
docker stop wishlist-test-db
```
