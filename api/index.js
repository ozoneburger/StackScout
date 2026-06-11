import { serve } from "../server.js";

export default async function handler(request, response) {
  await serve(request, response);
}
