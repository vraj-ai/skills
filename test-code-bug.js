// test file with missing error handling
async function fetchData(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Request failed with status ${res.status}: ${body}`);
  }
  // Network errors reject from fetch; JSON parse errors reject from res.json().
  // Both propagate to the caller unchanged.
  return res.json();
}

