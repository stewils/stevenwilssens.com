// What `virtual:team-manifest` is in the tests (vitest.config.ts): a fixed manifest, never this
// repository's history, so the dashboard's tests do not move as main moves.
import { makeTeamManifest } from './admin-fixtures'

export default makeTeamManifest()
