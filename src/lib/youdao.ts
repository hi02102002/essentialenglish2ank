import { md5 } from '@noble/hashes/legacy.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'

export type YoudaoDictVoiceType = 1 | 2

type YoudaoSignedDefaults = {
  product: string
  appVersion: number
  client: string
  mid: number
  vendor: string
  screen: number
  model: number
  imei: number
  network: string
  keyfrom: string
  keyId: string
  yduuid: string
  rate: number
  le: string
  phonetic: string
  id: string
}

type YoudaoSignedVoiceOptions = Partial<
  YoudaoSignedDefaults & { mysticTime: number; signSecretKey: string }
>

type GetYoudaoDictVoiceUrlOptions = {
  signed?: YoudaoSignedVoiceOptions
  disableSigned?: boolean
  fallbackToUnsigned?: boolean
}

const SIGNED_DEFAULTS: YoudaoSignedDefaults = {
  product: 'webdict',
  appVersion: 1,
  client: 'web',
  mid: 1,
  vendor: 'web',
  screen: 1,
  model: 1,
  imei: 1,
  network: 'wifi',
  keyfrom: 'dick',
  keyId: 'voiceDictWeb',
  yduuid: 'abcdefg',
  rate: 4,
  le: '',
  phonetic: '',
  id: '',
}

// Observed in Youdao web_dict bundle. This is intentionally isolated because
// Youdao can change its internal signing behavior at any time.
const DEFAULT_SIGNED_CONFIG = {
  signSecretKey: 'U3uACNRWSDWdcsKm',
}

const UNSIGNED_BASE_URL = 'https://dict.youdao.com/dictvoice'
const SIGNED_BASE_URL = 'https://dict.youdao.com/pronounce/base'

const stringifyQuery = (params: Record<string, string | number>) => {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) query.set(key, String(value))
  return query.toString()
}

const buildSignedVoiceUrl = (
  text: string,
  type: YoudaoDictVoiceType,
  options: YoudaoSignedVoiceOptions & { signSecretKey: string },
) => {
  const config = { ...SIGNED_DEFAULTS, ...options }
  const payload: Record<string, string | number> = {
    product: config.product,
    appVersion: config.appVersion,
    client: config.client,
    mid: config.mid,
    vendor: config.vendor,
    screen: config.screen,
    model: config.model,
    imei: config.imei,
    network: config.network,
    keyfrom: config.keyfrom,
    keyid: config.keyId,
    mysticTime: config.mysticTime ?? Date.now(),
    yduuid: config.yduuid,
    le: config.le,
    phonetic: config.phonetic,
    rate: config.rate,
    word: text,
    type,
    id: config.id,
  }

  const filteredPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== ''),
  ) as Record<string, string | number>

  const pointParams = Object.keys(filteredPayload).sort()
  const signInput = [...pointParams, 'key']
    .map((key) =>
      key === 'key'
        ? `key=${options.signSecretKey}`
        : `${key}=${filteredPayload[key]}`,
    )
    .join('&')

  const sign = bytesToHex(md5(utf8ToBytes(signInput)))
  const query = stringifyQuery({
    ...filteredPayload,
    sign,
    pointParam: [...pointParams, 'key'].join(','),
  })

  return `${SIGNED_BASE_URL}?${query}`
}

const buildUnsignedVoiceUrl = (text: string, type: YoudaoDictVoiceType) =>
  `${UNSIGNED_BASE_URL}?${stringifyQuery({ audio: text, type })}`

export const getYoudaoDictVoiceUrl = (
  sentence: string,
  type: YoudaoDictVoiceType = 2,
  options?: GetYoudaoDictVoiceUrlOptions,
) => {
  const text = sentence.trim()
  if (!text) return ''

  if (!options?.disableSigned) {
    const signedConfig = { ...DEFAULT_SIGNED_CONFIG, ...options?.signed }
    if (signedConfig.signSecretKey) {
      return buildSignedVoiceUrl(text, type, signedConfig)
    }
  }

  if (options?.fallbackToUnsigned === false) return ''
  return buildUnsignedVoiceUrl(text, type)
}

export const getYoudaoUnsignedVoiceUrl = (
  sentence: string,
  type: YoudaoDictVoiceType = 2,
) => buildUnsignedVoiceUrl(sentence.trim(), type)
