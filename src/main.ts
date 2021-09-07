import * as core from '@actions/core'
import Config from './config'
import NeedInfo from './need-info'

async function run(): Promise<void> {
  try {
    const githubToken = core.getInput('github_token')
    const configPath = core.getInput('config_path')
    const config = new Config(configPath)
    const needInfo = new NeedInfo(config, githubToken)

    needInfo.check()
  } catch (e) {
    if (e instanceof Error) {
      core.setFailed(e.message)
    }
  }
}

run()
