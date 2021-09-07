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

  async onComment(): Promise<void> {
    const {payload, repo} = github.context
    if (
      (payload.action === 'created' || payload.action === 'edited') &&
      payload.comment !== undefined
    ) {
      const comment = await this.octokit.rest.issues.getComment({
        ...repo,
        comment_id: payload.comment.id
      })
      if (comment.data.body !== undefined) {
        await this.createComment(
          this.config.commentHeader,
          this.getCommentBodies(comment.data.body).join('\n'),
          this.config.commentFooter,
          payload.comment.id
        )
      }
    } else {
      throw new Error(
        `The event was not a comment or the action "${payload.action}" is not supported, ending run.`
      )
    }
  }

  async ensureLabelExists(): Promise<void> {
    try {
      await this.octokit.rest.issues.getLabel({
        name: this.config.labelToAdd,
        ...github.context.repo
      })
    } catch (e) {
      this.octokit.rest.issues.createLabel({
        name: this.config.labelToAdd,
        color: 'yellow',
        ...github.context.repo
      })
    }
  }

  async hasLabelToAdd(issue: Issue): Promise<boolean> {
    const labels = await this.octokit.rest.issues.listLabelsOnIssue({...issue})
    return labels.data.map(label => label.name).includes(this.config.labelToAdd)
  }

  getCommentBodies(post: string): string[] {
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
