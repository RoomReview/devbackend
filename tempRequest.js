const payload = JSON.stringify({email:'test@example.com',password:'Password123',firstName:'Test',lastName:'User',role:'TENANT'});
fetch('http://localhost:5000/api/v1/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: payload,
})
  .then(async res => {
    console.log('STATUS', res.status);
    console.log(await res.text());
  })
  .catch(err => {
    console.error('FETCH ERROR', err);
  });
