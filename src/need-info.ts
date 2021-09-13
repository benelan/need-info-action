import Config from './config'
import {GitHub} from '@actions/github/lib/utils'
import {context} from '@actions/github'

/** Username and text body of an issue/comment */
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

  /** Checks the github event/action and uses the appropriate workflow */
  async verify(): Promise<void> {
    const {
      eventName,
      payload: {action}
    } = context

    if (
      eventName === 'issues' &&
      (action === 'opened' || action === 'edited')
    ) {
      await this.onIssueEvent()
    } else if (
      eventName === 'issue_comment' &&
      (action === 'created' || action === 'edited')
    ) {
      await this.onCommentEvent()
    } else if (eventName === 'issues' && action === 'labeled') {
      await this.onLabelEvent()
    } else {
      throw new Error(
        `Unsupported event "${eventName}" and/or action "${action}", ending run`
      )
    }
  }

  /** issue webhooks */
  private async onIssueEvent(): Promise<void> {
    console.log('Starting issue event workflow')
    // issue has a labelToCheck and is not already marked with the labelToAdd
    if ((await this.hasLabelToCheck()) && !(await this.hasLabelToAdd())) {
      const {body} = await this.getIssueInfo()

      if (body) {
        const responses = this.getNeedInfoResponses(body)

        if (responses.length > 0) {
          console.log(
            'Issue does not have all required items, adding comment and label'
          )
          await this.createComment(responses)
          await this.ensureLabelExists(this.config.labelToAdd)
          await this.addLabel(this.config.labelToAdd)
        }
      } else {
        console.log('The issue body is empty, ending run')
      }
    } else {
      console.log(
        'The issue already has the label to add or does not have a label to check, ending run'
      )
    }
  }

  /** issue comment webhooks */
  private async onCommentEvent(): Promise<void> {
    console.log('Starting comment event workflow')
    if (await this.hasLabelToAdd()) {
      console.log('Getting comment and issue info')
      const {body, login: commentLogin} = await this.getCommentInfo()
      const {login: issueLogin} = await this.getIssueInfo()

      // make sure the commenter is the original poster
      if (body && commentLogin && issueLogin && issueLogin === commentLogin) {
        console.log('Checking comment for required items')
        const responses = this.getNeedInfoResponses(body)

        if (responses.length < this.config.requiredItems.length) {
          console.log(
            'Comment contains at least one required item, removing label'
          )
          this.removeLabel(this.config.labelToAdd)
        } else {
          console.log('Comment does not contain any required items, ending run')
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

  /** issue label webhooks */
  private async onLabelEvent(): Promise<void> {
    console.log('Starting label event workflow')
    const {
      payload: {label}
    } = context
    // the added label is a label to check
    if (label && this.config.labelsToCheck.includes(label.name)) {
      console.log('The added label is a label to check')
      const {body} = await this.getIssueInfo()
      if (body) {
        const responses = this.getNeedInfoResponses(body)

        if (responses.length > 0) {
          console.log(
            'Issue does not have all required items, adding comment and label'
          )
          await this.createComment(responses)
          await this.ensureLabelExists(this.config.labelToAdd)
          await this.addLabel(this.config.labelToAdd)
        }
      } else {
        console.log('The issue body is empty, ending run')
      }
    } else {
      console.log('The added label is not a label to check, ending run')
    }
  }

  /**
   * Checks the required items to make sure everything is there
   * Returns the responses for all of the missing items
   */
  getNeedInfoResponses(post: string): string[] {
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

  /** Get the text body and username of an issue */
  async getIssueInfo(): Promise<PostInfo> {
    const {repo, owner, number: issue_number} = context.issue
    const {
      data: {body, user}
    } = await this.octokit.rest.issues.get({
      owner,
      repo,
      issue_number
    })

    return {body, login: user?.login}
  }

  /** Get the text body and username of a comment */
  async getCommentInfo(): Promise<PostInfo> {
    const {
      payload: {comment},
      issue: {owner, repo}
    } = context

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
    throw new Error('Error retrieving comment, ending run')
  }

  /** Creates a comment with the responses for the missing items */
  async createComment(responses: string[]): Promise<void> {
    console.log('Creating comment')
    const {repo, owner, number: issue_number} = context.issue

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
    const {repo, owner, number: issue_number} = context.issue
    this.octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number,
      labels: [label]
    })
  }

  /** Removes a label to an issue */
  async removeLabel(name: string): Promise<void> {
    console.log('Removing label')
    const {repo, owner, number: issue_number} = context.issue
    this.octokit.rest.issues.removeLabel({
      owner,
      repo,
      issue_number,
      name
    })
  }

  /** Creates a label if it does not exist */
  async ensureLabelExists(name: string): Promise<void> {
    const {repo} = context
    try {
      console.log('checking if the label exists')
      await this.octokit.rest.issues.getLabel({
        ...repo,
        name
      })
    } catch (e) {
      console.log('Label did not exist, creating it now')
      this.octokit.rest.issues.createLabel({
        ...repo,
        name
      })
    }
  }

  /** Checks if an issue has the labelToAdd */
  async hasLabelToAdd(): Promise<boolean> {
    console.log('Checking if the issue has the required label')
    const {repo, owner, number: issue_number} = context.issue
    const labels = await this.octokit.rest.issues.listLabelsOnIssue({
      owner,
      repo,
      issue_number
    })
    return labels.data.map(label => label.name).includes(this.config.labelToAdd)
  }

  /** Checks if an issue has at least one labelToCheck */
  async hasLabelToCheck(): Promise<boolean> {
    console.log('Checking if the issue has one of the labels to check')
    const {repo, owner, number: issue_number} = context.issue
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
