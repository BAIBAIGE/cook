import type { YunlefunSsoConfig } from '../app/utils/yunlefunSsoConfig'
import { describe, expect, it } from 'vitest'
import { createCloudbaseIdentityAdapter } from '../app/adapters/yunlefunAuth'

const config: YunlefunSsoConfig = {
  cloudbaseEnv: 'yunlefun-production',
  exchange: {
    exchangeUrl: 'https://api.yunle.fun/sso-ticket',
  },
  redirect: {
    clientId: 'cook-web',
    redirectUri: 'https://cook.yunyoujun.cn/auth/callback',
    scope: ['identity:bootstrap'],
    ssoOrigin: 'https://www.yunle.fun',
  },
}

describe('cloudbase identity adapter', () => {
  it('rejects a sign-out response that contains a CloudBase error', async () => {
    const identity = createCloudbaseIdentityAdapter(config, {
      getAuth: async () => ({
        getSession: async () => ({ data: { session: null } }),
        getUser: async () => ({ data: { user: null } }),
        signInWithCustomTicket: async () => ({}),
        signOut: async () => ({ error: new Error('remote sign-out failed') }),
      }),
    })

    await expect(identity.signOut()).rejects.toThrow('CloudBase sign-out failed')
  })
})
