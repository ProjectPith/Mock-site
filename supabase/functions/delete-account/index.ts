Deno.serve((request) => {
  if (request.method === 'OPTIONS') return new Response('ok')
  return Response.json(
    { error: 'Direct deletion is disabled. Request deletion from Account Details and confirm it by email.' },
    { status: 410 }
  )
})
