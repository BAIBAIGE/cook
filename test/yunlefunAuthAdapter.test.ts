import type { YunlefunSsoConfig } from '../app/utils/yunlefunSsoConfig'
import { Browser } from '@capacitor/browser'
import { Preferences } from '@capacitor/preferences'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCloudbaseIdentityAdapter,
  createNativeYunlefunAuthorizationAdapter,
} from '../app/adapters/yunlefunAuth'

vi.mock('@capacitor/browser', () => ({
  Browser: {
    close: vi.fn(),
    open: vi.fn(),
  },
}))

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async () => ({ value: null })),
    remove: vi.fn(),
    set: vi.fn(),
  },
}))

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

describe('native authorization adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clears the pending transaction when authorization is cancelled', async () => {
    const nativeConfig: YunlefunSsoConfig = {
      ...config,
      redirect: {
        ...config.redirect,
        clientId: 'cook-mobile',
        redirectUri: 'https://cook.yunyoujun.cn/auth/callback?platform=native',
      },
    }
    const adapter = createNativeYunlefunAuthorizationAdapter(nativeConfig, async () => null)

    await adapter.start()
    expect(Preferences.set).toHaveBeenCalledOnce()
    expect(Browser.open).toHaveBeenCalledOnce()

    await adapter.cancel()
    expect(Preferences.remove).toHaveBeenCalledWith({
      key: 'cook:sso:v3:native-transaction',
    })
  })
})
