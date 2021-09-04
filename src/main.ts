import * as core from '@actions/core'
import * as github from '@actions/github'

async function run(): Promise<void> {
  try {
    const {repo, payload, issue} = github.context

    const requireAll = core.getMultilineInput('require_all')
    const requireOne = core.getMultilineInput('require_one')
    const myToken = core.getInput('github_token')
    const client = github.getOctokit(myToken)
  } catch (e: unknown) {
    if (e instanceof Error) {
      core.setFailed(e.message)
    }
  }
}

run()
