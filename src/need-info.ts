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
      (payload.action === 'opened' ||
        payload.action === 'edited' ||
        payload.action === 'labeled')
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
    const {issue} = github.context
    console.log('Starting issue event workflow')
    const labeled = await this.hasLabelToCheck(issue)
    if (labeled) {
      const issueInfo = await this.octokit.rest.issues.get({
        ...issue,
        issue_number: issue.number
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

  /** For issue comment webhooks */
  private async onCommentEvent(): Promise<void> {
    console.log('Starting comment event workflow')
    const {payload, issue} = github.context

    // don't run if there is no comment or if the issue doesn't have the label
    if (payload.comment && this.hasLabelToAdd(issue)) {
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
      if (body && user && issueUser && issueUser.login === user.login) {
        console.log('Checking comment for required items')
        const responses = this.getResponses(body)
        console.log(`responses: ${responses.join(', ')}`)
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
  async hasLabelToAdd(issue: Issue): Promise<boolean> {
    console.log('Checking if the issue has the labelToAdd')
    const labels = await this.octokit.rest.issues.listLabelsOnIssue({
      ...issue,
      issue_number: issue.number
    })
    return labels.data.map(label => label.name).includes(this.config.labelToAdd)
  }

  /** Checks if an issue has at least one labelToCheck */
  async hasLabelToCheck(issue: Issue): Promise<boolean> {
    console.log('Checking if the issue has a labelToCheck')
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

  async createComment(issue: Issue, responses: string[]): Promise<void> {
    console.log('Creating comment')
    const comment = `${this.config.commentHeader}\n\n
    ${responses.join('\n')}\n\n
    ${this.config.commentFooter}`
    await this.octokit.rest.issues.createComment({
      ...issue,
      issue_number: issue.number,
      body: comment
    })
  }

  async addLabel(issue: Issue, label: string): Promise<void> {
    console.log('Adding label')
    this.octokit.rest.issues.addLabels({
      owner: issue.owner,
      repo: issue.repo,
      issue_number: issue.number,
      labels: [label]
    })
  }
}
