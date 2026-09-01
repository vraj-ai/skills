// Final test: missing null check
function getUser(id) {
  return fetch(`/api/users/${id}`).then(r => r.json())
}
