import http from 'http';
http.get('http://localhost:5999/admin/event', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log("Status Code:", res.statusCode);
  });
}).on('error', (err) => {
  console.log("Error:", err.message);
});
