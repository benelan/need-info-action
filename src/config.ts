/* eslint-disable @typescript-eslint/no-explicit-any */
import * as yaml from 'js-yaml'
import fs from 'fs'

export interface RequiredItem {
  content: string[]
  commentBody: string
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

  isValidRequiredItem = (item: any): item is RequiredItem => {
    if (
      !(
        item !== null &&
        typeof item === 'object' &&
        'commentBody' in item &&
        'requireAll' in item &&
        'content' in item &&
        typeof item.commentBody === 'string' &&
        typeof item.requireAll === 'boolean' &&
        Array.isArray(item.content)
      )
    ) {
      return false
    }
    return item.content.every((i: any) => {
      return typeof i === 'string'
    })
  }

  isValidConfig(item: any): boolean {
    if (
      !(
        item !== null &&
        typeof item === 'object' &&
        'requiredItems' in item &&
        'labelToAdd' in item &&
        'labelsToCheck' in item &&
        typeof item.labelToAdd === 'string' &&
        Array.isArray(item.requiredItems) &&
        Array.isArray(item.labelsToCheck)
      )
    ) {
      return false
    }
    return item.requiredItems.every(this.isValidRequiredItem)
  }

  parseConfig(path: string): any {
    const data = yaml.load(fs.readFileSync(path, 'utf8'))
    if (!this.isValidConfig(data)) {
      throw new Error('Invalid configuration, ending action.')
    } else {
      return data
    }
  }
}
