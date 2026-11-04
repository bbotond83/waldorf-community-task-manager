// The CSS check for the one hand-written stylesheet (app/globals.css). Prettier formats the file; this check catches
// mistakes such as unknown properties, duplicate properties in one rule, invalid values and bad colours. It starts
// from the standard rule set. The rules switched off below would force rewrites of the existing stylesheet that this
// change does not make; each reason is given so a later change can turn one back on.
const config = {
  extends: ["stylelint-config-standard"],
  rules: {
    // Blank-line style belongs to Prettier, which already formats this file.
    "comment-empty-line-before": null,
    "custom-property-empty-line-before": null,
    "declaration-empty-line-before": null,
    "rule-empty-line-before": null,
    // The stylesheet uses (min-width: ...) media queries; the range form (width >= ...) would rewrite every one.
    "media-feature-range-notation": null,
    // The order of the rules is the cascade the pages rely on (shared hover and pressed states come first on purpose).
    "no-descending-specificity": null,
    // Two selectors (.centered-panel, .parent-card) are split on purpose between a shared and a later rule.
    "no-duplicate-selectors": null,
    // The visually hidden helper uses clip alongside clip-path for older browsers.
    "property-no-deprecated": null,
  },
};

export default config;
