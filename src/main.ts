import * as core from '@actions/core'
import * as github from '@actions/github'
import Config from './config'
import NeedInfo from './need-info'

async function run(): Promise<void> {
  try {
    const event = github.context.eventName
    const action = github.context.payload.action

    const githubToken = core.getInput('github_token')
    const configPath = core.getInput('config_path')
    const config = new Config(configPath)
    const needInfo = new NeedInfo(config, githubToken)

    if (event === 'issues' && action === 'open') {
      needInfo.onIssueOpen()
    } else if (event === 'issues' && action === 'labeled') {
      needInfo.onIssueLabel()
    } else if (
      event === 'issue_comment' &&
      (action === 'created' || action === 'edited')
    ) {
      needInfo.onIssueComment()
    } else {
      throw new Error(
        `Unsupported event "${event}" and/or action "${action}", ending run.`
      )
    }
  } catch (e) {
    if (e instanceof Error) {
      core.setFailed(e.message)
    }
  }
}

run()
