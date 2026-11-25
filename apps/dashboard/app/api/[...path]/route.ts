import { forwardToApi } from "@ritorno/orpc/proxy"
import { viewedHotelId } from "@/lib/view-hotel"

const forward = async (request: Request) => {
  const hotelId = await viewedHotelId()
  return forwardToApi(request, hotelId ? { "x-hotel-id": hotelId } : {})
}

export const GET = forward
export const POST = forward
export const PUT = forward
export const PATCH = forward
export const DELETE = forward
