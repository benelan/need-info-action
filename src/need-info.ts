/* eslint-disable i18n-text/no-en */
import * as core from '@actions/core'
import * as github from '@actions/github'
import Config from './config'
import {GitHub} from '@actions/github/lib/utils'

interface Issue {
  issue_number: number
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
    const {action} = github.context.payload
    if (action === 'opened') {
      core.debug('TODO: initial content check')
    } else if (action === 'edited' || action === 'labeled') {
      core.debug('TODO: content check if post has a label to check')
    } else {
      throw new Error(
        `Unsupported issue or pull request action: ${action}, ending run.`
      )
    }
  }

  /** For issue comment webhooks */
  async onComment(): Promise<void> {
    core.debug('Starting comment event workflow')
    const {payload, repo, issue} = github.context
    // don't run on the delete action or if there is no comment in the payload
    if (
      (payload.action === 'created' || payload.action === 'edited') &&
      payload.comment !== undefined
    ) {
      core.debug('Getting comment')
      // get the comment body
      const comment = await this.octokit.rest.issues.getComment({
        ...repo,
        comment_id: payload.comment.id
      })
      if (comment.data.body !== undefined) {
        core.debug('checking comment for required items')
        const response = this.getResponse(comment.data.body)
        if (response.length > 0) {
          this.octokit.rest.issues.removeLabel({
            ...github.context.repo,
            issue_number: issue.number,
            name: this.config.labelToAdd
          })
        }
      }
    } else {
      throw new Error(
        `The event was not a comment or the action "${payload.action}" is not supported, ending run.`
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
    const labels = await this.octokit.rest.issues.listLabelsOnIssue({...issue})
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
      ...github.context.repo,
      issue_number,
      body: `${header}\n${body}\n${footer}`
    })
  }
}
