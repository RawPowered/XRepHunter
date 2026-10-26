# Screenshot evidence

The repository includes two captures of the XRepHunter extension running in a browser on October 25, 2026. They document visible product behavior and controls at the time of capture.

## Live feed review

[`live-feed-review.png`](../assets/screenshots/live-feed-review.png) shows the extension's reputation and post-signal badges rendered beside posts in a signed-in X feed. The “Why this score?” control is present on each scored post. The screenshot records an interface state; it does not reveal whether an optional model was loaded and does not validate score accuracy.

## Local rules dashboard

[`local-dashboard.png`](../assets/screenshots/local-dashboard.png) shows detector controls, weighting and threshold inputs, learning mode, and the opt-in setting for block suggestions. Suggestions were disabled in the captured settings.

## Historical scoring captures (May 2026)

These older captures preserve interface evidence from an earlier scoring build. The profile identity is redacted in the score panels. Feed captures are reduced to the score-chip strip; account names, handles, post copy, avatars, and media are excluded from the public files.

| Capture | Visible evidence | Interpretation |
| --- | --- | --- |
| [Score breakdown A](../assets/screenshots/archive/legacy-score-breakdown-may-23-a.png) | Score 38, 43 posts sampled, AI slop 72 with image signal 72 | One historical snapshot. The AI indicator was described in the panel as an indicator, not proof of authorship. |
| [Score breakdown B](../assets/screenshots/archive/legacy-score-breakdown-may-23-b.png) | Score 40, 35 posts sampled, heuristic slop 1 | A separate snapshot with different sample count and signals. It is not a controlled comparison with capture A. |
| [Feed score chip](../assets/screenshots/archive/legacy-feed-score-chip.png) | Score 47 and `Sp70` indicator | Historical badge display, captured May 26, 2026. |
| [Feed post score chip](../assets/screenshots/archive/legacy-feed-post-score-chip.png) | Post-level `S0 T0 Sp90` indicators | Historical badge display, captured May 27, 2026. |

The May captures document older UI and scoring states. They are not current model output, an accuracy benchmark, or validation against ground truth. Scores and classifier behavior can change with source revisions, settings, sample windows, model availability, and model versions.

## Privacy edits

- Browser tabs, address bar, and unrelated toolbar items were cropped out.
- Display names, account handles, and custom timeline names were covered.
- Profile images were pixelated.
- Raw captures containing the unredacted session are excluded from version control.

## Evidence limits

These images show the extension loaded in browser sessions and demonstrate parts of its interface. They do not establish that its reputation scores, classifiers, or model labels are accurate, complete, or suitable for decisions about people. The feed content and numerical signals reflect specific historical sessions only.
