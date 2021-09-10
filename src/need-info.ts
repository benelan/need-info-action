import * as github from '@actions/github'
import Config from './config'
import {GitHub} from '@actions/github/lib/utils'

interface PostInfo {
  body: string | null | undefined
  login: string | undefined
}

export default class NeedInfo {
  config: Config
  octokit: InstanceType<typeof GitHub>

  constructor(config: Config, octokit: InstanceType<typeof GitHub>) {
    this.config = config
    this.octokit = octokit
  }

  /** Checks the github event and action runs the appropriate workflow */
  async verify(): Promise<void> {
    const {
      eventName,
      payload: {action}
    } = github.context

    if (
      eventName === 'issues' &&
      (action === 'edited' || action === 'labeled')
    ) {
      await this.onIssueEvent()
    } else if (
      eventName === 'issue_comment' &&
      (action === 'created' || action === 'edited')
    ) {
      await this.onCommentEvent()
    } else {
      throw new Error(
        `Unsupported event "${eventName}" and/or action "${action}", ending run`
      )
    }
  }

  /** For issue webhooks */
  private async onIssueEvent(): Promise<void> {
    console.log('Starting issue event workflow')
    // get issue info if it has a label to check
    if (await this.hasLabelToCheck()) {
      const {body} = await this.getIssueInfo()

      if (body) {
        const responses = this.getResponses(body)

        if (responses.length > 0) {
          console.log(
            'Comment does not have required items, adding comment and label'
          )
          await this.createComment(responses)
          await this.ensureLabelExists(this.config.labelToAdd)
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
    // run if there is a comment and the issue has the label
    if (await this.hasLabelToAdd()) {
      console.log('Getting comment and issue info')
      const {body, login: commentLogin} = await this.getCommentInfo()
      const {login: issueLogin} = await this.getIssueInfo()

      // make sure the commenter is the original poster
      if (body && commentLogin && issueLogin && issueLogin === commentLogin) {
        console.log('Checking comment for required items')
        const responses = this.getResponses(body)

        if (responses.length < this.config.requiredItems.length) {
          console.log('Comment contains required items, removing label')
          this.removeLabel(this.config.labelToAdd)
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

  /**
   * Checks the required items to make sure everything is there
   * Returns the responses for all of the missing items
   */
  getResponses(post: string): string[] {
    console.log('Parsing for required items')

    // does the post include a string
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

  /**------------------- ISSUE/COMMENT METHODS -------------------*/

  /** Get the body and username of a comment */
  async getIssueInfo(): Promise<PostInfo> {
    const {repo, owner, number: issue_number} = github.context.issue
    const {
      data: {body, user}
    } = await this.octokit.rest.issues.get({
      owner,
      repo,
      issue_number
    })

    return {body, login: user?.login}
  }

  /** Get the body and username of a comment */
  async getCommentInfo(): Promise<PostInfo> {
    const {
      payload: {comment},
      issue: {owner, repo}
    } = github.context

    if (comment) {
      const {
        data: {body, user}
      } = await this.octokit.rest.issues.getComment({
        owner,
        repo,
        comment_id: comment.id
      })

      return {body, login: user?.login}
    }
    throw new Error('Issue retrieving comment, ending run')
  }
  /** Creates an issue comment with the responses */
  async createComment(responses: string[]): Promise<void> {
    console.log('Creating comment')
    const {repo, owner, number: issue_number} = github.context.issue

    // the comment header/footer and the responses
    const body = `${this.config.commentHeader}\n\n${responses.join('\n')}\n\n${
      this.config.commentFooter
    }`

    await this.octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body
    })
  }

  /**------------------- LABEL METHODS -------------------*/

  /** Adds a label to an issue */
  async addLabel(label: string): Promise<void> {
    console.log('Adding label')
    const {repo, owner, number: issue_number} = github.context.issue
    this.octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number,
      labels: [label]
    })
  }

  /** Removes a label to an issue */
  async removeLabel(name: string): Promise<void> {
    console.log('Adding label')
    const {repo, owner, number: issue_number} = github.context.issue
    this.octokit.rest.issues.removeLabel({
      owner,
      repo,
      issue_number,
      name
    })
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
    const {repo, owner, number: issue_number} = github.context.issue
    const labels = await this.octokit.rest.issues.listLabelsOnIssue({
      owner,
      repo,
      issue_number
    })
    return labels.data.map(label => label.name).includes(this.config.labelToAdd)
  }

  /** Checks if an issue has at least one labelToCheck */
  async hasLabelToCheck(): Promise<boolean> {
    console.log('Checking if the issue has a labelToCheck')
    const {repo, owner, number: issue_number} = github.context.issue
    const labels = await this.octokit.rest.issues.listLabelsOnIssue({
      owner,
      repo,
      issue_number
    })
    return this.config.labelsToCheck.some(l =>
      labels.data.map(label => label.name).includes(l)
    )
  }
}
