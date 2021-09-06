/* eslint-disable @typescript-eslint/no-explicit-any */
import * as yaml from 'js-yaml'

export interface RequiredItem {
  content: string[]
  commentBody: string
  requireAll: boolean
}

export interface Config {
  github_token: string
  requiredItems: RequiredItem[]
  commentHeader: string | undefined
  commentFooter: string | undefined
  labelToAdd: string
  labelsToCheck: string[]
  exemptUsers: string[]
}

export function isRequiredItem(item: any): item is RequiredItem {
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

export function isConfig(item: any): item is Config {
  if (
    !(
      item !== null &&
      typeof item === 'object' &&
      'github_token' in item &&
      'commentHeader' in item &&
      'commentFooter' in item &&
      'requiredItems' in item &&
      'labelToAdd' in item &&
      'labelsToCheck' in item &&
      'exemptUsers' in item &&
      typeof item.github_token === 'string' &&
      typeof item.commentHeader === 'string' &&
      typeof item.commentFooter === 'string' &&
      typeof item.labelToAdd === 'string' &&
      Array.isArray(item.requiredItems) &&
      Array.isArray(item.labelsToCheck) &&
      Array.isArray(item.exemptUsers)
    )
  ) {
    return false
  }
  return item.requiredItems.every(isRequiredItem)
}

export function parseConfig(content: string): Config {
  const data = yaml.load(content)
  if (!isConfig(data)) {
    throw new Error('Invalid configuration, ending action.')
  } else {
    return data
  }
}
