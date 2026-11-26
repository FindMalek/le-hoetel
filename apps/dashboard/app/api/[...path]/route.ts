import { forwardToApi } from "@ritorno/orpc/proxy"
import { VIEW_HOTEL_COOKIE, viewedHotelId } from "@/lib/view-hotel"

const forward = async (request: Request) => {
  // The browser names the hotel it is showing: the cookie may have moved to another one in a second tab. The api
  // still decides who may name which hotel.
  const hotelId = request.headers.has("x-hotel-id") ? null : await viewedHotelId()
  const response = await forwardToApi(request, hotelId ? { "x-hotel-id": hotelId } : {})
  // Switching hotels ends the admin's "acting as": its cookie would otherwise keep that hotel on screen.
  if (response.ok && new URL(request.url).pathname === "/api/auth/organization/set-active") {
    response.headers.append("set-cookie", `${VIEW_HOTEL_COOKIE}=; Path=/; Max-Age=0`)
  }
  return response
}

export const GET = forward
export const POST = forward
export const PUT = forward
export const PATCH = forward
export const DELETE = forward
