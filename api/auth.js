// GitHub OAuth — Step 1: redirect to GitHub
export default function handler(req, res) {
  const { host } = req.headers;
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/callback`;

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'repo,user',
    state: Math.random().toString(36).slice(2),
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}
