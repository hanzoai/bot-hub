import type { Doc } from '../_generated/dataModel'

type SkillBadgeSource = Pick<Doc<'skills'>, 'badges'>

type HighlightBadge = { byUserId: Doc<'users'>['_id']; at: number }
type OfficialBadge = { byUserId: Doc<'users'>['_id']; at: number }
type DeprecatedBadge = { byUserId: Doc<'users'>['_id']; at: number }

export function isSkillHighlighted(skill: SkillBadgeSource) {
  return Boolean(skill.badges?.highlighted)
}

export function isSkillOfficial(skill: SkillBadgeSource) {
  return Boolean(skill.badges?.official)
}

export function isSkillDeprecated(skill: SkillBadgeSource) {
  return Boolean(skill.badges?.deprecated)
}

export function buildHighlightBadge(userId: Doc<'users'>['_id'], at: number) {
  const badge: HighlightBadge = { byUserId: userId, at }
  return badge
}

export function buildOfficialBadge(userId: Doc<'users'>['_id'], at: number) {
  const badge: OfficialBadge = { byUserId: userId, at }
  return badge
}

export function buildDeprecatedBadge(userId: Doc<'users'>['_id'], at: number) {
  const badge: DeprecatedBadge = { byUserId: userId, at }
  return badge
}
