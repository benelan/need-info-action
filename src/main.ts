import * as core from '@actions/core'
import * as github from '@actions/github'
import Config from './config'
import NeedInfo from './need-info'

async function run(): Promise<void> {
  try {
    const githubToken = core.getInput('github_token')
    const path = core.getInput('config_path')
    const octokit = github.getOctokit(githubToken)
    const result = await octokit.rest.repos.getContent({
      ...github.context.repo,
      path
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = result.data
    if (!data.content) {
      throw new Error('the configuration file is not found')
    }

    const configString = Buffer.from(data.content, 'base64').toString()
    const config = new Config(configString)
    const needInfo = new NeedInfo(config, octokit)

    needInfo.check()
  } catch (e) {
    if (e instanceof Error) {
      core.setFailed(e.message)
    }
  }
}

run()
