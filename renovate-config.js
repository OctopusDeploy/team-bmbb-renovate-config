module.exports = {
  extends: ['github>OctopusDeploy/team-bmbb-renovate-config:default.json5'],

  enabledManagers: ['github-actions', 'custom.regex'],

  customManagers: [
    {
      // The validator's Renovate version, which isn't in a file Renovate understands.
      customType: 'regex',
      managerFilePatterns: ['/^\\.github/workflows/validate-renovate-config\\.yml$/'],
      matchStrings: ['renovate@(?<currentValue>\\d+\\.\\d+\\.\\d+)'],
      depNameTemplate: 'renovate',
      datasourceTemplate: 'npm',
    },
  ],

  packageRules: [
    {
      // The validator must check config against the same Renovate version that runs it.
      matchPackageNames: ['renovate', 'ghcr.io/renovatebot/renovate'],
      groupName: 'Renovate',
    },
  ],
};
