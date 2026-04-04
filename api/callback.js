// GitHub OAuth — Step 2: exchange code for token, return to CMS
export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Missing code parameter');
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id:     process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const data = await tokenRes.json();

    if (data.error) {
      return res.status(400).send(`OAuth error: ${data.error_description}`);
    }

    // Return a script that passes the token back to the CMS
    const script = `
<!DOCTYPE html>
<html>
<head><title>Authenticating…</title></head>
<body>
<script>
  (function() {
    function receiveMessage(e) {
      console.log("receiveMessage %o", e);
      window.opener.postMessage(
        'authorization:github:success:${JSON.stringify({ token: data.access_token, provider: 'github' })}',
        e.origin
      );
    }
    window.addEventListener("message", receiveMessage, false);
    window.opener.postMessage("authorizing:github", "*");
  })()
<\/script>
<p>Authenticating, please wait…</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(script);
  } catch (err) {
    res.status(500).send('Authentication failed: ' + err.message);
  }
}
