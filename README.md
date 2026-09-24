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
  or focused. **Bewegung pausieren** switches to a stationary, wrapping list and
  pauses the background video. The app respects reduced-motion preferences.
- Music starts only through **Musik einschalten**. Image previews support keyboard
  navigation, Escape to close, and focus restoration.

## Structure

- `backend/database.py`: PostgreSQL connection and additive startup schema setup.
- `backend/routes.py`: API, input validation, and transactional updates.
- `backend/main.py`: application lifespan and router registration.
- `frontend/templates`: overview, editor, and public wishlist pages.
- `frontend/js/common.js`: requests, error reporting, previews, and media controls.
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
repeated video transitions, mobile layout, and keyboard image previews.

After testing, remove the temporary database:

```sh
docker stop wishlist-test-db
```
