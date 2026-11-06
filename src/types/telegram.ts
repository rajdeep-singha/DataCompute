/** Public connection information. Never include a token or destination chat ID. */
export type TelegramStatus = {
  tokenConfigured: boolean
  destinationConfigured: boolean
  botUrl: string | null
  botName: string | null
  botVerified: boolean
  monitoringEnabled: boolean
  intervalSeconds: number
}
