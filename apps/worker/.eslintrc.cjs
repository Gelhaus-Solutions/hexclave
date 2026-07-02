module.exports = {
  "extends": [
    "../../configs/eslint/defaults.js",
  ],
  "ignorePatterns": ['/*', '!/src', '!/scripts'],
  "rules": {
    // The worker may only import backend code through the curated barrel — that seam is the
    // whole point of apps/backend/src/temporal/activities.ts. Anything else the worker needs
    // must be re-exported there (keeps the backend surface auditable).
    "no-restricted-imports": ["error", {
      "patterns": [
        {
          "group": ["@/*", "../backend/*", "**/apps/backend/*"],
          "message": "Import backend code only via @hexclave/backend/temporal-activities (the curated worker seam).",
        },
      ],
    }],
  },
};
