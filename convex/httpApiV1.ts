import { httpAction } from './_generated/server'

import {
  listSkillsV1Handler,
  publishSkillV1Handler,
  resolveSkillVersionV1Handler,
  searchSkillsV1Handler,
  skillsDeleteRouterV1Handler,
  skillsGetRouterV1Handler,
  skillsPostRouterV1Handler,
} from './httpApiV1/skillsV1'
import {
  listPersonasV1Handler,
  publishPersonaV1Handler,
  personasDeleteRouterV1Handler,
  personasGetRouterV1Handler,
  personasPostRouterV1Handler,
} from './httpApiV1/personasV1'
import { starsDeleteRouterV1Handler, starsPostRouterV1Handler } from './httpApiV1/starsV1'
import { usersListV1Handler, usersPostRouterV1Handler } from './httpApiV1/usersV1'
import { whoamiV1Handler } from './httpApiV1/whoamiV1'

export const searchSkillsV1Http = httpAction(searchSkillsV1Handler)
export const resolveSkillVersionV1Http = httpAction(resolveSkillVersionV1Handler)
export const listSkillsV1Http = httpAction(listSkillsV1Handler)
export const skillsGetRouterV1Http = httpAction(skillsGetRouterV1Handler)
export const publishSkillV1Http = httpAction(publishSkillV1Handler)
export const skillsPostRouterV1Http = httpAction(skillsPostRouterV1Handler)
export const skillsDeleteRouterV1Http = httpAction(skillsDeleteRouterV1Handler)

export const listPersonasV1Http = httpAction(listPersonasV1Handler)
export const personasGetRouterV1Http = httpAction(personasGetRouterV1Handler)
export const publishPersonaV1Http = httpAction(publishPersonaV1Handler)
export const personasPostRouterV1Http = httpAction(personasPostRouterV1Handler)
export const personasDeleteRouterV1Http = httpAction(personasDeleteRouterV1Handler)

export const starsPostRouterV1Http = httpAction(starsPostRouterV1Handler)
export const starsDeleteRouterV1Http = httpAction(starsDeleteRouterV1Handler)

export const whoamiV1Http = httpAction(whoamiV1Handler)
export const usersPostRouterV1Http = httpAction(usersPostRouterV1Handler)
export const usersListV1Http = httpAction(usersListV1Handler)

export const __handlers = {
  searchSkillsV1Handler,
  resolveSkillVersionV1Handler,
  listSkillsV1Handler,
  skillsGetRouterV1Handler,
  publishSkillV1Handler,
  skillsPostRouterV1Handler,
  skillsDeleteRouterV1Handler,
  listPersonasV1Handler,
  personasGetRouterV1Handler,
  publishPersonaV1Handler,
  personasPostRouterV1Handler,
  personasDeleteRouterV1Handler,
  starsPostRouterV1Handler,
  starsDeleteRouterV1Handler,
  whoamiV1Handler,
  usersPostRouterV1Handler,
  usersListV1Handler,
}
