// Keep the operator credential in memory only, never in a bundle or localStorage.
let operatorToken = ""
export async function operatorFetch(url: string, init: RequestInit): Promise<Response> {
  const send = () => fetch(url, { ...init, headers: { ...init.headers,
    ...(operatorToken ? { Authorization: `Bearer ${operatorToken}` } : {}),
  } })
  let response = await send()
  if (response.status === 401) {
    operatorToken = window.prompt("Enter the operator token configured for this server to run checks or simulations.")?.trim() ?? ""
    if (operatorToken) response = await send()
    if (response.status === 401) operatorToken = ""
  }
  return response
}
