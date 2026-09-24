"""Run against a disposable running app with WISHLIST_TEST_URL set."""
import os
from uuid import uuid4

import pytest
from playwright.sync_api import sync_playwright, expect

BASE = os.getenv("WISHLIST_TEST_URL")
pytestmark = pytest.mark.skipif(not BASE, reason="Set WISHLIST_TEST_URL to a disposable running app")


@pytest.fixture
def page():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        yield page
        browser.close()
        assert not errors


def test_edit_complete_delete_and_failed_save(page):
    name = "Browser-" + uuid4().hex[:8]
    page.goto(BASE)
    page.get_by_label("Name der Person").fill(name)
    page.get_by_role("button", name="Hinzufügen").click()
    page.get_by_role("heading", name=name, exact=True).wait_for()
    page.goto(f"{BASE}/edit/{name}")
    page.get_by_label("Wunsch", exact=True).fill("Book")
    page.get_by_role("button", name="Hinzufügen").click()
    page.get_by_role("button", name="Book bearbeiten").click()
    page.get_by_label("Wunsch", exact=True).fill("New book")
    page.get_by_label("Link (optional)").fill("https://example.com/book")
    page.get_by_role("button", name="Speichern", exact=True).click()
    expect(page.get_by_role("link", name="New book", exact=True)).to_have_attribute("href", "https://example.com/book")
    page.get_by_role("button", name="New book bearbeiten").click()
    page.get_by_label("Wunsch", exact=True).fill("Rejected")
    page.route("**/api/people/*/items/*", lambda route: route.fulfill(status=500, json={"detail": "Testfehler"}))
    page.get_by_role("button", name="Speichern", exact=True).click()
    expect(page.get_by_role("alert")).to_have_text("Testfehler")
    expect(page.get_by_label("Wunsch", exact=True)).to_have_value("Rejected")
    page.unroute("**/api/people/*/items/*")
    page.get_by_role("button", name="Abbrechen").click()
    page.goto(f"{BASE}/{name}")
    page.emulate_media(reduced_motion="reduce")
    checkbox = page.get_by_role("checkbox", name="New book erledigt")
    checkbox.check()
    expect(checkbox).to_be_enabled()
    expect(checkbox).to_be_checked()
    page.reload()
    expect(page.get_by_role("checkbox", name="New book erledigt")).to_be_checked()
    page.goto(f"{BASE}/edit/{name}")
    page.get_by_role("button", name="New book bearbeiten").click()
    page.get_by_label("Wunsch", exact=True).fill("Final book")
    page.get_by_role("button", name="Speichern", exact=True).click()
    page.get_by_role("button", name="Final book löschen").wait_for()
    data = page.request.get(f"{BASE}/api/people").json()[name]["items"]
    assert len(data) == 1 and data[0]["completed"] is True
    page.on("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Final book löschen").click()
    expect(page.get_by_text("Noch keine Wünsche vorhanden.")).to_be_visible()


def test_video_crossfades_repeatedly_and_pauses(page):
    page.goto(BASE)
    page.wait_for_function("document.querySelector('#background-video').currentTime > 0")
    for _ in range(3):
        page.evaluate("""() => {
          const video = [...document.querySelectorAll('video')].find(v => !v.paused);
          video.currentTime = video.duration - 1.2;
        }""")
        page.wait_for_function("""[...document.querySelectorAll('video')].some(v =>
          !v.paused && Number(v.style.opacity) > 0 && Number(v.style.opacity) < 1)""")
        page.wait_for_function("""[...document.querySelectorAll('video')].filter(v => !v.paused).length === 1 &&
          [...document.querySelectorAll('video')].some(v => !v.paused && v.currentTime < 3 && v.style.opacity === '1')""")
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_function("[...document.querySelectorAll('video')].every(v => v.paused)")
    page.emulate_media(reduced_motion="no-preference")
    page.wait_for_function("[...document.querySelectorAll('video')].some(v => !v.paused)")


def test_mobile_reduced_motion_and_image_keyboard_preview(page):
    page.set_viewport_size({"width": 390, "height": 844})
    page.emulate_media(reduced_motion="reduce")
    name = "Mobile-" + uuid4().hex[:8]
    page.request.post(f"{BASE}/api/people", form={"name": name, "color": "#123456"})
    page.request.post(f"{BASE}/api/people/{name}/items", form={"item_name": "Picture", "item_image": f"{BASE}/assets/frame.jpg"})
    page.goto(f"{BASE}/{name}")
    preview = page.get_by_role("button", name="Picture: Bild vergrößern")
    preview.focus()
    preview.press("Enter")
    expect(page.get_by_role("dialog")).to_be_visible()
    page.keyboard.press("Escape")
    expect(page.get_by_role("dialog")).not_to_be_visible()
    expect(preview).to_be_focused()
    page.wait_for_function("[...document.querySelectorAll('video')].every(v => v.paused)")
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")


