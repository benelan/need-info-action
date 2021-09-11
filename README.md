# Need More Info

 A GitHub Action that requests more info when required content is not included in an issue.

 ## Configuration
The default path to the configuration file is `.github/need-info.yml`. The path can be changed when setting up the workflow.


### Example Workflow File
```yaml
# .github/workflows/verify-info.yml
name: 'Issue Info'
on:
  issues:
    types: [opened, edited, labeled]
    branches: [master]
  issue_comment:
    types: [created, edited]
    branches: [master]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: benelan/need-info-action@v1.0.0
        with:
          github_token: "${{ secrets.GITHUB_TOKEN }}"
          config_path: '.github/configs/not-default.yml' # not required if using the default path
```
The following properties can be set in the configuration file.

| Config Property                 | Type           | Description                                                                                     |
|--------------------------|----------------|-------------------------------------------------------------------------------------------------|
| labelToAdd _(required)_    | string         | The label that will be added to issues with missing information                                 |
| labelsToCheck _(required)_ | string[]       | If one of the labels in this list is present then the issue will be checked for required items  |
| requiredItems _(required)_ | RequiredItem[] | A list of required items that an issue with a labelToCheck must include                         |
| commentHeader            | string         | Text to display in a comment above the required item responses when content is missing          |
| commentFooter            | string         | Text to display in a comment below the required item responses when content is missing          |



| RequiredItem Property   | Type     | Description                                               |
|------------|----------|-----------------------------------------------------------|
| content _(required)_    | string[] | A list of required content in an issue or comment         |
| response _(required)_   | string   | The comment response to provide if the content is missing |
| requireAll _(required)_ | boolean  | Require all the content items or just one                 |


### Example Config File
 ```yaml
 # .github/need-info.yml
labelToAdd: 'need more info'
labelsToCheck:
  - bug
  - enhancement
commentHeader: 'More information is required to proceed:'
requiredItems:
  -
    response: '- Use the appropriate format from the issue templates'
    requireAll: true
    content:
      - '## Actual Behavior'
      - '## Expected Behavior'
  -
    response: '- A sample that reproduces the issue'
    requireAll: false
    content:
      - jsbin.com
      - codepen.io
      - jsfiddle.net
      - codesandbox.io
commentFooter: 'This issue will be automatically closed in a week if the information is not provided. Thanks for your understanding.'
 ```

## How It Works
The appropriate workflow is determined depending on if an issue or comment event triggered the Action.

### Issue Event Webhook
The issue event can be run on `opened`, `edited` and/or `labeled` actions. 
- The Action checks if an issue has at least one of the `labelsToCheck`. If it does, it checks the issue body for the `requiredItems`.
  - If the issue satisfies all of the requirements then the Action ends.
  - If any requirement is not satisfied then `labelToAdd` is added to the issue. The Action comments on the issue with the `response` for all of the `requiredItems` that were not provided.
- If the issue does not have any `labelsToCheck` then the Action ends.

### Comment Event Webhook
The comment event can be run on `created` and/or `edited` actions.
- If there is a comment on an issue with the `labelToAdd`, then the Action checks the comment for any `requiredItems`.
  - If the comment satisfies any ONE required item then the `labelToAdd` is removed from the issue.
  - If the comment does not have any `requiredItems` then the Action ends.
- If the commented issue does not have the  `labelToAdd`, or the commenter is not the original poster, then the Action ends.

> **Note:** If there were multiple `requiredItems` that the commenter needed and they only provided one, the maintainer can manually ask for the additional items and add back the `labelToAdd`.


## Closing Issues
This Action can be used in conjunction with the [Close Stale Issues](https://github.com/marketplace/actions/close-stale-issues) Action which can be set up to delete issues with the `labelToAdd` after a certain amount of time.

### Example
```yml
# .github/workflows/close-issue.yml
name: "Need Info"
on:
  schedule:
    - cron: "30 1 * * *"
jobs:
  close:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/stale@v3
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          days-before-stale: -1
          days-before-close: 7
          remove-stale-when-updated: false
          stale-issue-label: "need more info"
          stale-pr-label: "need more info"
          close-issue-message: "This issue has been automatically closed due to missing information. We will reopen the issue if the information is provided."
```