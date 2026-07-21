# Suno Phase 3 judge simulation

Use the Phase 3 Vercel preview URL. This is a human walkthrough: never use production credentials or a real child recording.

## Entry and tour

- [ ] Open `/login` in a private window and choose **Explore the demo classroom**.
- [ ] Confirm the populated class board appears.
- [ ] Start **Take the tour** from the login screen or account menu.
- [ ] Check that Escape and Skip leave the interface usable, and that a missing target does not trap the tour.

## Teacher loop

- [ ] Add `Meera` with starting level **Word**; confirm the `Teacher placed` chip appears.
- [ ] Open Meera's reading check. Refresh once: the passage should not change.
- [ ] Use the bundled sample recording; confirm the result and inspect **What this read tells us** plus the Focus panel.
- [ ] Return to the class; archive and restore Meera.
- [ ] Run a second benchmark reading for one child and confirm the passage rotates.
- [ ] For a qualifying child, confirm the step-up banner says a below-threshold result cannot move the child down.

## Insight and trust

- [ ] Open a seeded child's journey from their name. Check trends, practice activity, diary, and parent report.
- [ ] Print the report preview: it should be one clean page without controls.
- [ ] Open every `ⓘ` sheet and follow one evidence link to `/why`.
- [ ] Visit `/why` signed out. Toggle a chart to its table and confirm the illustrative chart is labelled as such.

## Safety and close

- [ ] Confirm a real teacher account sees only its own empty classroom.
- [ ] Confirm **Sign out** returns to login and a protected deep link returns through login.
- [ ] Record any crash, raw error, blocked navigation, or unstyled state with the route and reproduction steps.

## Automated evidence

Before sign-off run:

```powershell
npm.cmd run check:all
npm.cmd run build
```

The human acceptance evidence is deliberately recorded separately from this repository; it cannot be fabricated by automated checks.