def test_music_survives_navigation_and_history(page):
    name = "Music-" + uuid4().hex[:8]
    page.request.post(f"{BASE}/api/people", form={"name": name, "color": "#123456"})
    page.goto(BASE)
    expect(page.locator("#motion-toggle")).to_have_count(0)
    expect(page.get_by_role("button", name="Musik ausschalten")).to_have_attribute("aria-pressed", "true")
    page.get_by_role("heading", name="🎁 Fliegende Wunschliste").click()
    page.wait_for_function("!document.querySelector('audio').paused && document.querySelector('audio').currentTime > 0")
    page.evaluate("window.originalAudio = document.querySelector('audio'); window.audioPauses = 0; originalAudio.addEventListener('pause', () => audioPauses++)")
    before = page.evaluate("originalAudio.currentTime")
    card = page.locator(".person-card").filter(has=page.get_by_role("heading", name=name, exact=True))
    card.get_by_role("link", name="Wunschliste bearbeiten").click()
    expect(page.get_by_role("heading", name=f"Wunschliste von {name} bearbeiten")).to_be_visible()
    page.get_by_role("link", name="Wunschliste anzeigen").click()
    expect(page.get_by_role("heading", name=f"Wunschliste von {name}", exact=True)).to_be_visible()
    page.go_back()
    expect(page.get_by_role("heading", name=f"Wunschliste von {name} bearbeiten")).to_be_visible()
    page.go_forward()
    expect(page.get_by_role("heading", name=f"Wunschliste von {name}", exact=True)).to_be_visible()
    assert page.evaluate("originalAudio === document.querySelector('audio') && !originalAudio.paused && audioPauses === 0")
    assert page.evaluate("originalAudio.currentTime") > before
    assert len(page.context.pages) == 1
    expect(page.locator('a[target="_blank"]')).to_have_count(0)
    page.get_by_role("button", name="Musik ausschalten").click()
    assert page.evaluate("originalAudio.paused")
    page.get_by_role("link", name="← Zurück zur Übersicht").click()
    expect(page.get_by_role("heading", name="🎁 Fliegende Wunschliste")).to_be_visible()
    assert page.evaluate("document.querySelector('audio').paused")
    expect(page.get_by_role("button", name="Musik einschalten")).to_be_visible()


def test_delete_person_dialog_guards_and_confirmation(page):
    name = "Delete-" + uuid4().hex[:8]
    page.request.post(f"{BASE}/api/people", form={"name": name, "color": "#123456"})
    page.request.post(f"{BASE}/api/people/{name}/items", form={"item_name": "Keep me"})
    page.goto(f"{BASE}/edit/{name}")
    page.get_by_role("button", name="Person verwalten").click()
    expect(page.get_by_text("Diese Person hat noch Wünsche.", exact=False)).to_be_visible()
    expect(page.get_by_role("button", name="Person löschen", exact=True)).to_be_disabled()
    page.get_by_role("button", name="Abbrechen", exact=True).click()
    data = page.request.get(f"{BASE}/api/people").json()[name]["items"]
    page.request.delete(f"{BASE}/api/people/{name}/items/{data[0]['id']}")
    page.get_by_role("button", name="Person verwalten").click()
    expect(page.get_by_role("button", name="Person löschen", exact=True)).to_be_enabled()
    page.once("dialog", lambda dialog: dialog.dismiss())
    page.get_by_role("button", name="Person löschen", exact=True).click()
    assert name in page.request.get(f"{BASE}/api/people").json()
    # An item added after the dialog opens must still block deletion at the API.
    page.request.post(f"{BASE}/api/people/{name}/items", form={"item_name": "Late wish"})
    page.once("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Person löschen", exact=True).click()
    expect(page.get_by_text("Bitte zuerst alle Wünsche dieser Person entfernen.", exact=True)).to_be_visible()
    data = page.request.get(f"{BASE}/api/people").json()[name]["items"]
    page.request.delete(f"{BASE}/api/people/{name}/items/{data[0]['id']}")
    page.once("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Person löschen", exact=True).click()
    expect(page.get_by_role("heading", name="🎁 Fliegende Wunschliste")).to_be_visible()
    assert name not in page.request.get(f"{BASE}/api/people").json()


