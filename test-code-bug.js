// test file with missing error handling
function fetchData(url) {
  return fetch(url).then(res => res.json())
}
