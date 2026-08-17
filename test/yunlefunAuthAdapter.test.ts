import type { SsoAuthorizationResult } from '@yunlefun/sso'
import type { YunlefunSsoConfig } from '../app/utils/yunlefunSsoConfig'
import { Browser } from '@capacitor/browser'
import { Preferences } from '@capacitor/preferences'
import { SsoIdentityAdoptionError } from '@yunlefun/sso/browser'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCloudbaseIdentityAdapter,
  createNativeYunlefunAuthorizationAdapter,
  createWebYunlefunAuthorizationAdapter,
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

const hostAuthorization: SsoAuthorizationResult = {
  ok: true,
  clientId: 'cook-web',
  code: 'c'.repeat(43),
  codeVerifier: 'v'.repeat(43),
  issuer: 'https://www.yunle.fun',
  nonce: 'n'.repeat(43),
  redirectUri: 'https://cook.yunyoujun.cn/auth/callback',
  scope: ['identity:bootstrap'],
}

describe('web authorization adapter', () => {
  it('uses the YunLeFun host consent sheet without starting a redirect', async () => {
    const requestHostAuthorization = vi.fn(async () => hostAuthorization)
    const startRedirect = vi.fn()
    const adapter = createWebYunlefunAuthorizationAdapter(config, {
      requestHostAuthorization,
      startRedirect,
    })

    await expect(adapter.start()).resolves.toEqual(hostAuthorization)
    expect(requestHostAuthorization).toHaveBeenCalledWith({
      ...config.redirect,
      prompt: 'consent',
    })
    expect(startRedirect).not.toHaveBeenCalled()
  })

  it('falls back to the top-level web redirect outside the YunLeFun host', async () => {
    const startRedirect = vi.fn()
    const adapter = createWebYunlefunAuthorizationAdapter(config, {
      requestHostAuthorization: async () => null,
      startRedirect,
    })

    await expect(adapter.start()).resolves.toBeNull()
    expect(startRedirect).toHaveBeenCalledWith(config.redirect)
  })

  it('does not bypass an explicit host denial with a web redirect', async () => {
    const startRedirect = vi.fn()
    const adapter = createWebYunlefunAuthorizationAdapter(config, {
      requestHostAuthorization: async () => {
        throw new SsoIdentityAdoptionError(
          'Host authorization was denied',
          'access_denied',
        )
      },
      startRedirect,
    })

    await expect(adapter.start()).resolves.toEqual({
      ok: false,
      reason: 'access_denied',
    })
    expect(startRedirect).not.toHaveBeenCalled()
  })
})

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
