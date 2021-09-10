import * as github from '@actions/github'
import Config from './config'
import {GitHub} from '@actions/github/lib/utils'

export default class NeedInfo {
  config: Config
  octokit: InstanceType<typeof GitHub>

  constructor(config: Config, octokit: InstanceType<typeof GitHub>) {
    this.config = config
    this.octokit = octokit
  }

  /** Checks the github event and action runs the appropriate workflow */
  async verify(): Promise<void> {
    const {eventName, payload} = github.context

    if (
      eventName === 'issues' &&
      (payload.action === 'edited' || payload.action === 'labeled')
    ) {
      await this.onIssueEvent()
    } else if (
      eventName === 'issue_comment' &&
      (payload.action === 'created' || payload.action === 'edited')
    ) {
      await this.onCommentEvent()
    } else {
      throw new Error(
        `Unsupported event "${eventName}" and/or action "${payload.action}", ending run`
      )
    }
  }

  /** For issue webhooks */
  private async onIssueEvent(): Promise<void> {
    console.log('Starting issue event workflow')
    const {repo, owner, number} = github.context.issue

    const labeled = await this.hasLabelToCheck()
    if (labeled) {
      const issueInfo = await this.octokit.rest.issues.get({
        owner,
        repo,
        issue_number: number
      })

      const {body} = issueInfo.data
      if (body) {
        const responses = this.getResponses(body)
        console.log(`responses: ${responses.join(', ')}`)

        if (responses.length > 0) {
          console.log(
            'Comment does not have required items, adding comment and label'
          )
          await this.ensureLabelExists(this.config.labelToAdd)
          await this.createComment(responses)
          await this.addLabel(this.config.labelToAdd)
        }
      } else {
        console.log('The issue body is empty, ending run')
      }
    } else {
      console.log('The issue does not have a label to check, ending run')
    }
  }

  /** For issue comment webhooks */
  private async onCommentEvent(): Promise<void> {
    console.log('Starting comment event workflow')
    const {payload, issue} = github.context

    // run if there is a comment and the issue has the label
    if (payload.comment && this.hasLabelToAdd()) {
      console.log('Getting comment and issue')
      const commentInfo = await this.octokit.rest.issues.getComment({
        ...issue,
        comment_id: payload.comment.id
      })
      const issueInfo = await this.octokit.rest.issues.get({
        ...issue,
        issue_number: issue.number
      })

      const {body, user} = commentInfo.data
      const issueUser = issueInfo.data.user
      // make sure the commenter is the original poster
      if (body && user && issueUser && issueUser.login === user.login) {
        console.log('Checking comment for required items')
        const responses = this.getResponses(body)
        console.log(`responses: ${responses.join(', ')}`)

        if (responses.length < this.config.requiredItems.length) {
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
        console.log(
          `The commenter is not the original poster or the comment is empty, ending run`
        )
      }
    } else {
      console.log(`The comment does not have the required label, ending run`)
    }
  }

  /** If the label doesn't exist then create it */
  async ensureLabelExists(name: string): Promise<void> {
    const {repo, owner} = github.context.repo
    try {
      console.log('checking if labelToAdd exists')
      await this.octokit.rest.issues.getLabel({
        name,
        owner,
        repo
      })
    } catch (e) {
      console.log('creating labelToAdd')
      this.octokit.rest.issues.createLabel({
        name,
        owner,
        repo
      })
    }
  }

  /** Checks if an issue has the labelToAdd */
  async hasLabelToAdd(): Promise<boolean> {
    console.log('Checking if the issue has the labelToAdd')
    const {repo, owner, number} = github.context.issue
    const labels = await this.octokit.rest.issues.listLabelsOnIssue({
      owner,
      repo,
      issue_number: number
    })
    return labels.data.map(label => label.name).includes(this.config.labelToAdd)
  }

  /** Checks if an issue has at least one labelToCheck */
  async hasLabelToCheck(): Promise<boolean> {
    console.log('Checking if the issue has a labelToCheck')
    const {repo, owner, number} = github.context.issue
    const labels = await this.octokit.rest.issues.listLabelsOnIssue({
      owner,
      repo,
      issue_number: number
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
    console.log('Parsing for required items')
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

  async createComment(responses: string[]): Promise<void> {
    console.log('Creating comment')
    const {repo, owner, number} = github.context.issue
    const comment = `${this.config.commentHeader}\n\n${responses.join(
      '\n'
    )}\n\n${this.config.commentFooter}`
    await this.octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: number,
      body: comment
    })
  }

  async addLabel(label: string): Promise<void> {
    console.log('Adding label')
    const {repo, owner, number} = github.context.issue
    this.octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: number,
      labels: [label]
    })
  }
}
