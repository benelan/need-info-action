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

  async check(): Promise<void> {
    const {eventName, payload} = github.context

    if (
      eventName === 'issues' &&
      (payload.action === 'opened' || payload.action === 'edited')
    ) {
      await this.onIssueOpen()
    } else if (
      eventName === 'issues' &&
      (payload.action === 'labeled' || payload.action === 'edited')
    ) {
      await this.onIssueLabel()
    } else if (
      eventName === 'issue_comment' &&
      (payload.action === 'created' || payload.action === 'edited')
    ) {
      await this.onIssueComment()
    } else {
      throw new Error(
        `Unsupported event "${eventName}" and/or action "${payload.action}", ending run`
      )
    }
  }

  /** For issue open webhooks */
  private async onIssueOpen(): Promise<void> {
    const {issue} = github.context
    console.log('Starting issue open event workflow')
    const labeled = await this.hasLabelToCheck(issue)
    if (labeled) {
      const issueInfo = await this.octokit.rest.issues.get({
        ...issue,
        issue_number: issue.number
      })
      const issueBody = issueInfo.data.body
      if (issueBody) {
        const responses = this.getResponses(issueBody)
        if (responses.length > 0) {
          await this.ensureLabelExists(this.config.labelToAdd)
          await this.createComment(issue, responses)
          await this.addLabel(issue, this.config.labelToAdd)
        }
      } else {
        console.log('The issue body is empty, ending run')
      }
    } else {
      console.log('The issue does not have a label to check, ending run')
    }
  }

  /** For issue label webhooks */
  private async onIssueLabel(): Promise<void> {
    console.log('Starting issue label event workflow')
  }

  /** For issue comment webhooks */
  private async onIssueComment(): Promise<void> {
    console.log('Starting comment event workflow')
    const {payload, issue} = github.context

    // don't run if there is no comment or if the issue doesn't have the label
    if (payload.comment && this.hasLabelToAdd(issue)) {
      console.log('Getting comment')
      const comment = await this.octokit.rest.issues.getComment({
        ...issue,
        comment_id: payload.comment.id
      })
      if (comment.data.body) {
        console.log('Checking comment for required items')
        const responses = this.getResponses(comment.data.body)
        if (responses.length) {
          console.log('Comment contains required items, removing label')
          this.octokit.rest.issues.removeLabel({
            ...issue,
            issue_number: issue.number,
            name: this.config.labelToAdd
          })
        } else {
          console.log('Comment does not contain required items, ending run')
        }
      } else {
        console.log(`Comment is empty, ending run`)
      }
    } else {
      console.log(`The comment doesn't have the required label, ending run`)
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

  /** Checks if an issue has at least one labelToCheck */
  async hasLabelToCheck(issue: Issue): Promise<boolean> {
    const labels = await this.octokit.rest.issues.listLabelsOnIssue({
      ...issue,
      issue_number: issue.number
    })
    return this.config.labelsToCheck.some(l =>
      labels.data.map(label => label.name).includes(l)
    )
  }

  /**
   * Checks the required items to make sure everything is there
   * Returns the responses for all of the missing items
   */
  getResponses(post: string): string[] {
    const inPost = (text: string): boolean =>
      post.toLowerCase().includes(text.toLowerCase())

    return this.config.requiredItems
      .filter(
        item =>
          (item.requireAll && !item.content.every(c => inPost(c))) ||
          (!item.requireAll && !item.content.some(c => inPost(c)))
      )
      .map(item => item.response)
  }

  async createComment(issue: Issue, responses: string[]): Promise<void> {
    const comment = `${this.config.commentHeader}\n${responses.join('\n')}\n${
      this.config.commentFooter
    }`
    await this.octokit.rest.issues.createComment({
      ...issue,
      issue_number: issue.number,
      body: comment
    })
  }

  async addLabel(issue: Issue, label: string): Promise<void> {
    this.octokit.rest.issues.addLabels({
      ...issue,
      issue_number: issue.number,
      labels: [label]
    })
  }
}
