# Accessibility

Target: WCAG 2.2 level AA. Two kinds of checks keep it there.

## Automated scans

`npm run test:a11y` (Playwright + axe-core) signs in with the one-click demo
accounts and scans every page in light and dark mode: 28 scans, as an agent and
as an admin, including the Log activity dialog, the Add member dialog and the
search menu with results open. A scan fails on any serious or critical
violation. It needs demo mode and the demo Supabase project.

Issues the first run found and fixed:

| Issue | Fix |
| --- | --- |
| Two nested `<main>` landmarks on every page (sidebar wrapper + page area) | The sidebar wrapper is a `<div>`; one `<main id="main-content">` |
| Search button's name ("Search leads and pages") did not contain its visible text, so voice control could not target it | The visible "Search…" is the name; the shortcut hint is hidden from screen readers |
| "Due today" labels in amber-600: 3.2:1 on white | amber-700 in light mode (dark keeps amber-400) |
| Red overdue count on the warmer sidebar: 4.26:1 | red-700 in light mode across status text |
| Five identical "Sign in" buttons on the demo list | Each is named "Sign in as <name>" |
| The search dialog's hidden title was in the page while closed | It renders only while the dialog is open |

## Manual keyboard pass (28 Oct 2026)

| Check | Result |
| --- | --- |
| "Skip to content" is the first Tab stop, visible on focus, and moves focus into the page | Pass |
| Visible focus ring on every control (brand orange, 3px) | Pass |
| Tab order follows the layout: sidebar, header (search, add lead, theme), page | Pass |
| Dialogs (Log activity, Change stage, Add member, Reset password, Deactivate, Targets) trap focus, close on Esc and return focus to their trigger | Pass (Radix Dialog) |
| Dropdown menus, selects and filter popovers open with Enter/Space and move with arrow keys | Pass (Radix) |
| Sortable column headers expose `aria-sort` and are buttons | Pass |
| Ctrl/Cmd+K opens search; arrows and Enter pick a result | Pass |
| Form errors: fields get `aria-invalid`, errors sit next to the field, form-level errors use `role="alert"` | Pass |

## Other rules the app follows

- Status is never shown by colour alone: stages and priorities have text labels,
  overdue items say "N days overdue", and icons carry `aria-label`s.
- Charts have a screen-reader table and use validated colours (see the dataviz
  checker); with "reduce motion" they draw without animating, and CSS
  animations and transitions are cut to near zero.
- The new-password strength hint is text ("Strength: fair"), not just a bar.

## Known gaps

- Charts' hover tooltips are mouse-only; the same numbers are in the
  screen-reader tables and the visible labels.
- Not yet tested with a physical screen reader (NVDA/VoiceOver) end to end.
