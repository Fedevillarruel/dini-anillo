export default function handler(_request, response) {
  response.status(200).json({ service: 'dini-ring-api', status: 'ok' })
}