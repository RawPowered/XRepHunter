# Scoring and limits

XRepHunter is a review aid. Its numeric values compress several signals into a view that is easier to scan; they are not verified facts about a person, account, or post.

## Signal families

### Account reputation

The account score combines weighted detector evidence and observed post signals. It can include handle and account patterns, spam behavior, posting cues, user-maintained examples, repeated-content evidence, Community Notes observations, and available content-analysis signals. The score has configurable sensitivity, baseline, spam weighting, and ceiling. A lower reputation score can meet the configured block-suggestion threshold.

The score reflects the observations available to this browser profile. It does not describe an account’s complete history.

### Post and text signals

Text heuristics look for repeated promotional structure, phrase patterns, unusual sentence uniformity, and other configured cues. Optional model outputs can add classifier labels. Post-level S/T/Sp badges summarize content-quality, toxicity, and spam-related signals.

The source also uses labels such as `ai_generated` for a synthetic-content classifier. Those labels are model outputs that can be wrong. They do not establish who wrote or generated the post.

### Image signals

The optional image pipeline compares a public post image with configured categories such as promotional generated artwork, photography, and screenshots. Its result depends on the image available at the media URL and the loaded model. The image score is a cue for review, not provenance evidence.

### Toxicity and safety

The optional toxicity model and local heuristics look for labels such as insult, threat, and identity-targeted hate. Casual profanity, sarcasm, context, and reclaimed language can be misclassified. The model does not determine whether a post violates X policy or applicable law.

### Provenance and browsing signals

Separate modules look for visible promoted labels, sponsorship patterns, repeated text, topic interests, and interactions observed during browsing. These signals can be incomplete when X changes its page format or when a user’s browser has not observed the relevant posts.

## How to interpret values

- Treat each number as a ranked signal on the displayed scale, not a calibrated probability.
- Open the explanation or evidence view and review the source post, profile, and surrounding context.
- Use the trusted-account list to suppress block suggestions for accounts you trust. Their scores and evidence remain visible.
- Learning mode records observations without enabling block suggestions.
- Optional models can be disabled. Heuristics and cached data may still affect results when a model is off.
- Manual image marks and imported examples are user-provided input and can affect later scores.

## Block suggestions

Block suggestions are disabled in the default settings. The user must enable suggestions and accept the agreement. Each suggested account is shown for review, and the user confirms the action in the interface. The extension does not treat a score as authority to block an account automatically.

## Evaluation questions

When reviewing a result, ask:

1. Which concrete post or profile details contributed to the score?
2. Are the details representative, recent, and still visible?
3. Could satire, quotation, translation, an accessibility description, or a community-specific phrase explain the signal?
4. Is the result based on an optional model, a heuristic, user input, or a combination?
5. Is there enough evidence to justify the action being considered?

For the data boundaries and external requests, see [Privacy and security](PRIVACY-AND-SECURITY.md).
