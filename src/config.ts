/* eslint-disable @typescript-eslint/no-explicit-any */
import * as yaml from 'js-yaml'
import fs from 'fs'

export interface RequiredItem {
  content: string[]
  response: string
  requireAll: boolean
}

export default class Config {
  requiredItems: RequiredItem[]
  commentHeader: string
  commentFooter: string
  labelToAdd: string
  labelsToCheck: string[]
  exemptUsers: string[]

  constructor(configPath: string) {
    const config = this.parseConfig(configPath)
    this.requiredItems = config.requiredItems
    this.labelToAdd = config.labelToAdd
    this.labelsToCheck = config.labelsToCheck
    this.exemptUsers = config.exemptUsers || []
    this.commentFooter = config.commentFooter || ''
    this.commentHeader = config.commentHeader || ''
  }

  isValidRequiredItem = (item: any): item is RequiredItem =>
    item !== null &&
    typeof item === 'object' &&
    'response' in item &&
    'requireAll' in item &&
    'content' in item &&
    typeof item.response === 'string' &&
    typeof item.requireAll === 'boolean' &&
    Array.isArray(item.content)
      ? item.content.every((i: any) => typeof i === 'string')
      : false

  isValidConfig(obj: any): obj is Config {
    return obj !== null &&
      typeof obj === 'object' &&
      'requiredItems' in obj &&
      'labelToAdd' in obj &&
      'labelsToCheck' in obj &&
      typeof obj.labelToAdd === 'string' &&
      Array.isArray(obj.requiredItems) &&
      Array.isArray(obj.labelsToCheck)
      ? obj.requiredItems.every(this.isValidRequiredItem)
      : false
  }

  parseConfig(path: string): Config {
    const data: any = yaml.load(fs.readFileSync(path, 'utf8'))
    if (this.isValidConfig(data)) return data
    throw new Error('Invalid configuration, ending action.')
  }
}
