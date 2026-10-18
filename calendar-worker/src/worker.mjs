import { handleApi } from './api.mjs';
export default {
  async fetch(request, env) {
    const path=new URL(request.url).pathname;
    if (path.startsWith('/api/kalender/')) return handleApi(request, env);
    if(path==='/')return Response.redirect(new URL('/kalender.html',request.url),302);
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('Referrer-Policy', 'no-referrer');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'SAMEORIGIN');
    headers.set('X-Robots-Tag','noindex, nofollow');
    if(['/foreningsportal.html','/kalender.html','/mit-arrangement.html','/kalender-redaktion.html','/kalender-postkasse.html'].includes(path))headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'");
    return new Response(response.body, { status: response.status, headers });
  }
};
