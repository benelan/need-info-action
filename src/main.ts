import {context, getOctokit} from '@actions/github'
import {getInput, setFailed} from '@actions/core'
import Config from './config'
import NeedInfo from './need-info'

async function run(): Promise<void> {
  try {
    const token = getInput('repo-token')
    const path = getInput('config-path')

    const octokit = getOctokit(token)
    const configFile = await octokit.rest.repos.getContent({
      ...context.repo,
      path
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = configFile.data
    if (!data.content) {
      throw new Error('Configuration file not found, ending run')
    }

    const configString = Buffer.from(data.content, 'base64').toString()
    const config = new Config(configString)
    const needInfo = new NeedInfo(config, octokit)

    needInfo.verify()
  } catch (e) {
    if (e instanceof Error) {
      setFailed(e.message)
    }
  }
}

run()
