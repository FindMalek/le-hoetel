import { forwardToApi } from "@ritorno/orpc/proxy"
import { viewedHotelId } from "@/lib/view-hotel"

const forward = async (request: Request) => {
  // A list names the hotel it is showing: the cookie may have moved to another one in a second tab. The api still
  // decides who may name which hotel.
  const hotelId = request.headers.has("x-hotel-id") ? null : await viewedHotelId()
  return forwardToApi(request, hotelId ? { "x-hotel-id": hotelId } : {})
}

export const GET = forward
export const POST = forward
export const PUT = forward
export const PATCH = forward
export const DELETE = forward
