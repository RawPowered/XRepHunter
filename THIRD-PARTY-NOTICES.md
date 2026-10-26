# Third-party notices

XRepHunter is an independent project. The following notices identify direct software or source adaptations visible in this repository. Transitive package terms are distributed with their respective packages and should be reviewed from the installed package metadata before redistribution.

## Adapted detector code

`src/lib/detectors/ai-slop.ts` includes code adapted from Distil Labs AI Slop Detector, available at <https://github.com/distil-labs/distil-ai-slop-detector>. The upstream project identifies this code under the Apache License 2.0. Its notice is retained in the source file. See the upstream repository for the complete license text and attribution requirements.

## Runtime dependencies

- `@huggingface/transformers` and its ONNX Runtime dependencies: see package metadata and licenses in npm distributions.
- `@wllama/wllama`: see the package license and notices in its npm distribution.
- `sql.js`: see its package license and notices in its npm distribution.
- WXT, TypeScript, Vitest, and their transitive dependencies: see package metadata and licenses in npm distributions.

The dependency lockfile records exact package versions used by npm. This summary does not replace the license files distributed with those packages.

## Models

Model weights are fetched separately from providers named in the source and are not included in the repository. Model weights have their own authorship and license terms. Check each model card and provider terms before use.

## Project code

No general reuse license is granted for original XRepHunter code or artwork in this repository. Third-party material retains its own terms.
