import { setReadState } from "@/lib/repository";
import { handleItemStateMutation, type ItemRouteContext } from "../state-route";

export async function POST(
  _request: Request,
  context: ItemRouteContext,
) {
  return handleItemStateMutation(context, (id) => setReadState(id, true));
}
