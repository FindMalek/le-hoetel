"use server"

import { stopEverything, updateChannels } from "@/lib/api"

type Channel = "email" | "whatsapp"
export type ChannelStates = { channel: Channel; granted: boolean }[]

export async function setChannel(token: string, channel: Channel, granted: boolean): Promise<ChannelStates | null> {
  return updateChannels(token, { [channel]: granted }).catch(() => null)
}

export async function stopAll(token: string): Promise<ChannelStates | null> {
  return stopEverything(token).catch(() => null)
}
