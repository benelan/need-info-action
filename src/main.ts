import * as core from '@actions/core'
import * as github from '@actions/github'
import Config from './config'
async function run(): Promise<void> {
  try {
    const {repo, payload, issue} = github.context

    const configPath = core.getInput('config_path')
    const config = new Config(configPath)
    const githubToken = core.getInput('github_token')
    const client = github.getOctokit(githubToken)
  } catch (e: unknown) {
    if (e instanceof Error) {
      core.setFailed(e.message)
    }
  }
}

run()
