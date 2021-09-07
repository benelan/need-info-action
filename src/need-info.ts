/* eslint-disable i18n-text/no-en */
import * as core from '@actions/core'
import * as github from '@actions/github'
import Config from './config'
import {GitHub} from '@actions/github/lib/utils'

interface Issue {
  number: number
  owner: string
  repo: string
}

export default class NeedInfo {
  config: Config
  octokit: InstanceType<typeof GitHub>

  constructor(config: Config, token: string) {
    this.config = config
    this.octokit = github.getOctokit(token)
  }

  /** For issue or pull Request webhooks */
  onIssueOrPR(): void {
    core.debug('Starting issue or pr event workflow')
    const {payload} = github.context
    if (payload.action === 'opened') {
      core.debug('TODO: initial content check')
    } else if (payload.action === 'edited' || payload.action === 'labeled') {
      core.debug('TODO: content check if post has a label to check')
    } else {
      core.debug(
        `Unsupported issue or pull request action: ${payload.action}, ending run`
      )
    }
  }

  /** For issue comment webhooks */
  async onComment(): Promise<void> {
    core.debug('Starting comment event workflow')
    const {payload, issue} = github.context
    /**
     * don't run if there is no comment,
     * a comment is being deleted,
     * or if the issue doesn't have the label
     */
    if (
      payload.comment &&
      (payload.action === 'created' || payload.action === 'edited') &&
      this.hasLabelToAdd(issue)
    ) {
      core.debug('Getting comment')
      const comment = await this.octokit.rest.issues.getComment({
        ...issue,
        comment_id: payload.comment.id
      })
      if (comment.data.body) {
        core.debug('Checking comment for required items')
        const response = this.getResponse(comment.data.body)
        if (response.length) {
          core.debug('Comment contains required items, removing label')
          this.octokit.rest.issues.removeLabel({
            ...issue,
            issue_number: issue.number,
            name: this.config.labelToAdd
          })
        } else {
          core.debug('Comment does not contain required items, ending run')
        }
      } else {
        core.debug(`Comment is empty, ending run`)
      }
    } else {
      core.debug(
        `The event was not a comment, didn't have the required label, or the action "${payload.action}" is not supported, ending run`
      )
    }
  }

  /** If the label doesn't exist then create it */
  async ensureLabelExists(label: string): Promise<void> {
    try {
      await this.octokit.rest.issues.getLabel({
        name: label,
        ...github.context.repo
      })
    } catch (e) {
      this.octokit.rest.issues.createLabel({
        name: label,
        color: 'yellow',
        ...github.context.repo
      })
    }
  }

  /** Checks if an issue has the labelToAdd */
  async hasLabelToAdd(issue: Issue): Promise<boolean> {
    const labels = await this.octokit.rest.issues.listLabelsOnIssue({
      ...issue,
      issue_number: issue.number
    })
    return labels.data.map(label => label.name).includes(this.config.labelToAdd)
  }

  /**
   * Checks the required items to make sure everything is there
   * Returns the responses for all of the missing items
   */
  getResponse(post: string): string[] {
    const inPost = (text: string): boolean =>
      post.toLowerCase().includes(text.toLowerCase())

    return this.config.requiredItems
      .filter(
        item =>
          (item.requireAll && !item.content.every(c => inPost(c))) ||
          (!item.requireAll && !item.content.some(c => inPost(c)))
      )
      .map(item => item.commentBody)
  }

  async createComment(
    header: string,
    body: string,
    footer: string,
    issue_number: number
  ): Promise<void> {
    await this.octokit.rest.issues.createComment({
      ...github.context.issue,
      issue_number,
      body: `${header}\n${body}\n${footer}`
    })
  }
}
