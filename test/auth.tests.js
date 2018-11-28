const assert = require('chai').assert;
const url = require('url');
const fs = require('fs');
const request = require('request-promise-native').defaults({
  simple: false,
  resolveWithFullResponse: true
});

const expressOpenid = require('..');
const server = require('./fixture/server');
const filterRoute = (method, path) => {
  return r => r.route &&
              r.route.path === path &&
              r.route.methods[method.toLowerCase()];
};

describe('auth', function() {
  describe('default', () => {
    const router = expressOpenid.auth({
      clientID: '123',
      baseURL: 'https://myapp.com',
      issuerBaseURL: 'https://flosser.auth0.com',
      required: false
    });

    let baseUrl;

    before(async function() {
      baseUrl = await server.create(router);
    });

    it('should contain a login route', function() {
      assert.ok(router.stack.some(filterRoute('GET', '/login')));
    });

    it('should contain a logout route', function() {
      assert.ok(router.stack.some(filterRoute('GET', '/logout')));
    });

    it('should contain a callback route', function() {
      assert.ok(router.stack.some(filterRoute('POST', '/callback')));
    });

    it('should redirect to the authorize url properly on /login', async function() {
      const jar = request.jar();
      const res = await request.get('/login', { jar, baseUrl, followRedirect: false });
      assert.equal(res.statusCode, 302);

      const parsed = url.parse(res.headers.location, true);
      assert.equal(parsed.hostname, 'flosser.auth0.com');
      assert.equal(parsed.pathname, '/authorize');
      assert.equal(parsed.query.client_id, '123');

      assert.equal(parsed.query.scope, 'openid profile email');
      assert.equal(parsed.query.response_type, 'id_token');
      assert.equal(parsed.query.response_mode, 'form_post');
      assert.equal(parsed.query.redirect_uri, 'https://myapp.com/callback');
      assert.property(parsed.query, 'nonce');
      assert.property(parsed.query, 'state');

      const session = (await request.get('/session', { jar, baseUrl, json: true })).body;
      assert.equal(session.nonce, parsed.query.nonce);
      assert.equal(session.state, parsed.query.state);
    });

  });

  describe('implied response_mode', () => {
    describe('response_type=none', () => {
      const router = expressOpenid.auth({
        clientID: '123',
        baseURL: 'https://myapp.com',
        issuerBaseURL: 'https://flosser.auth0.com',
        authorizationParams: {
          response_mode: undefined,
          response_type: 'none',
        },
        required: false
      });

      let baseUrl;

      before(async function() {
        baseUrl = await server.create(router);
      });

      it('should redirect to the authorize url properly on /login', async function() {
        const cookieJar = request.jar();
        const res = await request.get('/login', { cookieJar, baseUrl, followRedirect: false });
        assert.equal(res.statusCode, 302);

        const parsed = url.parse(res.headers.location, true);

        assert.equal(parsed.hostname, 'flosser.auth0.com');
        assert.equal(parsed.pathname, '/authorize');
        assert.equal(parsed.query.client_id, '123');
        assert.equal(parsed.query.scope, 'openid profile email');
        assert.equal(parsed.query.response_type, 'none');
        assert.equal(parsed.query.response_mode, undefined);
        assert.equal(parsed.query.redirect_uri, 'https://myapp.com/callback');
        assert.property(parsed.query, 'nonce');
        assert.property(parsed.query, 'state');
      });

      it('should contain a callback route', function() {
        assert.ok(router.stack.some(filterRoute('GET', '/callback')));
      });
    });

    describe('response_type=code', () => {
      const router = expressOpenid.auth({
        clientID: '123',
        clientSecret: '456',
        baseURL: 'https://myapp.com',
        issuerBaseURL: 'https://flosser.auth0.com',
        authorizationParams: {
          response_mode: undefined,
          response_type: 'code',
        }
      });

      let baseUrl;

      before(async function() {
        baseUrl = await server.create(router);
      });


      it('should redirect to the authorize url properly on /login', async function() {
        const cookieJar = request.jar();
        const res = await request.get('/login', { cookieJar, baseUrl, followRedirect: false });
        assert.equal(res.statusCode, 302);

        const parsed = url.parse(res.headers.location, true);

        assert.equal(parsed.hostname, 'flosser.auth0.com');
        assert.equal(parsed.pathname, '/authorize');
        assert.equal(parsed.query.client_id, '123');
        assert.equal(parsed.query.scope, 'openid profile email');
        assert.equal(parsed.query.response_type, 'code');
        assert.equal(parsed.query.response_mode, undefined);
        assert.equal(parsed.query.redirect_uri, 'https://myapp.com/callback');
        assert.property(parsed.query, 'nonce');
        assert.property(parsed.query, 'state');
      });

      it('should contain a callback route', function() {
        assert.ok(router.stack.some(filterRoute('GET', '/callback')));
      });
    });

    describe('response_type=id_token', () => {
      const router = expressOpenid.auth({
        clientID: '123',
        baseURL: 'https://myapp.com',
        issuerBaseURL: 'https://flosser.auth0.com',
        authorizationParams: {
          response_mode: undefined,
          response_type: 'id_token',
        }
      });

      let baseUrl;

      before(async function() {
        baseUrl = await server.create(router);
      });

      it('should redirect to the authorize url properly on /login', async function() {
        const cookieJar = request.jar();
        const res = await request.get('/login', { cookieJar, baseUrl, followRedirect: false });
        assert.equal(res.statusCode, 302);

        const parsed = url.parse(res.headers.location, true);

        assert.equal(parsed.hostname, 'flosser.auth0.com');
        assert.equal(parsed.pathname, '/authorize');
        assert.equal(parsed.query.client_id, '123');
        assert.equal(parsed.query.scope, 'openid profile email');
        assert.equal(parsed.query.response_type, 'id_token');
        assert.equal(parsed.query.response_mode, undefined);
        assert.equal(parsed.query.redirect_uri, 'https://myapp.com/callback');
        assert.property(parsed.query, 'nonce');
        assert.property(parsed.query, 'state');
      });

      it('should contain the two callbacks route', function() {
        assert.ok(router.stack.some(filterRoute('POST', '/callback')));
        assert.ok(router.stack.some(filterRoute('GET', '/callback')));
      });

      it('should return an html on GET /callback', async function() {
        const cookieJar = request.jar();
        const res = await request.get('/callback', { cookieJar, baseUrl, followRedirect: false });
        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['content-type'], 'text/html; charset=utf-8');
        const expectedBody = fs.readFileSync(`${__dirname}/../views/repost.html`, 'utf-8');
        assert.equal(res.body, expectedBody);
      });

    });
  });
});
