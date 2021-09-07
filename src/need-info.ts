// import * as core from '@actions/core'
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
}
