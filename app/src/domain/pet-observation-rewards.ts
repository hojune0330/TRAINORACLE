import { activeLocalAccount, localJournalScopeGeneration } from './account/local-journal-ownership'
import { careDay, parseHome, petHomeKey, type HomeStorage } from '../screens/pet-room/pet-engine'
import { PET_OBSERVATION_STICKERS } from './pet-observation-collection'

const registeredScenes = new Set<string>(PET_OBSERVATION_STICKERS.map(item => item.sceneId))

/** Read confirmed photos only. This reader never creates/migrates a pet home,
 * reads journal content, or consults another owner's progress. */
export function readPetObservationRewardScenes(options: { storage?: Pick<HomeStorage, 'getItem'>; today?: string } = {}): readonly string[] {
  const owner = activeLocalAccount() ?? 'guest'
  const generation = localJournalScopeGeneration()
  const current = () => owner === (activeLocalAccount() ?? 'guest') && generation === localJournalScopeGeneration()
  try {
    const raw = (options.storage ?? window.localStorage).getItem(petHomeKey(owner))
    if (!raw || !current()) return []
    const home = parseHome(raw)
    const today = options.today ?? careDay()
    if (!home || home.scope !== owner || home.day > today || !current()) return []
    const photos = new Set(home.observation.photos)
    const scenes = home.observation.nights.filter(night => night.observedOn && night.observedOn <= today && night.wakeDate <= today)
      .flatMap(night => night.results.filter(result => result.status === 'used' && photos.has(result.id) && result.sceneId && registeredScenes.has(result.sceneId)).map(result => result.sceneId!))
    return current() ? [...new Set(scenes)] : []
  } catch { return [] }
}
