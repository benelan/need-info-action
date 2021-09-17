[![Need Info](https://github.com/benelan/need-info-action/actions/workflows/verify-issue.yml/badge.svg)](https://github.com/benelan/need-info-action/actions/workflows/verify-issue.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# Need More Info

A GitHub Action that requests more info when required content is not included in an issue. You can check out test runs [here](https://github.com/benelan/need-info-action/issues).

- [Need More Info](#need-more-info)
  - [Configuration](#configuration)
    - [Example Workflow File](#example-workflow-file)
    - [Config Properties](#config-properties)
    - [Example Config File](#example-config-file)
  - [How It Works](#how-it-works)
    - [Issue Event Webhook](#issue-event-webhook)
    - [Comment Event Webhook](#comment-event-webhook)
  - [Closing Issues](#closing-issues)
    - [Example Workflow File](#example-workflow-file-1)

## Configuration

The Action has two properties that have defaults and are not required.

- **config-path**: Path to the config file, defaults to `.github/need-info.yml`
- **repo-token**: Token for the repository, defaults to `${{ github.token }}`

### Example Workflow File

```yaml
# .github/workflows/verify-info.yml
name: 'Issue Info'
on:
  issues:
    types: [labeled]
    branches: [master]
  issue_comment:
    types: [created]
    branches: [master]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: benelan/need-info-action@v1.2.0
        # the rest is not required if using the defaults
        with:
          github-token: 'super-duper-secret-token-sshhh'
          config-path: '.github/configs/not-default.yml'
```

### Config Properties

The following properties can be set in the configuration file.

| Config Property            | Type       | Description                                                                                   |
| -------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| requiredItems _(required)_ | InfoItem[] | Items that an issue with a labelToCheck must include, triggers a response if they are missing |
| labelsToCheck _(required)_ | string[]   | Labels that trigger a check for InfoItem content                                              |
| labelToAdd _(required)_    | string     | Label added to issues with missing information                                                |
| commentHeader              | string     | Comment message to add above the ItemInfo responses                                           |
| commentFooter              | string     | Comment message to add below the ItemInfo responses                                           |
| caseSensitive              | boolean    | Whether InfoItem content is case sensitive, default: false                                    |
| excludeComments            | boolean    | Exclude content in markdown comments when parsing for InfoItem content, default: false        |
| exemptUsers                | string[]   | Users that are exempt from providing InfoItem content                                         |
| includedItems              | InfoItem[] | Items that trigger a response if they are included and the action found missing requiredItems |

| InfoItem Property       | Type     | Description                                                         |
| ----------------------- | -------- | ------------------------------------------------------------------- |
| content _(required)_    | string[] | A list of content to check for in an issue or comment               |
| response _(required)_   | string   | A response to comment on an issue if requirements are not satisfied |
| requireAll _(required)_ | boolean  | Whether to require all of the content items or just one             |

### Example Config File

```yaml
# .github/need-info.yml
labelToAdd: 'need more info'
labelsToCheck:
  - 'bug'
  - 'enhancement'
requiredItems:
  - content:
      - '## Actual Behavior'
      - '## Expected Behavior'
    response: '- Use the appropriate format from the issue templates'
    requireAll: true
  - content:
      - 'jsbin.com'
      - 'codepen.io'
      - 'jsfiddle.net'
      - 'codesandbox.io'
    response: '- A sample that reproduces the issue'
    requireAll: false
# optional properties below
commentHeader: 'More information is required to proceed:'
commentFooter: 'This issue will be automatically closed in a week if the information is not provided. Thanks for your understanding.'
caseSensitive: true
excludeComments: true # don't parse markdown comments in the issue/comment
exemptUsers:
  - maintainer-username1
  - maintainer-username2
includedItems:
  - content:
      - 'https://esri.github.io/calcite-components/?path=/story/components-'
      - 'https://developers.arcgis.com/calcite-design-system/components/'
    response: '<br>@benelan will confirm that the issue is reproducible in the documentation. In the meantime, no action is required on your end.'
    requireAll: false
```

## How It Works

The appropriate method is determined depending on whether the Action is triggered by an issue or comment event.

### Issue Event Webhook

The `issues` event methods can be run on `opened`, `edited`, and/or `labeled`.

- The Action checks if an issue has at least one of the `labelsToCheck`, or in the case of a `labeled` action, checks if the added label is a label to check. If so, it checks the issue body for the `requiredItems`.
  - If the issue satisfies all of the requirements then the Action ends.
  - If any requirement is not satisfied then `labelToAdd` is added to the issue. The Action comments on the issue with the `response` for all of the `requiredItems` that were not provided. The Action also comments with the response for the `includedItems` that are in the issue. The `includedItems` can be used to explain why certain content cannot be accepted in place of requiredItems, among other things.
- If the issue does not have any `labelsToCheck` then the Action ends.

### Comment Event Webhook

The `issue_comment` event method can be run on `created` and/or `edited` actions.

- If there is a comment on an issue with the `labelToAdd` then the Action checks the comment for any `requiredItems`.
  - If the comment satisfies any ONE required item then the `labelToAdd` is removed from the issue.
  - If the comment does not have any `requiredItems` then the Action ends.
- If the commented issue does not have the `labelToAdd`, or the commenter is not the original poster, then the Action ends.

> **Note:** If there were multiple `requiredItems` that the commenter needed and they only provided one, the maintainer can manually ask for the additional items and add back the `labelToAdd`.

## Closing Issues

This Action can be used in conjunction with [Close Stale Issues](https://github.com/marketplace/actions/close-stale-issues), which can be [set up](https://github.com/benelan/need-info-action/tree/main/.github/workflows/close-issue.yml) to close issues with the `labelToAdd` after a certain amount of time. You can check out a test run [here](https://github.com/benelan/need-info-action/issues/28).

### Example Workflow File

```yaml
# .github/workflows/close-issue.yml
name: 'Need Info'
on:
  schedule:
    - cron: '30 1 * * *'
jobs:
  close:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/stale@v3
        with:
          days-before-stale: -1 # do not automatically label issues
          days-before-close: 7
          remove-stale-when-updated: false # do not automatically remove label
          stale-issue-label: 'need more info'
          stale-pr-label: 'need more info'
          close-issue-message: 'This issue has been automatically closed due to missing information. We will reopen the issue if the information is provided.'
```
