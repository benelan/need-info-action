import * as core from '@actions/core'
import Config from './config'
import NeedInfo from './need-info'

async function run(): Promise<void> {
  try {
    const githubEvent = process.env['GITHUB_EVENT_NAME']

    const githubToken = core.getInput('github_token')
    const configPath = core.getInput('config_path')
    const config = new Config(configPath)
    const needInfo = new NeedInfo(config, githubToken)

    if (githubEvent === 'issues' || githubEvent === 'pull_request') {
      core.debug('TODO')
    } else if (
      githubEvent === 'issue_comment' ||
      githubEvent === 'pull_request_review_comment'
    ) {
      core.debug('TODO')
    } else if (githubEvent === 'label') {
      core.debug('TODO')
    } else {
      core.error(
        new Error(`Unrecognized event: ${githubEvent}, ending action.`)
      )
    }
  } catch (e) {
    if (e instanceof Error) {
      core.setFailed(e.message)
    }
  }
}

run()