def test_mobile_items_are_compact(page):
    page.set_viewport_size({"width": 390, "height": 844})
    name = "Compact-" + uuid4().hex[:8]
    page.request.post(f"{BASE}/api/people", form={"name": name, "color": "#123456"})
    for i in range(4):
        page.request.post(f"{BASE}/api/people/{name}/items", form={"item_name": f"Present {i}", "item_image": f"{BASE}/assets/frame.jpg"})
    page.goto(f"{BASE}/{name}")
    expect(page.locator(".floating-item")).to_have_count(4)
    page.wait_for_function("[...document.querySelectorAll('.floating-item img')].every(img => img.complete && img.naturalWidth)")
    sizes = page.locator(".floating-item").evaluate_all("items => items.map(item => ({width: item.offsetWidth, height: item.offsetHeight}))")
    assert all(size["width"] <= 176 and size["height"] <= 200 for size in sizes)
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")

    page.goto(f"{BASE}/edit/{name}")
    expect(page.locator(".wishlist-item")).to_have_count(4)
    assert page.locator(".wishlist-item__text").first.evaluate("el => el.clientWidth") >= 100
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")


@pytest.mark.parametrize("viewport", [{"width": 1280, "height": 900}, {"width": 390, "height": 844}])
def test_floating_area_reaches_all_viewport_edges(page, viewport):
    page.set_viewport_size(viewport)
    page.clock.install(time=1_000_000)
    page.clock.pause_at(1_001_000)
    page.route("**/api/people", lambda route: route.fulfill(json={"Edges": {"color": "#123456", "items": [
        {"id": 1, "name": "Wish", "completed": False, "url": None, "image": None}
    ]}}))
    page.goto(f"{BASE}/Edges")
    expect(page.locator(".floating-item")).to_have_count(1)
    for size in [viewport, {"width": viewport["height"], "height": viewport["width"]}]:
        page.set_viewport_size(size)
        area = page.locator("#floating-wishlist").bounding_box()
        assert area == {"x": 0, "y": 0, **size}
        result = page.evaluate("""() => {
          const el = document.querySelector('.floating-item');
          el.style.transform = 'translate(100px, 100px)';
          const width = el.offsetWidth, height = el.offsetHeight;
          const edges = [
            {x: -1, y: 100, speedX: -100, speedY: 0},
            {x: innerWidth - width + 1, y: 100, speedX: 100, speedY: 0},
            {x: 100, y: -1, speedX: 0, speedY: -100},
            {x: 100, y: innerHeight - height + 1, speedX: 0, speedY: 100}
          ];
          return edges.map(state => {
            let bounces = 0;
            moveRandomly(el, {...state, lastUpdate: Date.now(), onBounce: () => bounces++});
            const rect = el.getBoundingClientRect();
            return {left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, bounces};
          });
        }""")
        assert result[0]["left"] == 0
        assert result[1]["right"] == size["width"]
        assert result[2]["top"] == 0
        assert result[3]["bottom"] == size["height"]
        assert all(edge["bounces"] == 1 for edge in result)


def test_overlapping_wishes_each_get_a_turn_and_focus_stays_in_front(page):
    page.clock.install(time=1_000_000)
    page.clock.pause_at(1_001_000)
    page.goto(BASE)
    # Stationary overlapping cards exercise the timer fallback even without bounces.
    page.evaluate("""() => {
      document.body.classList.add('public-wishlist');
      const container = document.createElement('div');
      container.id = 'floating-wishlist';
      for (let i = 0; i < 3; i++) {
        const item = document.createElement('div');
        item.className = 'floating-item';
        item.id = `layer-test-${i}`;
        item.style.transform = 'translate(200px, 250px)';
        item.innerHTML = `<label>Wish ${i}<input type="checkbox"></label>`;
        container.append(item);
      }
      document.body.append(container);
      window.testBounce = cycleFloatingLayers(container);
    }""")
    top_item = "document.elementFromPoint(220, 275).closest('.floating-item').id"
    seen = {page.evaluate(top_item)}
    for _ in range(2):
        page.clock.run_for(5100)
        seen.add(page.evaluate(top_item))
    assert len(seen) == 3
    before = page.evaluate(top_item)
    page.clock.run_for(3100)
    page.evaluate("testBounce()")
    assert page.evaluate(top_item) != before
    before = page.evaluate(top_item)
    page.evaluate("testBounce()")
    assert page.evaluate(top_item) == before  # No rapid reshuffling on repeated bounces.
    page.locator("#layer-test-0 input").focus()
    page.clock.run_for(6000)
    assert page.evaluate(top_item) == "layer-test-0"
    page.evaluate("document.activeElement.blur()")
    page.mouse.move(220, 275)
    hovered = page.evaluate(top_item)
    page.clock.run_for(6000)
    assert page.evaluate(top_item) == hovered
    # The floating stacking context cannot cover the music control.
    assert page.evaluate("document.elementFromPoint(30, 30).closest('button').id") == "music-toggle"
