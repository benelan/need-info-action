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
      core.debug('TODO: content check if post has the label')
    } else {
      throw new Error(
        `Unsupported issue or pull request action: ${action}, ending run.`
      )
    }
  }

  onComment(): void {
    const {action} = github.context.payload
    if (action === 'created' || action === 'edited') {
      core.debug('TODO')
    } else {
      throw new Error(`Unsupported comment action: ${action}, ending run.`)
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

  hasRequiredItems(post: string): boolean {
    return this.config.requiredItems.every(item => {
      if (item.requireAll) {
        return item.content.every(content => {
          return content.toLowerCase().includes(post.toLowerCase())
        })
      } else {
        return item.content.some(content => {
          return content.toLowerCase().includes(post.toLowerCase())
        })
      }
    })
  }

  getResponses(post: string): string[] {
    const inPost = (text: string): boolean =>
      text.toLowerCase().includes(post.toLowerCase())

    const responses = []
    for (const item of this.config.requiredItems) {
      if (
        (item.requireAll && !item.content.every(c => inPost(c))) ||
        (!item.requireAll && !item.content.some(c => inPost(c)))
      )
        responses.push(item.commentBody)
    }
    return responses
  }
}
