export const apiFetch = async (url: string, userAuth: string, method = 'GET', body: any = null) => {
  const headers: any = { 'x-user-email': userAuth };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { 
    method, 
    headers, 
    body: body ? JSON.stringify(body) : null,
    cache: 'no-store'
  });
  if (!res.ok) {
    let msg = 'Erro na requisição';
    try { const data = await res.json(); msg = data.error || msg; } catch(e){}
    throw new Error(msg);
  }
  return res.json();
};
